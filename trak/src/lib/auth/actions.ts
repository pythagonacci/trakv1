'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { setCurrentWorkspaceAfterInvite } from '@/app/actions/workspace'
import { assertCanAddWorkspaceMember } from '@/lib/billing/data'
import { cookies } from 'next/headers'
import { claimSharedClientPagesForUser } from '@/lib/client-page-shares'

const AUTH_REQUEST_TIMEOUT_MS = 12000

function isNextRedirectControlFlow(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { digest?: unknown; message?: unknown };
  const digest = typeof maybeError.digest === "string" ? maybeError.digest : "";
  const message = typeof maybeError.message === "string" ? maybeError.message : "";
  return digest.startsWith("NEXT_REDIRECT") || message.startsWith("NEXT_REDIRECT");
}

function normalizeAuthErrorMessage(message: string) {
  const lowered = message.toLowerCase();
  if (lowered.includes("timed out")) {
    return "Supabase auth request timed out. Your Supabase project endpoint appears unavailable.";
  }
  if (lowered.includes("error code 522") || lowered.includes("connection timed out")) {
    return "Supabase auth endpoint returned Cloudflare 522 (connection timed out).";
  }
  if (lowered.includes("next_redirect")) {
    return "Login flow was interrupted by a redirect. Please try again.";
  }
  if (lowered.includes("failed to fetch")) {
    return "Could not reach auth service. Check your network and Supabase URL.";
  }

  if (
    lowered.includes("unexpected token") &&
    (lowered.includes("<!doctype") || lowered.includes("not valid json"))
  ) {
    return "Auth service returned an invalid response. Verify your Supabase URL and keys.";
  }

  return message;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

async function getSignupVerifyPath() {
  const cookieStore = await cookies()
  return cookieStore.get('signup_flow')?.value === 'free_trial'
    ? '/start-free-trial/verify'
    : '/signup/verify'
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  let loginErrorMessage: string | null = null

  try {
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword(data),
      AUTH_REQUEST_TIMEOUT_MS,
      "Supabase auth request",
    )
    if (error) {
      console.error('Login error:', error.message)
      loginErrorMessage = normalizeAuthErrorMessage(error.message)
    }
  } catch (error) {
    if (isNextRedirectControlFlow(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : "Login failed";
    console.error('Login request failed:', message)
    loginErrorMessage = normalizeAuthErrorMessage(message)
  }

  if (loginErrorMessage) {
    // Before showing a generic error, check if this email belongs to an
    // incomplete standard signup user (verified email but no password set).
    // If so, resend them an OTP and redirect to the verify step.
    try {
      const service = await createServiceClient()
      const { data: profile } = await service
        .from('profiles')
        .select('id')
        .eq('email', data.email?.toLowerCase()?.trim())
        .maybeSingle()

      if (profile) {
        const { data: { user: existingUser } } = await service.auth.admin.getUserById(profile.id)
        const stage = existingUser?.user_metadata?.signup_stage

        if (stage && stage !== 'complete' && stage !== 'password_set') {
          // Incomplete signup without password — resend OTP so they can continue
          await supabase.auth.signInWithOtp({ email: data.email })
          const cookieStore = await cookies()
          cookieStore.set('signup_email', data.email.toLowerCase().trim(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 3600,
            path: '/',
          })
          const verifyPath = await getSignupVerifyPath()
          redirect(
            verifyPath + '?message=' +
              encodeURIComponent('Please complete your signup. A new verification code has been sent.'),
          )
        }
      }
    } catch (e) {
      if (isNextRedirectControlFlow(e)) throw e
      // If the incomplete-signup check itself fails, fall through to normal error
    }

    redirect('/login?error=' + encodeURIComponent(loginErrorMessage))
  }

  // Login succeeded — check if the user has an incomplete signup stage
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) {
      await claimSharedClientPagesForUser({ userId: user.id, email: user.email })
    }
    const stage = user?.user_metadata?.signup_stage
    if (stage && stage !== 'complete') {
      if (stage === 'password_set') {
        redirect('/signup/account-setup')
      }
      // otp_sent/email_verified with a working password is unusual,
      // but route them to password step just in case
      redirect('/signup/password')
    }
  } catch (e) {
    if (isNextRedirectControlFlow(e)) throw e
  }

  // Get the redirect URL from the search params
  const redirectTo = formData.get('redirectTo') as string
  const redirectUrl = redirectTo ? decodeURIComponent(redirectTo) : '/'

  redirect(redirectUrl)
}

