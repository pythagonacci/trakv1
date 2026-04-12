import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, Mail, Sparkles, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { beginPaidPlanSignup } from "@/lib/auth/signup-actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PaidPlan = "standard" | "business";

interface PageProps {
  searchParams: Promise<{ plan?: string; error?: string }>;
}

function normalizePaidPlan(value: string | undefined): PaidPlan | null {
  return value === "standard" || value === "business" ? value : null;
}

export default async function PaidPlanSignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const plan = normalizePaidPlan(params.plan);

  if (!plan) {
    redirect("/signup");
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    const stage = session.user?.user_metadata?.signup_stage;
    if (!stage || stage === "complete") redirect(`/billing/start?plan=${plan}`);
    if (stage === "otp_sent" || stage === "email_verified") redirect("/signup/password");
    if (stage === "password_set") redirect("/signup/account-setup");
  }

  const planLabel = plan === "business" ? "Business" : "Standard";
  const included = plan === "business"
    ? [
        "Unlimited workspaces for teams running more than one operation.",
        "Workspace-wide Everything, dashboard customization, and cross-project analytics.",
        "Stripe checkout opens after account setup.",
      ]
    : [
        "Unlimited projects, tabs, and blocks in your first workspace.",
        "Project templates and unlimited AI commands.",
        "Stripe checkout opens after account setup.",
      ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(204,233,221,0.9),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(240,213,171,0.55),transparent_32%),linear-gradient(180deg,#f7f2e8_0%,#f4efe5_48%,#efe7d8_100%)] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-10 px-6 py-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-10">
        <section className="max-w-xl space-y-8 pt-6 lg:pt-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-black/70 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            {planLabel} Plan
          </div>

          <div className="space-y-5">
            <h1 className="font-serif text-5xl leading-[0.94] tracking-[-0.03em] text-[#1d2a22] sm:text-6xl">
              Start {planLabel} with your first workspace.
            </h1>
            <p className="max-w-lg text-base leading-7 text-black/65 sm:text-lg">
              Create your account, set up the workspace, and continue to Stripe to activate {planLabel}.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-black/10 bg-white/75 p-5 shadow-[0_10px_40px_rgba(32,32,24,0.06)] backdrop-blur">
              <div className="text-sm font-semibold text-[#1d2a22]">What happens next</div>
              <ul className="mt-4 space-y-3 text-sm text-black/65">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1f7a4c]" />
                  We email you a 6-digit verification code.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1f7a4c]" />
                  You choose a password after verification.
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1f7a4c]" />
                  Your workspace continues to {planLabel} checkout.
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-[#244232] bg-[#163322] p-5 text-white shadow-[0_10px_40px_rgba(32,32,24,0.12)]">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Included</div>
              <div className="mt-4 space-y-3 text-sm leading-6">
                {included.map((item) => (
                  <p key={item} className="text-white">{item}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full max-w-xl justify-self-end">
          <div className="rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-[0_18px_70px_rgba(33,33,25,0.10)] backdrop-blur sm:p-8">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">Create account</div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#1d2a22]">Start {planLabel}</h2>
              <p className="text-sm leading-6 text-black/60">
                Step 1 of 3. We&apos;ll verify your email first, then finish account setup and open checkout.
              </p>
            </div>

            {params.error && (
              <div className="mt-6 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-800">
                {params.error}
              </div>
            )}

            <form action={beginPaidPlanSignup} className="mt-6 space-y-5">
              <input type="hidden" name="billingPlan" value={plan} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <div className="relative">
                    <Input id="firstName" name="firstName" placeholder="Ada" required autoFocus className="pr-10" />
                    <User2 className="absolute right-3 top-2.5 h-4 w-4 text-black/35" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" name="lastName" placeholder="Lovelace" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <div className="relative">
                  <Input id="email" name="email" type="email" placeholder="you@company.com" required className="pr-10" />
                  <Mail className="absolute right-3 top-2.5 h-4 w-4 text-black/35" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspaceName">Workspace name</Label>
                <div className="relative">
                  <Input id="workspaceName" name="workspaceName" placeholder="Acme Marketing" required className="pr-10" />
                  <Building2 className="absolute right-3 top-2.5 h-4 w-4 text-black/35" />
                </div>
              </div>

              <Button type="submit" className="h-12 w-full text-sm">
                Continue to {planLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-black/55">
              Already have an account?{" "}
              <Link href={`/login?redirectedFrom=${encodeURIComponent(`/billing/start?plan=${plan}`)}`} className="font-semibold text-[#1d2a22] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
