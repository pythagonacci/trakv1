'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        first_name: formData.get('firstName') as string,
        last_name: formData.get('lastName') as string,
      },
    },
  }

  let signupErrorMessage: string | null = null

  try {
    const { error } = await withTimeout(
      supabase.auth.signUp(data),
      AUTH_REQUEST_TIMEOUT_MS,
      "Supabase auth request",
    )
    if (error) {
      console.error('Signup error:', error.message)
      signupErrorMessage = normalizeAuthErrorMessage(error.message)
    }
  } catch (error) {
    if (isNextRedirectControlFlow(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : "Signup failed";
    console.error('Signup request failed:', message)
    signupErrorMessage = normalizeAuthErrorMessage(message)
  }

  if (signupErrorMessage) {
    redirect('/signup?error=' + encodeURIComponent(signupErrorMessage))
  }

  // Redirect to login page with success message
  redirect('/login?message=Check your email to confirm your account')
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
    redirect('/login?error=' + encodeURIComponent(loginErrorMessage))
  }

  // Get the redirect URL from the search params
  const redirectTo = formData.get('redirectTo') as string
  const redirectUrl = redirectTo ? decodeURIComponent(redirectTo) : '/'
  
  redirect(redirectUrl)
}
