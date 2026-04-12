import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getSignupPrefill } from "@/lib/auth/signup-actions";
import AccountSetupForm from "./account-setup-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AccountSetupPage({ searchParams }: PageProps) {
  const auth = await getServerUser();
  if (!auth) redirect("/signup");

  const stage = auth.user.user_metadata?.signup_stage;

  // Complete or legacy users — go to dashboard
  if (!stage || stage === "complete") redirect("/dashboard");
  // Still need to set password first
  if (stage === "otp_sent" || stage === "email_verified") redirect("/signup/password");

  const params = await searchParams;
  const prefill = await getSignupPrefill();
  const billingPlan = prefill.billingPlan;
  const planLabel = billingPlan === "business" ? "Business" : billingPlan === "standard" ? "Standard" : null;

  if (planLabel) {
    return (
      <AccountSetupForm
        error={params.error}
        title={`Create the ${planLabel} workspace`}
        subtitle="Final step. Confirm the details below and we’ll continue to checkout."
        submitLabel={`Continue to ${planLabel} checkout`}
        defaults={{
          firstName: prefill.firstName,
          lastName: prefill.lastName,
          workspaceName: prefill.workspaceName,
        }}
      />
    );
  }

  return <AccountSetupForm error={params.error} />;
}
