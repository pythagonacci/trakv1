import React from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/auth/actions";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ redirectedFrom?: string; error?: string; message?: string }>;
}

function normalizeLoginErrorMessage(message?: string) {
  if (!message) {
    return undefined;
  }

  const lowered = message.toLowerCase();
  if (
    lowered.includes("unexpected token") &&
    (lowered.includes("<!doctype") || lowered.includes("not valid json"))
  ) {
    return "Auth service returned an invalid response. Verify your Supabase URL and keys.";
  }

  return message;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params?.error === "NEXT_REDIRECT") {
    if (params.redirectedFrom) {
      redirect(`/login?redirectedFrom=${encodeURIComponent(params.redirectedFrom)}`);
    }
    redirect("/login");
  }

  const redirectTo = params?.redirectedFrom || "/dashboard";
  const errorMessage = normalizeLoginErrorMessage(params?.error);
  const infoMessage = params?.message;
  
  return (
    <AuthShell title="Sign in" subtitle="Welcome back.">
      {errorMessage && (
        <div className="mb-4 rounded-md border border-[var(--error)]/30 bg-[var(--error)]/10 px-3 py-2 text-sm text-[var(--error)]">
          {errorMessage}
        </div>
      )}
      {infoMessage && (
        <div className="mb-4 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]">
          {infoMessage}
        </div>
      )}
      <form action={login} className="space-y-5">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input id="email" name="email" type="email" placeholder="you@company.com" required />
            <Mail className="absolute right-3 top-2.5 h-4 w-4 text-[var(--tertiary-foreground)]" />
          </div>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" name="password" type="password" placeholder="••••••••" required />
            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-[var(--tertiary-foreground)]" />
          </div>
        </div>
        <Button type="submit" className="w-full">
          <LogIn className="h-4 w-4" /> Sign in
        </Button>
        <p className="text-xs text-[var(--muted-foreground)] text-center">
          Don&apos;t have an account? <a href="/signup" className="font-medium text-[var(--primary)] hover:underline">Create one</a>
        </p>
      </form>
    </AuthShell>
  );
}
