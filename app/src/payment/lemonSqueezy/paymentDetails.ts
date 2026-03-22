import { PrismaClient } from "@prisma/client";
import { PaymentPlanId, SubscriptionStatus } from "../plans";

/**
 * When a subscription ends (expired, unpaid, etc.), set user back to Free and reset AI usage.
 * Keeps Lemon Squeezy customer id / portal URL so they can resubscribe.
 */
export async function resetUserToFreePlan(
  userId: string,
  prismaUserDelegate: PrismaClient["user"],
) {
  return prismaUserDelegate.update({
    where: { id: userId },
    data: {
      subscriptionPlan: PaymentPlanId.Free,
      subscriptionStatus: SubscriptionStatus.Deleted,
      aiUsageCount: 0,
      lemonSubscriptionId: null,
      aiUsagePeriodEndsAt: null,
      datePaid: null,
    },
  });
}

export const updateUserLemonSqueezyPaymentDetails = async (
  {
    lemonSqueezyId,
    userId,
    subscriptionPlan,
    subscriptionStatus,
    datePaid,
    numOfCreditsPurchased,
    lemonSqueezyCustomerPortalUrl,
    aiUsageCount,
    lemonSubscriptionId,
    aiUsagePeriodEndsAt,
  }: {
    lemonSqueezyId: string;
    userId: string;
    subscriptionPlan?: PaymentPlanId;
    subscriptionStatus?: SubscriptionStatus;
    numOfCreditsPurchased?: number;
    lemonSqueezyCustomerPortalUrl?: string;
    datePaid?: Date;
    /** Set AI usage to this value (e.g. 0 when starting a new paid period). */
    aiUsageCount?: number;
    lemonSubscriptionId?: string | null;
    aiUsagePeriodEndsAt?: Date | null;
  },
  prismaUserDelegate: PrismaClient["user"],
) => {
  return prismaUserDelegate.update({
    where: {
      id: userId,
    },
    data: {
      paymentProcessorUserId: lemonSqueezyId,
      lemonSqueezyCustomerPortalUrl,
      subscriptionPlan,
      subscriptionStatus,
      datePaid,
      lemonSubscriptionId:
        lemonSubscriptionId !== undefined ? lemonSubscriptionId : undefined,
      aiUsagePeriodEndsAt:
        aiUsagePeriodEndsAt !== undefined ? aiUsagePeriodEndsAt : undefined,
      aiUsageCount:
        aiUsageCount !== undefined ? aiUsageCount : undefined,
      credits:
        numOfCreditsPurchased !== undefined
          ? { increment: numOfCreditsPurchased }
          : undefined,
    },
  });
};
