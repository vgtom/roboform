import type { PrismaClient } from "@prisma/client";
import { getSubscription, listSubscriptions } from "@lemonsqueezy/lemonsqueezy.js";
import { HttpError } from "wasp/server";
import { requireNodeEnvVar } from "../server/utils";
import { AI_USAGE_LIMITS, PaymentPlanId } from "../payment/plans";

/** One evaluation + one generation/modification per user action. */
export const AI_PIPELINE_TOTAL_COST = 2;

/**
 * End of the current prepaid billing window for AI quota (matches Lemon Squeezy).
 * Cancelled-but-active: use `ends_at` (access/grace end). Otherwise `renews_at` (next invoice).
 */
export function computeAiUsagePeriodEndsAtFromLemonAttributes(attrs: {
  status: string;
  renews_at: string;
  ends_at: string | null;
}): Date {
  const status = attrs.status.toLowerCase();
  if (
    (status === "cancelled" || status === "expired") &&
    attrs.ends_at
  ) {
    return new Date(attrs.ends_at);
  }
  return new Date(attrs.renews_at);
}

export async function fetchPeriodEndFromLemonApi(
  lemonSubscriptionId: string,
): Promise<Date | null> {
  const { data, error } = await getSubscription(lemonSubscriptionId);
  if (error || !data?.data?.attributes) {
    console.error(
      `[aiUsage] getSubscription(${lemonSubscriptionId}) failed:`,
      error,
    );
    return null;
  }
  const a = data.data.attributes;
  return computeAiUsagePeriodEndsAtFromLemonAttributes({
    status: String(a.status),
    renews_at: a.renews_at,
    ends_at: a.ends_at,
  });
}

/**
 * When we have customer id + email but no subscription id (legacy users), pick the newest active-like subscription.
 */
async function findSubscriptionIdForCustomer(
  userEmail: string | null | undefined,
): Promise<{ subscriptionId: string; periodEnd: Date } | null> {
  if (!userEmail) {
    return null;
  }
  const storeId = requireNodeEnvVar("LEMONSQUEEZY_STORE_ID");
  const { data: body, error } = await listSubscriptions({
    filter: {
      storeId,
      userEmail,
    },
  });
  const subs = body?.data;
  if (error || !subs?.length) {
    return null;
  }
  // Prefer active, past_due, cancelled (grace), on_trial
  const preferred = subs.find((s) =>
    ["active", "past_due", "cancelled", "on_trial", "paused"].includes(
      String(s.attributes.status),
    ),
  );
  const sub = preferred ?? subs[0];
  const a = sub.attributes;
  return {
    subscriptionId: String(sub.id),
    periodEnd: computeAiUsagePeriodEndsAtFromLemonAttributes({
      status: String(a.status),
      renews_at: a.renews_at,
      ends_at: a.ends_at,
    }),
  };
}

/**
 * Resets `aiUsageCount` when the current billing period (per Lemon `renews_at` / `ends_at`) has ended.
 * Hydrates `lemonSubscriptionId` + `aiUsagePeriodEndsAt` from the Lemon API when missing.
 */
export async function ensureAiUsageBillingPeriodAligned(
  userId: string,
  prisma: PrismaClient,
): Promise<void> {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionPlan: true,
      aiUsageCount: true,
      aiUsagePeriodEndsAt: true,
      lemonSubscriptionId: true,
      paymentProcessorUserId: true,
      email: true,
    },
  });
  if (!user) {
    return;
  }
  const plan =
    (user.subscriptionPlan as PaymentPlanId) || PaymentPlanId.Free;
  if (!AI_USAGE_LIMITS[plan].enabled) {
    return;
  }

  const now = Date.now();

  // Hydrate subscription id + period end from Lemon when missing
  if (!user.aiUsagePeriodEndsAt || !user.lemonSubscriptionId) {
    if (user.lemonSubscriptionId) {
      const end = await fetchPeriodEndFromLemonApi(user.lemonSubscriptionId);
      if (end) {
        await prisma.user.update({
          where: { id: userId },
          data: { aiUsagePeriodEndsAt: end },
        });
      }
    } else {
      const found = await findSubscriptionIdForCustomer(user.email);
      if (found) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            lemonSubscriptionId: found.subscriptionId,
            aiUsagePeriodEndsAt: found.periodEnd,
          },
        });
      }
    }
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionPlan: true,
        aiUsageCount: true,
        aiUsagePeriodEndsAt: true,
        lemonSubscriptionId: true,
        paymentProcessorUserId: true,
        email: true,
      },
    });
    if (!user?.aiUsagePeriodEndsAt) {
      return;
    }
  }

  if (user.aiUsagePeriodEndsAt.getTime() <= now) {
    const newEnd = user.lemonSubscriptionId
      ? await fetchPeriodEndFromLemonApi(user.lemonSubscriptionId)
      : null;
    await prisma.user.update({
      where: { id: userId },
      data: {
        aiUsageCount: 0,
        submissionUsageCount: 0,
        ...(newEnd ? { aiUsagePeriodEndsAt: newEnd } : {}),
      },
    });
  }
}

/** Webhook: after a paid renewal invoice, reset AI usage and sync next period end from Lemon. */
export async function applyRenewalInvoiceToAiUsage(
  userId: string,
  lemonSubscriptionId: string,
  prismaUserDelegate: PrismaClient["user"],
): Promise<void> {
  const end = await fetchPeriodEndFromLemonApi(lemonSubscriptionId);
  if (!end) {
    return;
  }
  await prismaUserDelegate.update({
    where: { id: userId },
    data: {
      lemonSubscriptionId,
      aiUsagePeriodEndsAt: end,
      aiUsageCount: 0,
      submissionUsageCount: 0,
    },
  });
}

export async function assertAiPipelineAllowed(
  userId: string,
  prisma: PrismaClient,
): Promise<{ limit: number }> {
  await ensureAiUsageBillingPeriodAligned(userId, prisma);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionPlan: true, aiUsageCount: true },
  });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  const plan =
    (user.subscriptionPlan as PaymentPlanId) || PaymentPlanId.Free;
  const aiLimit = AI_USAGE_LIMITS[plan];
  if (!aiLimit.enabled) {
    throw new HttpError(
      403,
      "AI features are not available on the Free plan. Please upgrade to Starter or Pro to use AI features.",
    );
  }
  const { interactionLimit: limit } = aiLimit;
  if (user.aiUsageCount + AI_PIPELINE_TOTAL_COST > limit) {
    throw new HttpError(
      403,
      `AI usage limit reached for this billing period. You have ${limit} AI interactions per period (${plan} plan). Usage resets when your subscription renews (see billing period end), or upgrade for a higher limit.`,
    );
  }
  return { limit };
}

export async function assertRoomForSecondAiStep(
  userId: string,
  prisma: PrismaClient,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionPlan: true, aiUsageCount: true },
  });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  const plan =
    (user.subscriptionPlan as PaymentPlanId) || PaymentPlanId.Free;
  const aiLimit = AI_USAGE_LIMITS[plan];
  if (!aiLimit.enabled) {
    return;
  }
  if (user.aiUsageCount >= aiLimit.interactionLimit) {
    throw new HttpError(
      403,
      `AI usage limit reached for this billing period (${aiLimit.interactionLimit} interactions). Further AI calls are blocked until the next renewal or a plan upgrade.`,
    );
  }
}