/** Accept workspace invite: create account (or add existing user to workspace) and redirect to login. */
export async function signupWithInvite(formData: FormData) {
  const token = formData.get('inviteToken') as string
  if (!token?.trim()) {
    redirect('/invite/accept?error=' + encodeURIComponent('Invalid or missing invitation.'))
  }

  const supabase = await createServiceClient()

  const { data: invite, error: inviteError } = await supabase
    .from('workspace_invitations')
    .select('id, email, role, expires_at, workspace_id')
    .eq('token', token.trim())
    .maybeSingle()

  if (inviteError || !invite) {
    redirect('/invite/accept?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent('Invitation not found or expired.'))
  }

  const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : 0
  if (Date.now() > expiresAt) {
    redirect('/invite/accept?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent('This invitation has expired.'))
  }

  const email = (formData.get('email') as string)?.toLowerCase()?.trim()
  const password = formData.get('password') as string
  const firstName = (formData.get('firstName') as string)?.trim() ?? ''
  const lastName = (formData.get('lastName') as string)?.trim() ?? ''

  if (!email || email !== invite.email) {
    redirect('/invite/accept?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent('Email does not match invitation.'))
  }
  if (!password || password.length < 8) {
    redirect('/invite/accept?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent('Password must be at least 8 characters.'))
  }

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile) {
    const { data: existingMembership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', existingProfile.id)
      .maybeSingle()

    if (existingMembership) {
      await supabase.from('workspace_invitations').delete().eq('id', invite.id)
      redirect('/login?message=' + encodeURIComponent('You are already in this workspace. Sign in to continue.') + '&email=' + encodeURIComponent(email))
    }

    try {
      await assertCanAddWorkspaceMember(invite.workspace_id, supabase)
    } catch (error) {
      redirect('/invite/accept?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent(error instanceof Error ? error.message : 'This workspace has no available seats right now.'))
    }

    const { error: memberErr } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invite.workspace_id,
        user_id: existingProfile.id,
        role: invite.role,
      })
    if (memberErr) {
      if (memberErr.code === '23505') {
        await supabase.from('workspace_invitations').delete().eq('id', invite.id)
        redirect('/login?message=' + encodeURIComponent('You are already in this workspace. Sign in to continue.') + '&email=' + encodeURIComponent(email))
      }
      redirect('/invite/accept?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent(memberErr.message))
    }
    await supabase.from('workspace_invitations').delete().eq('id', invite.id)
    const serverClient = await createClient()
    const { error: signInErr } = await serverClient.auth.signInWithPassword({ email, password })
    if (signInErr) {
      redirect('/login?message=' + encodeURIComponent('You have been added to the workspace. Sign in to continue.') + '&email=' + encodeURIComponent(email))
    }
    await claimSharedClientPagesForUser({ userId: existingProfile.id, email })
    await setCurrentWorkspaceAfterInvite(invite.workspace_id)
    redirect('/dashboard')
  }

  try {
    await assertCanAddWorkspaceMember(invite.workspace_id, supabase)
  } catch (error) {
    redirect('/invite/accept?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent(error instanceof Error ? error.message : 'This workspace has no available seats right now.'))
  }

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  })

  if (createError) {
    const msg = normalizeAuthErrorMessage(createError.message)
    redirect('/invite/accept?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent(msg))
  }

  if (!newUser.user?.id) {
    redirect('/invite/accept?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent('Account could not be created.'))
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  if (fullName) {
    await supabase.from('profiles').update({ name: fullName }).eq('id', newUser.user.id)
  }
  await claimSharedClientPagesForUser({ userId: newUser.user.id, email })

  const { error: memberErr } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: invite.workspace_id,
      user_id: newUser.user.id,
      role: invite.role,
    })

  if (memberErr) {
    redirect('/invite/accept?token=' + encodeURIComponent(token) + '&error=' + encodeURIComponent(memberErr.message))
  }

  await supabase.from('workspace_invitations').delete().eq('id', invite.id)

  const serverClient = await createClient()
  const { error: signInErr } = await serverClient.auth.signInWithPassword({ email, password })
  if (signInErr) {
    redirect('/login?message=' + encodeURIComponent('Account created. Sign in to join your workspace.') + '&email=' + encodeURIComponent(email))
  }
  await setCurrentWorkspaceAfterInvite(invite.workspace_id)
  redirect('/dashboard')
}
