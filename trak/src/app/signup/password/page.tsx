import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/get-server-user";
import PasswordForm from "./password-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function PasswordPage({ searchParams }: PageProps) {
  const auth = await getServerUser();
  if (!auth) redirect("/signup");

  const stage = auth.user.user_metadata?.signup_stage;

  // Complete or legacy users — go to dashboard
  if (!stage || stage === "complete") redirect("/dashboard");
  // Already set password — go to account setup
  if (stage === "password_set") redirect("/signup/account-setup");

  const params = await searchParams;
  return <PasswordForm error={params.error} />;
}
