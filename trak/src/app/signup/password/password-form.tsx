"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight } from "lucide-react";
import { setSignupPassword } from "@/lib/auth/signup-actions";

export default function PasswordForm({ error }: { error?: string }) {
  return (
    <AuthShell title="Create your password" subtitle="This will be your login credential.">
      {error && (
        <div className="mb-4 rounded-md border border-[var(--error)]/30 bg-[var(--error)]/10 px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </div>
      )}
      <form action={setSignupPassword} className="space-y-5">
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" name="password" type="password" placeholder="••••••••" required autoFocus />
            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-[var(--tertiary-foreground)]" />
          </div>
          <p className="mt-1 text-xs text-[var(--tertiary-foreground)]">
            8+ chars, at least one number and symbol.
          </p>
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" required />
            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-[var(--tertiary-foreground)]" />
          </div>
        </div>
        <Button type="submit" className="w-full">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
