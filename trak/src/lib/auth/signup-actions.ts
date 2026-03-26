'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { claimSharedClientPagesForUser } from '@/lib/client-page-shares'

/**
 * Signup stage values stored in user_metadata.signup_stage:
 *   'otp_sent'        – OTP dispatched, awaiting verification
 *   'email_verified'  – OTP verified, password not yet set
 *   'password_set'    – password created, account setup incomplete
 *   'complete'        – fully onboarded
 *
 * Invite-created users never receive this field, so they pass through normally.
 * Legacy users also lack this field and are treated as complete.
 */

// ---------------------------------------------------------------------------
// Stage 1 — Send OTP
// ---------------------------------------------------------------------------

export async function sendSignupOtp(formData: FormData) {
  const email = (formData.get('email') as string)?.toLowerCase()?.trim()
  if (!email) {
    redirect('/signup?error=' + encodeURIComponent('Email is required.'))
  }

  // Detect existing complete users — redirect to login instead of re-entering signup
  const service = await createServiceClient()
  const { data: existingProfile } = await service
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile) {
    const { data: { user: existingUser } } = await service.auth.admin.getUserById(existingProfile.id)
    const stage = existingUser?.user_metadata?.signup_stage

    if (!stage || stage === 'complete') {
      // Fully completed user — send them to login
      redirect(
        '/login?message=' +
          encodeURIComponent('An account with this email already exists. Please sign in.') +
          '&email=' +
          encodeURIComponent(email),
      )
    }
    // Incomplete signup — fall through to resend OTP so they can continue
  }

  // If the user doesn't exist yet, pre-create via admin with email_confirm: true.
  // This avoids the "Confirm signup" email that signInWithOtp triggers when it
  // creates a new user with email confirmations enabled.
  if (!existingProfile) {
    const { error: createError } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { signup_stage: 'otp_sent' },
    })
    if (createError && !createError.message.includes('already been registered')) {
      redirect('/signup?error=' + encodeURIComponent(createError.message))
    }
  }

  // Now send the OTP code only (user already exists, no confirmation email)
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  })

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }

  // Persist email so the verify page knows who we're verifying
  const cookieStore = await cookies()
  cookieStore.set('signup_email', email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 3600, // 1 hour
    path: '/',
  })

  redirect('/signup/verify')
}

// ---------------------------------------------------------------------------
// Stage 2 — Verify OTP
// ---------------------------------------------------------------------------

export async function verifySignupOtp(formData: FormData) {
  const token = (formData.get('otp') as string)?.trim()
  const cookieStore = await cookies()
  const email = cookieStore.get('signup_email')?.value

  if (!email) {
    redirect('/signup?error=' + encodeURIComponent('Session expired. Please start again.'))
  }

  if (!token || token.length !== 6) {
    redirect('/signup/verify?error=' + encodeURIComponent('Please enter a valid 6-digit code.'))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    const msg = error.message.toLowerCase().includes('expired')
      ? 'Code expired. Please request a new one.'
      : error.message
    redirect('/signup/verify?error=' + encodeURIComponent(msg))
  }

  // User now has a session — advance stage
  await supabase.auth.updateUser({
    data: { signup_stage: 'email_verified' },
  })

  redirect('/signup/password')
}

// ---------------------------------------------------------------------------
// Resend OTP (called from client, returns result instead of redirecting)
// ---------------------------------------------------------------------------

export async function resendSignupOtp(): Promise<{ error?: string; success?: boolean }> {
  const cookieStore = await cookies()
  const email = cookieStore.get('signup_email')?.value

  if (!email) {
    return { error: 'Session expired. Please start signup again.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ email })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// Stage 3 — Set password
// ---------------------------------------------------------------------------

export async function setSignupPassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || password.length < 8) {
    redirect('/signup/password?error=' + encodeURIComponent('Password must be at least 8 characters.'))
  }

  if (password !== confirmPassword) {
    redirect('/signup/password?error=' + encodeURIComponent('Passwords do not match.'))
  }

  if (!/\d/.test(password) || !/[^a-zA-Z0-9\s]/.test(password)) {
    redirect('/signup/password?error=' + encodeURIComponent('Password must contain at least one number and one symbol.'))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/signup?error=' + encodeURIComponent('Session expired. Please start again.'))
  }

  const { error } = await supabase.auth.updateUser({
    password,
    data: { signup_stage: 'password_set' },
  })

  if (error) {
    redirect('/signup/password?error=' + encodeURIComponent(error.message))
  }

  redirect('/signup/account-setup')
}

// ---------------------------------------------------------------------------
// Stage 4 — Account setup (name + first workspace)
// ---------------------------------------------------------------------------

export async function completeAccountSetup(formData: FormData) {
  const firstName = (formData.get('firstName') as string)?.trim()
  const lastName = (formData.get('lastName') as string)?.trim()
  const workspaceName = (formData.get('workspaceName') as string)?.trim()

  if (!firstName || !lastName) {
    redirect('/signup/account-setup?error=' + encodeURIComponent('First and last name are required.'))
  }

  if (!workspaceName) {
    redirect('/signup/account-setup?error=' + encodeURIComponent('Workspace name is required.'))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/signup?error=' + encodeURIComponent('Session expired. Please start again.'))
  }

  // 1. Finalize user metadata
  const { error: metaError } = await supabase.auth.updateUser({
    data: { first_name: firstName, last_name: lastName, signup_stage: 'complete' },
  })
  if (metaError) {
    redirect('/signup/account-setup?error=' + encodeURIComponent(metaError.message))
  }

  // 2. Update profile name
  const fullName = `${firstName} ${lastName}`
  await supabase.from('profiles').update({ name: fullName }).eq('id', user.id)

  // 3. Create workspace + membership
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name: workspaceName, owner_id: user.id })
    .select('id')
    .single()

  if (wsError || !workspace) {
    redirect('/signup/account-setup?error=' + encodeURIComponent('Failed to create workspace.'))
  }

  await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'owner',
  })

  // 4. Set current workspace cookie + clean up signup cookie
  const cookieStore = await cookies()
  cookieStore.set('trak_current_workspace', workspace.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
  })
  cookieStore.delete('signup_email')
  await claimSharedClientPagesForUser({ userId: user.id, email: user.email })

  redirect('/dashboard')
}
