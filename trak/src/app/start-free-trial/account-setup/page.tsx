import { redirect } from "next/navigation";
import AccountSetupForm from "@/app/signup/account-setup/account-setup-form";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getSignupPrefill } from "@/lib/auth/signup-actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function StartFreeTrialAccountSetupPage({ searchParams }: PageProps) {
  const auth = await getServerUser();
  if (!auth) redirect("/start-free-trial");

  const stage = auth.user.user_metadata?.signup_stage;

  if (!stage || stage === "complete") redirect("/dashboard");
  if (stage === "otp_sent" || stage === "email_verified") redirect("/start-free-trial/password");

  const params = await searchParams;
  const prefill = await getSignupPrefill();

  return (
    <AccountSetupForm
      error={params.error}
      title="Create the first workspace"
      subtitle="Final step. Confirm the details below and we’ll launch the workspace on the Standard trial."
      submitLabel="Launch Standard trial"
      defaults={{
        firstName: prefill.firstName,
        lastName: prefill.lastName,
        workspaceName: prefill.workspaceName,
      }}
    />
  );
}
