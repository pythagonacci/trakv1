import React from "react";
import { redirect } from "next/navigation";
import { Mail, ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { sendSignupOtp } from "@/lib/auth/signup-actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignupPage({ searchParams }: PageProps) {
  // If user is already authenticated, route them to the right place
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const stage = session.user?.user_metadata?.signup_stage;
    if (!stage || stage === "complete") redirect("/dashboard");
    if (stage === "otp_sent" || stage === "email_verified") redirect("/signup/password");
    if (stage === "password_set") redirect("/signup/account-setup");
  }

  const params = await searchParams;

  return (
    <AuthShell title="Create account" subtitle="Enter your email to get started.">
      {params.error && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--error)]/30 bg-[var(--error)]/10 px-3 py-2 text-sm text-[var(--error)]">
          {params.error}
        </div>
      )}
      <form action={sendSignupOtp} className="space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input id="email" name="email" type="email" placeholder="you@company.com" required autoFocus />
            <Mail className="absolute right-3 top-2.5 h-4 w-4 text-[var(--tertiary-foreground)]" />
          </div>
        </div>
        <Button type="submit" className="w-full">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-[var(--muted-foreground)] text-center">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-[var(--primary)] hover:underline">
            Sign in
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
