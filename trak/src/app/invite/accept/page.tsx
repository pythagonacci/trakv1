import React from "react";
import { Mail, Lock, UserPlus, AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signupWithInvite } from "@/lib/auth/actions";
import { getInviteByToken } from "@/app/actions/invite";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function InviteAcceptPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = params?.token ?? "";
  const errorParam = params?.error ?? "";

  const invite = token ? await getInviteByToken(token) : null;

  if (!token) {
    return (
      <AuthShell title="Invalid invitation" subtitle="This invite link is missing or invalid.">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>No invitation token was provided. Use the link from your invitation email.</p>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
              Sign in
            </Link>{" "}
            if you already have an account.
          </p>
        </div>
      </AuthShell>
    );
  }

  if (!invite) {
    return (
      <AuthShell title="Invitation not found" subtitle="This invite may have been removed or the link is incorrect.">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>We couldn’t find this invitation. Ask your teammate to send a new one.</p>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
              Sign in
            </Link>{" "}
            or{" "}
            <Link href="/signup" className="font-medium text-[var(--primary)] hover:underline">
              create an account
            </Link>
            .
          </p>
        </div>
      </AuthShell>
    );
  }

  if (invite.expired) {
    return (
      <AuthShell title="Invitation expired" subtitle="This invite link has expired.">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>Invitations expire after 7 days. Ask someone from {invite.workspaceName} to send you a new invite.</p>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
              Sign in
            </Link>{" "}
            if you already have an account.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="You're invited"
      subtitle={`You have been invited to ${invite.workspaceName}. Create your account to join.`}
    >
      {errorParam && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{decodeURIComponent(errorParam)}</p>
        </div>
      )}
      <form action={signupWithInvite} className="space-y-5">
        <input type="hidden" name="inviteToken" value={token} />
        <input type="hidden" name="email" value={invite.email} />
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
            <Input
              id="email"
              type="email"
              defaultValue={invite.email}
              readOnly
              className="bg-[var(--surface)]"
              tabIndex={-1}
              aria-readonly
            />
            <Mail className="absolute right-3 top-2.5 h-4 w-4 text-[var(--tertiary-foreground)]" />
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            This is the email we sent the invite to.
          </p>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" name="password" type="password" placeholder="••••••••" required minLength={8} />
            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-[var(--tertiary-foreground)]" />
          </div>
          <p className="mt-1 text-xs text-[var(--tertiary-foreground)]">8+ characters recommended.</p>
        </div>
        <Button type="submit" className="w-full">
          <UserPlus className="h-4 w-4" /> Create account &amp; join {invite.workspaceName}
        </Button>
        <p className="text-xs text-[var(--muted-foreground)] text-center">
          Already have an account?{" "}
          <Link href={`/login?email=${encodeURIComponent(invite.email)}`} className="font-medium text-[var(--primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
