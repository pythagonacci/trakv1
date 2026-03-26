"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";
import { completeAccountSetup } from "@/lib/auth/signup-actions";

interface AccountSetupFormProps {
  error?: string;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  defaults?: {
    firstName?: string;
    lastName?: string;
    workspaceName?: string;
  };
}

export default function AccountSetupForm({
  error,
  title = "Set up your account",
  subtitle = "Almost there. Tell us about yourself.",
  submitLabel = "Launch workspace",
  defaults,
}: AccountSetupFormProps) {
  return (
    <AuthShell title={title} subtitle={subtitle}>
      {error && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--error)]/30 bg-[var(--error)]/10 px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </div>
      )}
      <form action={completeAccountSetup} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" placeholder="Ada" required autoFocus defaultValue={defaults?.firstName} />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" placeholder="Lovelace" required defaultValue={defaults?.lastName} />
          </div>
        </div>
        <div>
          <Label htmlFor="workspaceName">Workspace name</Label>
          <div className="relative">
            <Input id="workspaceName" name="workspaceName" placeholder="My Company" required defaultValue={defaults?.workspaceName} />
            <Building2 className="absolute right-3 top-2.5 h-4 w-4 text-[var(--tertiary-foreground)]" />
          </div>
          <p className="mt-1 text-xs text-[var(--tertiary-foreground)]">You can rename this later.</p>
        </div>
        <Button type="submit" className="w-full">
          {submitLabel} <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
