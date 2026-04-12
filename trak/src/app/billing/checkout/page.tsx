import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { createClient } from "@/lib/supabase/server";
import CheckoutLauncher from "./checkout-launcher";

type PaidPlan = "standard" | "business";

interface PageProps {
  searchParams: Promise<{ plan?: string; workspaceId?: string }>;
}

function normalizePaidPlan(value: string | undefined): PaidPlan | null {
  return value === "standard" || value === "business" ? value : null;
}

export const dynamic = "force-dynamic";

export default async function BillingCheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const plan = normalizePaidPlan(params.plan);

  if (!plan) {
    redirect("/signup");
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/billing/start?plan=${plan}`);
  }

  const stage = session.user?.user_metadata?.signup_stage;
  if (stage && stage !== "complete") {
    if (stage === "otp_sent" || stage === "email_verified") redirect("/signup/password");
    if (stage === "password_set") redirect("/signup/account-setup");
  }

  const workspaceId = params.workspaceId || (await getCurrentWorkspaceId());
  const planLabel = plan === "business" ? "Business" : "Standard";

  if (!workspaceId) {
    return (
      <AuthShell
        title={`Start ${planLabel}`}
        subtitle="Create or choose a workspace before opening checkout."
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            We could not find an active workspace for this account.
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Start ${planLabel}`}
      subtitle="We are sending you to Stripe Checkout."
    >
      <CheckoutLauncher plan={plan} workspaceId={workspaceId} />
    </AuthShell>
  );
}
