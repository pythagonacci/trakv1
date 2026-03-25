import type { PlanKey } from "@/lib/billing/config";

export type BillingErrorCode =
  | "PLAN_LIMIT_REACHED"
  | "FEATURE_NOT_AVAILABLE"
  | "BILLING_REQUIRED"
  | "AI_QUOTA_EXCEEDED";

export interface BillingErrorPayload {
  code: BillingErrorCode;
  message: string;
  upgradeTargetPlan?: PlanKey;
}

export class BillingError extends Error {
  code: BillingErrorCode;
  upgradeTargetPlan?: PlanKey;

  constructor(payload: BillingErrorPayload) {
    super(payload.message);
    this.name = "BillingError";
    this.code = payload.code;
    this.upgradeTargetPlan = payload.upgradeTargetPlan;
  }
}

export function toBillingErrorPayload(error: unknown): BillingErrorPayload | null {
  if (!(error instanceof BillingError)) return null;
  return {
    code: error.code,
    message: error.message,
    upgradeTargetPlan: error.upgradeTargetPlan,
  };
}

export function withBillingError<T extends Record<string, unknown>>(
  payload: T,
  error: BillingErrorPayload
) {
  return {
    ...payload,
    error: error.message,
    code: error.code,
    upgradeTargetPlan: error.upgradeTargetPlan,
  };
}
