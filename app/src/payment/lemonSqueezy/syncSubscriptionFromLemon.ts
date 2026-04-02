import { getCustomer } from "@lemonsqueezy/lemonsqueezy.js";
import type { PrismaClient } from "@prisma/client";
import {
  computeAiUsagePeriodEndsAtFromLemonAttributes,
  fetchPeriodEndFromLemonApi,
} from "../../ai/aiUsageBillingPeriod";
import { requireNodeEnvVar } from "../../server/utils";
import { PaymentPlanId, SubscriptionStatus } from "../plans";
import { fetchSubscriptionsForStoreAndUser } from "./lemonSubscriptionLookup";
import { resetUserToFreePlan, updateUserLemonSqueezyPaymentDetails } from "./paymentDetails";
import { getPlanIdByVariantId } from "./variantPlanMapping";

export type SyncSubscriptionFromLemonResult = {
  synced: boolean;
  message: string;
};

/**
 * Pulls the latest subscription for this user from Lemon Squeezy and updates our DB.
 * Use after checkout when webhooks are delayed or misconfigured (wrong URL, signature, etc.).
 */
export async function syncSubscriptionFromLemonForUser(
  userId: string,
  userEmail: string | null,
  prismaUserDelegate: PrismaClient["user"],
): Promise<SyncSubscriptionFromLemonResult> {
  const userRow = await prismaUserDelegate.findUnique({
    where: { id: userId },
    select: {
      subscriptionPlan: true,
      paymentProcessorUserId: true,
      email: true,
    },
  });

  const effectiveEmail = userEmail ?? userRow?.email ?? null;
  if (!effectiveEmail) {
    return { synced: false, message: "Your account needs an email to sync billing." };
  }

  if (userRow?.subscriptionPlan === PaymentPlanId.Lifetime) {
    return {
      synced: true,
      message:
        "Your Lifetime plan is already active. Subscription sync only applies to monthly plans.",
    };
  }

  const storeId = requireNodeEnvVar("LEMONSQUEEZY_STORE_ID");
  let subs: Awaited<ReturnType<typeof fetchSubscriptionsForStoreAndUser>>;
  try {
    subs = await fetchSubscriptionsForStoreAndUser({
      storeId,
      userEmail: effectiveEmail,
      paymentProcessorUserId: userRow?.paymentProcessorUserId ?? null,
    });
  } catch (e) {
    console.error("[syncSubscriptionFromLemon] fetchSubscriptionsForStoreAndUser error:", e);
    return {
      synced: false,
      message: "Could not reach Lemon Squeezy. Try again in a minute.",
    };
  }

  if (!subs?.length) {
    return {
      synced: false,
      message:
        "No subscription found in Lemon for this account. Use the same email as your Vinforms login, or wait for webhooks. If you used a different email at checkout, contact support. Also confirm Fly uses a LIVE Lemon API key if this was a live payment.",
    };
  }

  const preferred = subs.find((s) =>
    ["active", "past_due", "cancelled", "on_trial", "paused"].includes(
      String(s.attributes.status),
    ),
  );
  const sub = preferred ?? subs[0];
  const a = sub.attributes;
  const variantId = String(a.variant_id);
  const customerId = String(a.customer_id);
  const subId = String(sub.id);

  let planId: PaymentPlanId;
  try {
    planId = getPlanIdByVariantId(variantId);
  } catch (e) {
    console.error("[syncSubscriptionFromLemon] unknown variant:", variantId, e);
    return {
      synced: false,
      message: "Subscription product is not linked to a plan in this app. Check PAYMENTS_* env vars.",
    };
  }

  const wasFree =
    !userRow?.subscriptionPlan || userRow.subscriptionPlan === PaymentPlanId.Free;

  let lemonSqueezyCustomerPortalUrl: string | undefined;
  try {
    const { data: lemonCustomer, error: custErr } = await getCustomer(customerId);
    if (!custErr && lemonCustomer?.data?.attributes?.urls?.customer_portal) {
      lemonSqueezyCustomerPortalUrl =
        lemonCustomer.data.attributes.urls.customer_portal;
    }
  } catch {
    // optional
  }

  let periodEnd: Date | null = null;
  if (a.renews_at) {
    periodEnd = computeAiUsagePeriodEndsAtFromLemonAttributes({
      status: String(a.status),
      renews_at: a.renews_at,
      ends_at: a.ends_at ?? null,
    });
  } else {
    periodEnd = await fetchPeriodEndFromLemonApi(subId);
  }

  const status = String(a.status).toLowerCase();

  if (status === "unpaid" || status === "expired") {
    await resetUserToFreePlan(userId, prismaUserDelegate);
    return {
      synced: true,
      message: "Subscription is not active; your plan was updated to match Lemon.",
    };
  }

  if (status === "cancelled") {
    await updateUserLemonSqueezyPaymentDetails(
      {
        lemonSqueezyId: customerId,
        userId,
        subscriptionPlan: planId,
        subscriptionStatus: SubscriptionStatus.CancelAtPeriodEnd,
        lemonSubscriptionId: subId,
        aiUsagePeriodEndsAt: periodEnd ?? undefined,
        lemonSqueezyCustomerPortalUrl,
      },
      prismaUserDelegate,
    );
    return {
      synced: true,
      message: "Subscription synced (cancelled at period end).",
    };
  }

  if (
    status === "active" ||
    status === "past_due" ||
    status === "paused" ||
    status === "on_trial"
  ) {
    await updateUserLemonSqueezyPaymentDetails(
      {
        lemonSqueezyId: customerId,
        userId,
        subscriptionPlan: planId,
        subscriptionStatus: a.status as SubscriptionStatus,
        datePaid:
          wasFree && (status === "active" || status === "on_trial")
            ? new Date()
            : undefined,
        aiUsageCount: wasFree ? 0 : undefined,
        lemonSubscriptionId: subId,
        aiUsagePeriodEndsAt: periodEnd ?? undefined,
        lemonSqueezyCustomerPortalUrl,
      },
      prismaUserDelegate,
    );
    return {
      synced: true,
      message: "Your plan and AI access are now up to date.",
    };
  }

  return {
    synced: false,
    message: `Unhandled Lemon subscription status: ${a.status}`,
  };
}
