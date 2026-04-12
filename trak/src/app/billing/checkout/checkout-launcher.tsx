"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaidPlan = "standard" | "business";

interface CheckoutLauncherProps {
  plan: PaidPlan;
  workspaceId: string;
}

export default function CheckoutLauncher({ plan, workspaceId }: CheckoutLauncherProps) {
  const [error, setError] = useState<string | null>(null);
  const planLabel = plan === "business" ? "Business" : "Standard";

  useEffect(() => {
    let cancelled = false;

    async function startCheckout() {
      setError(null);

      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            workspaceId,
            planKey: plan,
            skipTrial: true,
          }),
        });
        const json = await response.json();

        if (cancelled) return;

        if (!response.ok || !json?.data?.url) {
          throw new Error(json?.error || "Failed to open checkout.");
        }

        window.location.href = json.data.url;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to open checkout.");
        }
      }
    }

    startCheckout();

    return () => {
      cancelled = true;
    };
  }, [plan, workspaceId]);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--error)]/30 bg-[var(--error)]/10 px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={() => window.location.reload()} className="w-full sm:w-auto">
            Try again
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard/settings?tab=general">Open billing settings</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      Opening {planLabel} checkout...
    </div>
  );
}
