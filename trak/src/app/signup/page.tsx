import React from "react";
import { Mail, Lock, UserPlus } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signup } from "@/lib/auth/actions";

export default function SignupPage() {
  return (
    <AuthShell title="Create account" subtitle="Start your workspace.">
      <form action={signup} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" placeholder="Ada" required />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" placeholder="Lovelace" required />
          </div>
        </div>
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
          <p className="mt-1 text-xs text-[var(--tertiary-foreground)]">8+ chars, at least one number and symbol.</p>
        </div>
        <Button type="submit" className="w-full">
          <UserPlus className="h-4 w-4" /> Create account
        </Button>
        <p className="text-xs text-[var(--muted-foreground)] text-center">
          Already have an account? <a href="/login" className="font-medium text-[var(--primary)] hover:underline">Sign in</a>
        </p>
      </form>
    </AuthShell>
  );
}