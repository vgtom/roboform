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
} as const satisfies Record<PaymentPlanId, PaymentPlan>;

export function prettyPaymentPlanName(planId: PaymentPlanId): string {
  const planToName: Record<PaymentPlanId, string> = {
    [PaymentPlanId.Free]: "Free",
    [PaymentPlanId.Starter]: "Starter",
    [PaymentPlanId.Pro]: "Pro",
  };
  return planToName[planId];
}

// AI usage limits for each plan
export const AI_USAGE_LIMITS = {
  [PaymentPlanId.Free]: { enabled: false, costLimit: 0 }, // No AI features
  [PaymentPlanId.Starter]: { enabled: true, costLimit: 1.0 }, // Limited AI for testing (~$1 OpenAI usage)
  [PaymentPlanId.Pro]: { enabled: true, costLimit: 5.0 }, // Up to $4-5 OpenAI usage
} as const;

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
