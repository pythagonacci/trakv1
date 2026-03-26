"use client";

import { useState, useEffect, useTransition } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldCheck, RotateCw } from "lucide-react";
import { verifySignupOtp, resendSignupOtp } from "@/lib/auth/signup-actions";

interface VerifyFormProps {
  email: string;
  error?: string;
  message?: string;
  title?: string;
  subtitle?: string;
}

export default function VerifyForm({
  email,
  error,
  message,
  title = "Verify your email",
  subtitle,
}: VerifyFormProps) {
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = () => {
    setResendMessage(null);
    setResendError(null);
    startTransition(async () => {
      const result = await resendSignupOtp();
      if (result.error) {
        setResendError(result.error);
      } else {
        setResendMessage("A new code has been sent.");
        setResendCooldown(60);
      }
    });
  };

  // Mask middle of email for display
  const maskedEmail = email.replace(
    /^(.{2})(.*)(@.*)$/,
    (_, a, b, c) => a + "\u2022".repeat(Math.min(b.length, 6)) + c,
  );

  return (
    <AuthShell title={title} subtitle={subtitle ?? `Enter the 6-digit code sent to ${maskedEmail}`}>
      {error && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--error)]/30 bg-[var(--error)]/10 px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </div>
      )}
      {(message || resendMessage) && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]">
          {resendMessage || message}
        </div>
      )}
      {resendError && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--error)]/30 bg-[var(--error)]/10 px-3 py-2 text-sm text-[var(--error)]">
          {resendError}
        </div>
      )}
      <form action={verifySignupOtp} className="space-y-5">
        <div>
          <Label htmlFor="otp">Verification code</Label>
          <Input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            required
            autoFocus
            autoComplete="one-time-code"
            className="text-center text-lg tracking-[0.3em] font-mono"
          />
        </div>
        <Button type="submit" className="w-full">
          <ShieldCheck className="h-4 w-4" /> Verify
        </Button>
        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isPending}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-1">
                <RotateCw className="h-3 w-3 animate-spin" /> Sending&hellip;
              </span>
            ) : resendCooldown > 0 ? (
              `Resend code in ${resendCooldown}s`
            ) : (
              "Didn\u2019t get a code? Resend"
            )}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
