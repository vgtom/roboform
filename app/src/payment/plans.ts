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
} as const satisfies Record<PaymentPlanId, PaymentPlan>;

export function prettyPaymentPlanName(planId: PaymentPlanId): string {
  const planToName: Record<PaymentPlanId, string> = {
    [PaymentPlanId.Free]: "Free",
    [PaymentPlanId.Starter]: "Starter",
    [PaymentPlanId.Pro]: "Pro",
    [PaymentPlanId.Ultimate]: "Ultimate",
  };
  return planToName[planId];
}

// AI usage limits per subscription billing period for Starter/Pro (Lemon renews_at; see aiUsageBillingPeriod.ts).
export const AI_USAGE_LIMITS = {
  [PaymentPlanId.Free]: { enabled: false, interactionLimit: 0 }, // No AI features
  [PaymentPlanId.Starter]: { enabled: true, interactionLimit: 150 }, // 150 AI interactions per period
  [PaymentPlanId.Pro]: { enabled: true, interactionLimit: 2500 }, // 2500 AI interactions per period
  [PaymentPlanId.Ultimate]: { enabled: true, interactionLimit: 12500 }, // 12500 AI interactions (incl. voice) per period
} as const;

/** Voice input (Whisper) is only available on Ultimate. */
export function hasVoiceInputAccess(planId: PaymentPlanId): boolean {
  return planId === PaymentPlanId.Ultimate;
}

/** Features that were historically “PRO-only” (team/org features, etc.). */
export function hasProTierOrHigher(planId: PaymentPlanId): boolean {
  return planId === PaymentPlanId.Pro || planId === PaymentPlanId.Ultimate;
}

// Credits limits for free plan
export const FREE_PLAN_CREDITS = 5;

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
