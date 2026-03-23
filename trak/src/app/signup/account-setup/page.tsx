import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/get-server-user";
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
  return <AccountSetupForm error={params.error} />;
}
