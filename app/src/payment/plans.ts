import { requireNodeEnvVar } from "../server/utils";

export enum SubscriptionStatus {
  PastDue = "past_due",
  CancelAtPeriodEnd = "cancel_at_period_end",
  Active = "active",
  Deleted = "deleted",
}

export enum PaymentPlanId {
  Free = "free",
  Starter = "starter",
  Pro = "pro",
  Ultimate = "ultimate",
  /** One-time Lemon product; entitlement stored like a paid plan (no recurring subscription). */
  Lifetime = "lifetime",
}

export interface PaymentPlan {
  /**
   * Returns the id under which this payment plan is identified on your payment processor.
   *
   * E.g. price id on Stripe, or variant id on LemonSqueezy.
   */
  getPaymentProcessorPlanId: () => string;
  effect: PaymentPlanEffect;
}

export type PaymentPlanEffect =
  | { kind: "subscription" }
  | { kind: "credits"; amount: number };

export const paymentPlans = {
  [PaymentPlanId.Free]: {
    getPaymentProcessorPlanId: () => "", // Free plan doesn't use payment processor
    effect: { kind: "subscription" },
  },
  [PaymentPlanId.Starter]: {
    getPaymentProcessorPlanId: () =>
      requireNodeEnvVar("PAYMENTS_STARTER_SUBSCRIPTION_PLAN_ID"),
    effect: { kind: "subscription" },
  },
  [PaymentPlanId.Pro]: {
    getPaymentProcessorPlanId: () =>
      requireNodeEnvVar("PAYMENTS_PRO_SUBSCRIPTION_PLAN_ID"),
    effect: { kind: "subscription" },
  },
  [PaymentPlanId.Ultimate]: {
    getPaymentProcessorPlanId: () =>
      requireNodeEnvVar("PAYMENTS_ULTIMATE_SUBSCRIPTION_PLAN_ID"),
    effect: { kind: "subscription" },
  },
  [PaymentPlanId.Lifetime]: {
    getPaymentProcessorPlanId: () =>
      requireNodeEnvVar("PAYMENTS_LIFETIME_PLAN_ID"),
    effect: { kind: "credits", amount: 1 },
  },
} as const satisfies Record<PaymentPlanId, PaymentPlan>;

export function prettyPaymentPlanName(planId: PaymentPlanId): string {
  const planToName: Record<PaymentPlanId, string> = {
    [PaymentPlanId.Free]: "Free",
    [PaymentPlanId.Starter]: "Starter",
    [PaymentPlanId.Pro]: "Pro",
    [PaymentPlanId.Ultimate]: "Ultimate",
    [PaymentPlanId.Lifetime]: "Lifetime",
  };
  return planToName[planId];
}

/** How AI interaction quota is counted (see aiUsageBillingPeriod.ts). */
export type AiUsageQuotaScope = "billing_period" | "lifetime";

export const AI_USAGE_LIMITS = {
  [PaymentPlanId.Free]: { enabled: false as const, interactionLimit: 0 },
  [PaymentPlanId.Starter]: {
    enabled: true as const,
    interactionLimit: 150,
    scope: "billing_period" as const,
  },
  [PaymentPlanId.Pro]: {
    enabled: true as const,
    interactionLimit: 2500,
    scope: "billing_period" as const,
  },
  [PaymentPlanId.Ultimate]: {
    enabled: true as const,
    interactionLimit: 12500,
    scope: "billing_period" as const,
  },
  [PaymentPlanId.Lifetime]: {
    enabled: true as const,
    interactionLimit: 25_000,
    scope: "lifetime" as const,
  },
} as const;

export function getAiUsageQuotaScope(
  planId: PaymentPlanId,
): AiUsageQuotaScope | null {
  const cfg = AI_USAGE_LIMITS[planId];
  if (!cfg.enabled) {
    return null;
  }
  return cfg.scope;
}

/** Voice input (Whisper) is available on Ultimate and Lifetime. */
export function hasVoiceInputAccess(planId: PaymentPlanId): boolean {
  return (
    planId === PaymentPlanId.Ultimate || planId === PaymentPlanId.Lifetime
  );
}

/** Features that were historically “PRO-only” (team/org features, etc.). */
export function hasProTierOrHigher(planId: PaymentPlanId): boolean {
  return (
    planId === PaymentPlanId.Pro ||
    planId === PaymentPlanId.Ultimate ||
    planId === PaymentPlanId.Lifetime
  );
}

/** Monthly/annual Lemon subscription tiers (excludes one-time Lifetime). */
export function isRecurringSubscriptionPlanId(planId: PaymentPlanId): boolean {
  return (
    planId === PaymentPlanId.Starter ||
    planId === PaymentPlanId.Pro ||
    planId === PaymentPlanId.Ultimate
  );
}

/** Legacy OpenSaaS credits field; not used for form creation limits (see FORM_LIMITS). */
export const FREE_PLAN_CREDITS = 5;

/** Max forms per organization (by org owner’s plan). `null` = unlimited. */
export const FORM_LIMITS: Record<
  PaymentPlanId,
  number | null
> = {
  [PaymentPlanId.Free]: 5,
  [PaymentPlanId.Starter]: null,
  [PaymentPlanId.Pro]: null,
  [PaymentPlanId.Ultimate]: null,
  [PaymentPlanId.Lifetime]: null,
};

/** Submission caps: Free = lifetime total per org; Starter = per billing period (see submissionUsageCount). */
export const SUBMISSION_LIMITS: Record<
  PaymentPlanId,
  { max: number | null; scope: "lifetime" | "billing_period" }
> = {
  [PaymentPlanId.Free]: { max: 100, scope: "lifetime" },
  [PaymentPlanId.Starter]: { max: 10_000, scope: "billing_period" },
  [PaymentPlanId.Pro]: { max: null, scope: "billing_period" },
  [PaymentPlanId.Ultimate]: { max: null, scope: "billing_period" },
  [PaymentPlanId.Lifetime]: { max: null, scope: "billing_period" },
};

export function parsePaymentPlanId(planId: string): PaymentPlanId {
  if ((Object.values(PaymentPlanId) as string[]).includes(planId)) {
    return planId as PaymentPlanId;
  } else {
    throw new Error(`Invalid PaymentPlanId: ${planId}`);
  }
}

export function getSubscriptionPaymentPlanIds(): PaymentPlanId[] {
  return Object.values(PaymentPlanId).filter(
    (planId) => paymentPlans[planId].effect.kind === "subscription",
  );
}

/**
 * Returns Open SaaS `PaymentPlanId` for some payment provider's plan ID.
 * 
 * Different payment providers track plan ID in different ways.
 * e.g. Stripe price ID, Polar product ID...
 */
export function getPaymentPlanIdByPaymentProcessorPlanId(
  paymentProcessorPlanId: string,
): PaymentPlanId {
  for (const [planId, plan] of Object.entries(paymentPlans)) {
    if (plan.getPaymentProcessorPlanId() === paymentProcessorPlanId) {
      return planId as PaymentPlanId;
    }
  }

  throw new Error(
    `Unknown payment processor plan ID: ${paymentProcessorPlanId}`,
  );
}
