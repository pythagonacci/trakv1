export type PlanKey = "free" | "standard" | "business";

export type BillingStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "canceled";

export interface WorkspaceEntitlements {
  workspaceId: string;
  planKey: PlanKey;
  billingStatus: BillingStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  hasUsedStandardTrial: boolean;
  canStartStandardTrial: boolean;
  isAppManagedTrial: boolean;
  maxWorkspaces: number | null;
  maxProjectsPerWorkspace: number | null;
  maxTopLevelTabsPerProject: number | null;
  maxTopLevelBlocksPerTab: number | null;
  aiDailyCommandLimit: number | null;
  allowEverythingPage: boolean;
  allowDashboardConfiguration: boolean;
  allowWorkspaceScopeCharts: boolean;
  allowCrossProjectAnalytics: boolean;
  allowCrossProjectAI: boolean;
  seatQuantity: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

const ACTIVE_PAID_STATUSES = new Set<BillingStatus>(["trialing", "active", "past_due", "incomplete"]);

export const STANDARD_TRIAL_DAYS = 14;
export const STANDARD_TRIAL_ENDING_REMINDER_DAYS = 3;

export const PLAN_DEFINITIONS: Record<PlanKey, Omit<WorkspaceEntitlements, "workspaceId" | "planKey" | "billingStatus" | "trialStartedAt" | "trialEndsAt" | "hasUsedStandardTrial" | "canStartStandardTrial" | "isAppManagedTrial" | "seatQuantity" | "cancelAtPeriodEnd" | "currentPeriodStart" | "currentPeriodEnd">> = {
  free: {
    maxWorkspaces: 1,
    maxProjectsPerWorkspace: 3,
    maxTopLevelTabsPerProject: 3,
    maxTopLevelBlocksPerTab: 15,
    aiDailyCommandLimit: 5,
    allowEverythingPage: false,
    allowDashboardConfiguration: false,
    allowWorkspaceScopeCharts: false,
    allowCrossProjectAnalytics: false,
    allowCrossProjectAI: false,
  },
  standard: {
    maxWorkspaces: 1,
    maxProjectsPerWorkspace: null,
    maxTopLevelTabsPerProject: null,
    maxTopLevelBlocksPerTab: null,
    aiDailyCommandLimit: null,
    allowEverythingPage: false,
    allowDashboardConfiguration: false,
    allowWorkspaceScopeCharts: false,
    allowCrossProjectAnalytics: false,
    allowCrossProjectAI: false,
  },
  business: {
    maxWorkspaces: null,
    maxProjectsPerWorkspace: null,
    maxTopLevelTabsPerProject: null,
    maxTopLevelBlocksPerTab: null,
    aiDailyCommandLimit: null,
    allowEverythingPage: true,
    allowDashboardConfiguration: true,
    allowWorkspaceScopeCharts: true,
    allowCrossProjectAnalytics: true,
    allowCrossProjectAI: true,
  },
};

export function isPaidBillingStatus(status: BillingStatus) {
  return ACTIVE_PAID_STATUSES.has(status);
}

export function normalizePlanKey(value: unknown): PlanKey {
  return value === "standard" || value === "business" ? value : "free";
}

export function normalizeBillingStatus(value: unknown): BillingStatus {
  switch (value) {
    case "trialing":
    case "active":
    case "past_due":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    case "canceled":
    case "free":
      return value;
    default:
      return "free";
  }
}

export function resolveEffectivePlan(planKey: PlanKey, billingStatus: BillingStatus): PlanKey {
  if (planKey === "free") return "free";
  return isPaidBillingStatus(billingStatus) ? planKey : "free";
}

export function getEntitlementTemplate(planKey: PlanKey) {
  return PLAN_DEFINITIONS[planKey];
}
