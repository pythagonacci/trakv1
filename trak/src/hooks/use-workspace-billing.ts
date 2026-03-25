"use client";

import { useQuery } from "@tanstack/react-query";

export interface WorkspaceBillingSummary {
  billing: {
    workspace_id: string;
    plan_key: "free" | "standard" | "business";
    billing_status: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    seat_quantity: number;
    cancel_at_period_end: boolean;
    current_period_start: string | null;
    current_period_end: string | null;
  };
  entitlements: {
    workspaceId: string;
    planKey: "free" | "standard" | "business";
    billingStatus: string;
    aiDailyCommandLimit: number | null;
    allowEverythingPage: boolean;
    allowDashboardConfiguration: boolean;
    allowWorkspaceScopeCharts: boolean;
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
