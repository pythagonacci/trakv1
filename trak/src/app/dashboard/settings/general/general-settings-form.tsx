"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceBillingSummary } from "@/hooks/use-workspace-billing";

interface GeneralSettingsFormProps {
  workspaceId: string;
  workspaceName: string;
  canManage: boolean;
  canManageManualBillingOverrides: boolean;
  billingSummary: WorkspaceBillingSummary;
}

export default function GeneralSettingsForm({
  workspaceId,
  workspaceName,
  canManage,
  canManageManualBillingOverrides,
  billingSummary,
}: GeneralSettingsFormProps) {
  const router = useRouter();
  const planKey = billingSummary.entitlements.planKey;
  const billingStatus = billingSummary.entitlements.billingStatus;
  const manualPlanKey = billingSummary.entitlements.manualPlanKey;
  const isManualOverride = billingSummary.entitlements.isManualOverride;
  const manualPlanNote = billingSummary.entitlements.manualPlanNote;
  const manualPlanSetAt = billingSummary.entitlements.manualPlanSetAt;
  const manualPlanSetByEmail = billingSummary.entitlements.manualPlanSetByEmail;
  const isAppManagedTrial = billingSummary.entitlements.isAppManagedTrial;
  const canStartStandardTrial = billingSummary.entitlements.canStartStandardTrial;
  const trialEndsAt = billingSummary.entitlements.trialEndsAt;
  const activeMemberCount = billingSummary.seatCount;
  const purchasedSeatCount = Math.max(billingSummary.billing.seat_quantity ?? 1, 1);
  const displayedSeatCount = planKey === "free" || isAppManagedTrial ? activeMemberCount : purchasedSeatCount;
  const minimumSeatQuantity = Math.max(activeMemberCount, 1);
  const [name, setName] = useState(workspaceName);
  const [seatQuantity, setSeatQuantity] = useState(String(Math.max(displayedSeatCount, minimumSeatQuantity)));
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirectingBilling, setIsRedirectingBilling] = useState<"checkout_standard" | "checkout_business" | "portal" | "update_seats" | null>(null);
  const [manualOverridePlan, setManualOverridePlan] = useState<"" | "standard" | "business">(manualPlanKey ?? "");
  const [manualOverrideNote, setManualOverrideNote] = useState(manualPlanNote ?? "");
  const [isSubmittingManualOverride, setIsSubmittingManualOverride] = useState(false);

  const isDirty = name.trim() !== workspaceName;
  const parsedSeatQuantity = Number.parseInt(seatQuantity, 10);
  const aiUsageLabel = billingSummary.usage.commandLimit == null
    ? "Unlimited AI commands on this plan"
    : `${billingSummary.usage.commandsUsed} / ${billingSummary.usage.commandLimit} AI commands used today`;

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage]);

  useEffect(() => {
    setSeatQuantity(String(Math.max(displayedSeatCount, minimumSeatQuantity)));
  }, [displayedSeatCount, minimumSeatQuantity]);

  useEffect(() => {
    setManualOverridePlan(manualPlanKey ?? "");
    setManualOverrideNote(manualPlanNote ?? "");
  }, [manualPlanKey, manualPlanNote]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }

    if (!isDirty) {
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("workspaces")
        .update({
          name: name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);

      if (updateError) {
        setError("Failed to update workspace name");
        setIsSubmitting(false);
        return;
      }

      // Success
      setSuccessMessage("Workspace settings updated successfully");
      setIsSubmitting(false);
      router.refresh();
    } catch (err) {
      setError("Failed to update workspace. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleBillingAction = async (action: "checkout_standard" | "checkout_business" | "portal" | "update_seats") => {
    setError(null);
    setSuccessMessage(null);
    setIsRedirectingBilling(action);

    try {
      if (action !== "portal") {
        if (!Number.isInteger(parsedSeatQuantity) || parsedSeatQuantity < minimumSeatQuantity) {
          throw new Error(`Seats must be at least ${minimumSeatQuantity}.`);
        }
      }

      const endpoint = action === "portal"
        ? "/api/billing/portal"
        : action === "update_seats"
          ? "/api/billing/seats"
          : "/api/billing/checkout";
      const payload = action === "portal"
        ? { workspaceId }
        : action === "update_seats"
          ? { workspaceId, seatQuantity: parsedSeatQuantity }
          : { workspaceId, planKey: action === "checkout_business" ? "business" : "standard", seatQuantity: parsedSeatQuantity };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (action === "update_seats") {
        if (!response.ok) {
          throw new Error(json?.error || "Failed to update seats");
        }
        router.refresh();
        setIsRedirectingBilling(null);
        return;
      }

      if (json?.data?.mode === "trial_started") {
        setSuccessMessage("Standard trial started");
        setIsRedirectingBilling(null);
        router.refresh();
        return;
      }

      if (!response.ok || !json?.data?.url) {
        throw new Error(json?.error || "Failed to open billing flow");
      }

      window.location.href = json.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing flow");
      setIsRedirectingBilling(null);
    }
  };

  const handleManualOverrideSubmit = async (clearOverride = false) => {
    setError(null);
    setSuccessMessage(null);

    if (!clearOverride && !manualOverridePlan) {
      setError("Choose a plan to apply a manual override.");
      return;
    }

    setIsSubmittingManualOverride(true);

    try {
      const response = await fetch("/api/internal/billing/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          workspaceId,
          planKey: clearOverride ? "" : manualOverridePlan,
          note: clearOverride ? "" : manualOverrideNote,
          clearOverride,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Failed to update manual billing override");
      }

      setSuccessMessage(clearOverride ? "Manual billing override cleared" : "Manual billing override updated");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update manual billing override");
    } finally {
      setIsSubmittingManualOverride(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">General Settings</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          Manage your workspace name and settings
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{successMessage}</p>
          </div>
        )}

        {/* Workspace Name Card */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="workspace-name" className="block text-sm font-medium">
              Workspace Name
            </label>
            <input
              id="workspace-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
              disabled={!canManage || isSubmitting}
              className="w-full px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--river-indigo)]/50 focus:border-[var(--river-indigo)] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {!canManage && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Only owners and admins can edit workspace settings
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium">Billing</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Plan <span className="capitalize text-[var(--foreground)]">{planKey}</span>{isManualOverride ? " (manual override)" : ""} · Billing status <span className="text-[var(--foreground)]">{billingStatus}</span>
            </p>
            {isManualOverride && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Override grants <span className="capitalize text-[var(--foreground)]">{manualPlanKey}</span>
                {manualPlanSetAt ? ` since ${new Date(manualPlanSetAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                {manualPlanSetByEmail ? ` by ${manualPlanSetByEmail}` : ""}.
              </p>
            )}
            {isManualOverride && manualPlanNote && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Note: <span className="text-[var(--foreground)]">{manualPlanNote}</span>
              </p>
            )}
            {isAppManagedTrial && trialEndsAt && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Your Standard trial ends <span className="text-[var(--foreground)]">{new Date(trialEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>. Add a payment method before then to keep Standard.
              </p>
            )}
            {planKey === "free" ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Current Members: <span className="text-[var(--foreground)]">{activeMemberCount}</span>
              </p>
            ) : isAppManagedTrial ? (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Active members <span className="text-[var(--foreground)]">{activeMemberCount}</span> · You can choose how many seats to buy when you add a payment method.
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Purchased seats <span className="text-[var(--foreground)]">{displayedSeatCount}</span> · Active members <span className="text-[var(--foreground)]">{activeMemberCount}</span>
              </p>
            )}
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {aiUsageLabel}
            </p>
            {billingSummary.billing.current_period_end && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Current period ends {new Date(billingSummary.billing.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>

          {canManage && (
            <>
              <div className="space-y-2">
                <label htmlFor="seat-quantity" className="block text-sm font-medium">
                  {planKey === "free" || isAppManagedTrial ? "Seats to purchase" : "Purchased seats"}
                </label>
                <input
                  id="seat-quantity"
                  type="number"
                  inputMode="numeric"
                  min={minimumSeatQuantity}
                  step={1}
                  value={seatQuantity}
                  onChange={(e) => setSeatQuantity(e.target.value)}
                  disabled={isRedirectingBilling !== null}
                  className="w-full max-w-[180px] px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--river-indigo)]/50 focus:border-[var(--river-indigo)] disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-[var(--muted-foreground)]">
                  Seats can be higher than your current member count, but never lower than {minimumSeatQuantity}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {planKey === "free" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBillingAction("checkout_standard")}
                      disabled={isRedirectingBilling !== null}
                      className="px-4 py-2 text-sm font-medium text-white bg-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/90 rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
                    >
                      {isRedirectingBilling === "checkout_standard"
                        ? "Opening..."
                        : canStartStandardTrial
                          ? "Start 14-Day Standard Trial"
                          : "Upgrade to Standard"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBillingAction("checkout_business")}
                      disabled={isRedirectingBilling !== null}
                      className="px-4 py-2 text-sm font-medium border border-[var(--border)] hover:bg-[var(--surface-hover)] rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
                    >
                      {isRedirectingBilling === "checkout_business" ? "Opening..." : "Upgrade to Business"}
                    </button>
                  </>
                )}

                {planKey === "standard" && (
                  <>
                    {!isAppManagedTrial && (
                      <button
                        type="button"
                        onClick={() => handleBillingAction("update_seats")}
                        disabled={isRedirectingBilling !== null}
                        className="px-4 py-2 text-sm font-medium text-white bg-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/90 rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
                      >
                        {isRedirectingBilling === "update_seats" ? "Saving..." : "Update Seats"}
                      </button>
                    )}
                    {billingSummary.billing.stripe_customer_id && !isAppManagedTrial && (
                      <button
                        type="button"
                        onClick={() => handleBillingAction("portal")}
                        disabled={isRedirectingBilling !== null}
                        className="px-4 py-2 text-sm font-medium border border-[var(--border)] hover:bg-[var(--surface-hover)] rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
                      >
                        {isRedirectingBilling === "portal" ? "Opening..." : "Manage Billing"}
                      </button>
                    )}
                    {isAppManagedTrial && (
                      <button
                        type="button"
                        onClick={() => handleBillingAction("checkout_standard")}
                        disabled={isRedirectingBilling !== null}
                        className="px-4 py-2 text-sm font-medium text-white bg-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/90 rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
                      >
                        {isRedirectingBilling === "checkout_standard" ? "Opening..." : "Add Payment Method to Keep Standard"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleBillingAction("checkout_business")}
                      disabled={isRedirectingBilling !== null}
                      className="px-4 py-2 text-sm font-medium border border-[var(--border)] hover:bg-[var(--surface-hover)] rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
                    >
                      {isRedirectingBilling === "checkout_business" ? "Opening..." : "Upgrade to Business"}
                    </button>
                  </>
                )}

                {planKey === "business" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBillingAction("update_seats")}
                      disabled={isRedirectingBilling !== null}
                      className="px-4 py-2 text-sm font-medium text-white bg-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/90 rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
                    >
                      {isRedirectingBilling === "update_seats" ? "Saving..." : "Update Seats"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBillingAction("portal")}
                      disabled={isRedirectingBilling !== null}
                      className="px-4 py-2 text-sm font-medium border border-[var(--border)] hover:bg-[var(--surface-hover)] rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
                    >
                      {isRedirectingBilling === "portal" ? "Opening..." : "Manage Billing"}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {canManageManualBillingOverrides && (
          <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50/70 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-amber-950">Internal Manual Plan Override</h3>
              <p className="mt-1 text-sm text-amber-900/80">
                This bypasses Stripe and grants paid plan access directly from the billing record for this workspace.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="manual-override-plan" className="block text-sm font-medium text-amber-950">
                Override plan
              </label>
              <select
                id="manual-override-plan"
                value={manualOverridePlan}
                onChange={(e) => setManualOverridePlan(e.target.value as "" | "standard" | "business")}
                disabled={isSubmittingManualOverride}
                className="w-full max-w-[220px] px-3 py-2.5 rounded-[var(--radius-md)] border border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50"
              >
                <option value="">No override</option>
                <option value="standard">Standard</option>
                <option value="business">Business</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="manual-override-note" className="block text-sm font-medium text-amber-950">
                Internal note
              </label>
              <textarea
                id="manual-override-note"
                value={manualOverrideNote}
                onChange={(e) => setManualOverrideNote(e.target.value)}
                disabled={isSubmittingManualOverride}
                rows={3}
                placeholder="Why this workspace is being comped or upgraded manually"
                className="w-full rounded-[var(--radius-md)] border border-amber-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleManualOverrideSubmit(false)}
                disabled={isSubmittingManualOverride || !manualOverridePlan}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
              >
                {isSubmittingManualOverride ? "Saving..." : isManualOverride ? "Update Manual Override" : "Apply Manual Override"}
              </button>
              <button
                type="button"
                onClick={() => handleManualOverrideSubmit(true)}
                disabled={isSubmittingManualOverride || !isManualOverride}
                className="px-4 py-2 text-sm font-medium border border-amber-300 text-amber-950 hover:bg-amber-100 rounded-[var(--radius-md)] transition-colors disabled:opacity-50"
              >
                Clear Override
              </button>
            </div>
          </div>
        )}

        {/* Save Button */}
        {canManage && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--river-indigo)] hover:bg-[var(--river-indigo)]/90 rounded-[var(--radius-md)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </form>

      {/* Future Settings Placeholder */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <h3 className="text-sm font-medium mb-2">Additional Settings</h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          More workspace settings coming soon
        </p>
      </div>
    </div>
  );
}
