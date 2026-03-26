import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/get-server-user";
import PasswordForm from "@/app/signup/password/password-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function StartFreeTrialPasswordPage({ searchParams }: PageProps) {
  const auth = await getServerUser();
  if (!auth) redirect("/start-free-trial");

  const stage = auth.user.user_metadata?.signup_stage;

  if (!stage || stage === "complete") redirect("/dashboard");
  if (stage === "password_set") redirect("/start-free-trial/account-setup");

  const params = await searchParams;

  return (
    <PasswordForm
      error={params.error}
      title="Create your password"
      subtitle="Step 2 of 3. Set the password you’ll use to access your workspace."
      submitLabel="Continue to workspace setup"
    />
  );
}
