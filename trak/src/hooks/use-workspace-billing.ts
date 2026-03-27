"use client";

import { useQuery } from "@tanstack/react-query";

export interface WorkspaceBillingSummary {
  billing: {
    workspace_id: string;
    plan_key: "free" | "standard" | "business";
    billing_status: string;
    manual_plan_key: "standard" | "business" | null;
    manual_plan_note: string | null;
    manual_plan_set_at: string | null;
    manual_plan_set_by_email: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    seat_quantity: number;
    cancel_at_period_end: boolean;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    trial_ending_reminder_sent_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
  };
  entitlements: {
    workspaceId: string;
    planKey: "free" | "standard" | "business";
    billingStatus: string;
    manualPlanKey: "standard" | "business" | null;
    isManualOverride: boolean;
    manualPlanNote: string | null;
    manualPlanSetAt: string | null;
    manualPlanSetByEmail: string | null;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    hasUsedStandardTrial: boolean;
    canStartStandardTrial: boolean;
    isAppManagedTrial: boolean;
    aiDailyCommandLimit: number | null;
    allowEverythingPage: boolean;
    allowDashboardConfiguration: boolean;
    allowWorkspaceScopeCharts: boolean;
    allowProjectTemplates: boolean;
  };
  usage: {
    date: string;
    commandsUsed: number;
    commandLimit: number | null;
  };
  seatCount: number;
}

export function useWorkspaceBilling(workspaceId?: string | null) {
  return useQuery({
    queryKey: ["workspaceBilling", workspaceId],
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
    queryFn: async (): Promise<WorkspaceBillingSummary | null> => {
      const response = await fetch("/api/billing/workspace", {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load workspace billing");
      }

      const json = await response.json();
      return json?.data ?? null;
    },
  });
}
