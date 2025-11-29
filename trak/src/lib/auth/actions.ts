'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

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

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    console.error('Signup error:', error.message)
    // You could redirect to an error page or handle this differently
    redirect('/signup?error=' + encodeURIComponent(error.message))
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

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.error('Login error:', error.message)
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // Get the redirect URL from the search params
  const redirectTo = formData.get('redirectTo') as string
  const redirectUrl = redirectTo ? decodeURIComponent(redirectTo) : '/'
  
  redirect(redirectUrl)
}

