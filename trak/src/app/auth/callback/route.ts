import { createClient } from '@/lib/supabase/server'
import { claimSharedClientPagesForUser } from '@/lib/client-page-shares'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const signupBasePath = request.cookies.get('signup_flow')?.value === 'free_trial'
    ? '/start-free-trial'
    : '/signup'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if this is a signup flow user (magic link from OTP email)
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        await claimSharedClientPagesForUser({ userId: user.id, email: user.email })
      }
      const stage = user?.user_metadata?.signup_stage

      if (stage && stage !== 'complete') {
        // Advance stage if still on otp_sent (they used the magic link to verify)
        if (stage === 'otp_sent') {
          await supabase.auth.updateUser({
            data: { signup_stage: 'email_verified' },
          })
        }

        // Route to the correct signup step
        const updatedStage = stage === 'otp_sent' ? 'email_verified' : stage
        if (updatedStage === 'email_verified') {
          return NextResponse.redirect(`${origin}${signupBasePath}/password`)
        }
        if (updatedStage === 'password_set') {
          return NextResponse.redirect(`${origin}${signupBasePath}/account-setup`)
        }
      }

      // Normal completed user — follow the `next` param
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
