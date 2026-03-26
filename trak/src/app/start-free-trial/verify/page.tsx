import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VerifyForm from "@/app/signup/verify/verify-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

export default async function StartFreeTrialVerifyPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    const stage = session.user?.user_metadata?.signup_stage;
    if (!stage || stage === "complete") redirect("/dashboard");
    if (stage === "email_verified" || stage === "otp_sent") redirect("/start-free-trial/password");
    if (stage === "password_set") redirect("/start-free-trial/account-setup");
  }

  const cookieStore = await cookies();
  const email = cookieStore.get("signup_email")?.value;

  if (!email) {
    redirect("/start-free-trial");
  }

  const params = await searchParams;

  return (
    <VerifyForm
      email={email}
      error={params.error}
      message={params.message}
      title="Verify your work email"
      subtitle="Enter the 6-digit code we sent to continue into your Standard trial setup."
    />
  );
}
