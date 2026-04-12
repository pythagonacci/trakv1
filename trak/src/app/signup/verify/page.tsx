import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSignupPrefill } from "@/lib/auth/signup-actions";
import VerifyForm from "./verify-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  // If user already has a session with a later stage, skip ahead
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const stage = session.user?.user_metadata?.signup_stage;
    if (!stage || stage === "complete") redirect("/dashboard");
    if (stage === "email_verified" || stage === "otp_sent") redirect("/signup/password");
    if (stage === "password_set") redirect("/signup/account-setup");
  }

  // Email must be in the signup cookie
  const cookieStore = await cookies();
  const email = cookieStore.get("signup_email")?.value;

  if (!email) {
    redirect("/signup");
  }

  const params = await searchParams;
  const prefill = await getSignupPrefill();
  const planLabel = prefill.billingPlan === "business" ? "Business" : prefill.billingPlan === "standard" ? "Standard" : null;

  if (planLabel) {
    return (
      <VerifyForm
        email={email}
        error={params.error}
        message={params.message}
        title="Verify your work email"
        subtitle={`Enter the 6-digit code we sent to continue into ${planLabel} setup.`}
      />
    );
  }

  return <VerifyForm email={email} error={params.error} message={params.message} />;
}
