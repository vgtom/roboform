import { getCustomer } from "@lemonsqueezy/lemonsqueezy.js";
import { type PrismaClient } from "@prisma/client";
import crypto from "crypto";
import express from "express";
import { HttpError, type MiddlewareConfigFn } from "wasp/server";
import { type PaymentsWebhook } from "wasp/server/api";
import {
  applyRenewalInvoiceToAiUsage,
  computeAiUsagePeriodEndsAtFromLemonAttributes,
  fetchPeriodEndFromLemonApi,
} from "../../ai/aiUsageBillingPeriod";
import { requireNodeEnvVar } from "../../server/utils";
import { assertUnreachable } from "../../shared/utils";
import { UnhandledWebhookEventError } from "../errors";
import { PaymentPlanId, SubscriptionStatus } from "../plans";
import { resetUserToFreePlan, updateUserLemonSqueezyPaymentDetails } from "./paymentDetails";
import { getPlanIdByVariantId } from "./variantPlanMapping";
import {
  parseWebhookPayload,
  type OrderData,
  type SubscriptionData,
  type SubscriptionInvoiceData,
} from "./webhookPayload";

export const lemonSqueezyWebhook: PaymentsWebhook = async (
  request,
  response,
  context,
) => {
  try {
    const rawRequestBody = parseRequestBody(request);

    const { eventName, meta, data } = await parseWebhookPayload(rawRequestBody);
    const prismaUserDelegate = context.entities.User;
    const userId = await resolveWebhookUserId(meta, data, prismaUserDelegate);

    switch (eventName) {
      case "order_created":
        await handleOrderCreated(data, userId, prismaUserDelegate);
        break;
      case "subscription_payment_success":
        await handleSubscriptionPaymentSuccess(
          data as SubscriptionInvoiceData,
          userId,
          prismaUserDelegate,
        );
        break;
      case "subscription_created":
        await handleSubscriptionCreated(data, userId, prismaUserDelegate);
        break;
      case "subscription_updated":
        await handleSubscriptionUpdated(data, userId, prismaUserDelegate);
        break;
      case "subscription_cancelled":
        await handleSubscriptionCancelled(data, userId, prismaUserDelegate);
        break;
      case "subscription_expired":
        await handleSubscriptionExpired(data, userId, prismaUserDelegate);
        break;
      default:
        // If you'd like to handle more events, you can add more cases above.
        assertUnreachable(eventName);
    }

    return response.status(200).json({ received: true });
  } catch (err) {
    if (err instanceof UnhandledWebhookEventError) {
      console.error(err.message);
      return response.status(422).json({ error: err.message });
    }

    console.error("Webhook error:", err);
    if (err instanceof HttpError) {
      return response.status(err.statusCode).json({ error: err.message });
    } else {
      return response
        .status(400)
        .json({ error: "Error Processing Lemon Squeezy Webhook Event" });
    }
  }
};

function parseRequestBody(request: express.Request): string {
  const requestBody = request.body.toString("utf8");
  const signature = request.get("X-Signature");
  if (!signature) {
    throw new HttpError(400, "Lemon Squeezy webhook signature not provided");
  }

  const secret = requireNodeEnvVar("LEMONSQUEEZY_WEBHOOK_SECRET");
  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from(hmac.update(requestBody).digest("hex"), "utf8");

  if (!crypto.timingSafeEqual(Buffer.from(signature, "utf8"), digest)) {
    throw new HttpError(400, "Invalid signature");
  }

  return requestBody;
}

export const lemonSqueezyMiddlewareConfigFn: MiddlewareConfigFn = (
  middlewareConfig,
) => {
  // We need to delete the default 'express.json' middleware and replace it with 'express.raw' middleware
  // because webhook data in the body of the request as raw JSON, not as JSON in the body of the request.
  middlewareConfig.delete("express.json");
  middlewareConfig.set(
    "express.raw",
    express.raw({ type: "application/json" }),
  );
  return middlewareConfig;
};

async function resolveWebhookUserId(
  meta: { custom_data?: { user_id: string } },
  data: OrderData | SubscriptionData | SubscriptionInvoiceData,
  prismaUserDelegate: PrismaClient["user"],
): Promise<string> {
  if (meta.custom_data?.user_id) {
    return meta.custom_data.user_id;
  }
  const customerId = data.attributes.customer_id;
  const user = await prismaUserDelegate.findFirst({
    where: { paymentProcessorUserId: String(customerId) },
    select: { id: true },
  });
  if (user) {
    return user.id;
  }

  /**
   * Lemon often delivers `subscription_*` before `order_created`, so we have no
   * `paymentProcessorUserId` yet and `meta.custom_data` may be missing on some events.
   * Resolve the app user via the customer's email from Lemon's API.
   */
  const { data: lemonCustomer, error: customerErr } = await getCustomer(
    String(customerId),
  );
  if (customerErr || !lemonCustomer?.data?.attributes?.email) {
    throw new HttpError(
      404,
      `No user with Lemon customer_id ${customerId} and could not load customer from Lemon API. Ensure webhooks hit the server and LEMONSQUEEZY_API_KEY matches the store (live vs test).`,
    );
  }
  const email = lemonCustomer.data.attributes.email.trim().toLowerCase();
  const userByEmail = await prismaUserDelegate.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!userByEmail) {
    throw new HttpError(
      404,
      `No app user with email "${email}" for Lemon customer_id ${customerId}. User must sign up with the same email used at checkout.`,
    );
  }
  console.log(
    `[Lemon webhook] Resolved user ${userByEmail.id} by customer ${customerId} email (custom_data / paymentProcessorUserId not ready yet).`,
  );
  return userByEmail.id;
}

async function periodEndFromSubscriptionPayload(
  data: SubscriptionData,
): Promise<Date | null> {
  const { status, renews_at, ends_at } = data.attributes;
  if (renews_at) {
    return computeAiUsagePeriodEndsAtFromLemonAttributes({
      status,
      renews_at,
      ends_at: ends_at ?? null,
    });
  }
  return fetchPeriodEndFromLemonApi(data.id);
}

/** Sync AI billing period from Lemon; renewals reset usage + next period end. */
async function handleSubscriptionPaymentSuccess(
  data: SubscriptionInvoiceData,
  userId: string,
  prismaUserDelegate: PrismaClient["user"],
) {
  const { billing_reason, status, customer_id, subscription_id } =
    data.attributes;
  if (status !== "paid") {
    console.log(
      `subscription_payment_success: invoice not paid (${status}), skipping`,
    );
    return;
  }
  const subId = String(subscription_id);
  if (billing_reason === "renewal") {
    await applyRenewalInvoiceToAiUsage(userId, subId, prismaUserDelegate);
  } else if (billing_reason === "initial") {
    const end = await fetchPeriodEndFromLemonApi(subId);
    if (end) {
      await prismaUserDelegate.update({
        where: { id: userId },
        data: {
          lemonSubscriptionId: subId,
          aiUsagePeriodEndsAt: end,
        },
      });
    }
  }
  console.log(
    `subscription_payment_success: billing_reason=${billing_reason}, customer=${customer_id}, subscription=${subId}, user=${userId}`,
  );
}

// This will fire for one-time payment orders AND subscriptions. But subscriptions will ALSO send a follow-up
// event of 'subscription_created'. So we use this handler mainly to process one-time, credit-based orders,
// as well as to save the customer portal URL and customer id for the user.
async function handleOrderCreated(
  data: OrderData,
  userId: string,
  prismaUserDelegate: PrismaClient["user"],
) {
  const { customer_id, status, first_order_item, order_number } =
    data.attributes;
  const lemonSqueezyId = customer_id.toString();

  const planId = getPlanIdByVariantId(first_order_item.variant_id.toString());

  let lemonSqueezyCustomerPortalUrl: string | undefined;
  try {
    lemonSqueezyCustomerPortalUrl = await fetchUserCustomerPortalUrl({
      lemonSqueezyId,
    });
  } catch (e) {
    // Portal URL can be null briefly for new customers; do not fail the whole webhook.
    console.warn(
      `[Lemon webhook] order_created ${order_number}: customer portal URL not available yet:`,
      e,
    );
  }

  // One-time Lifetime (LTD) products: no subscription_created; grant plan here when paid.
  if (
    planId === PaymentPlanId.Lifetime &&
    String(status).toLowerCase() === "paid"
  ) {
    await updateUserLemonSqueezyPaymentDetails(
      {
        lemonSqueezyId,
        userId,
        lemonSqueezyCustomerPortalUrl,
        subscriptionPlan: PaymentPlanId.Lifetime,
        subscriptionStatus: SubscriptionStatus.Active,
        datePaid: new Date(),
        aiUsageCount: 0,
        lemonSubscriptionId: null,
        aiUsagePeriodEndsAt: null,
      },
      prismaUserDelegate,
    );
    console.log(
      `[Lemon webhook] order_created ${order_number}: Lifetime plan activated for user ${userId}`,
    );
    return;
  }

  // Subscriptions: subscription_created/updated set the plan; here we only persist Lemon customer id + portal URL.
  await updateUserLemonSqueezyPaymentDetails(
    {
      lemonSqueezyId,
      userId,
      lemonSqueezyCustomerPortalUrl,
    },
    prismaUserDelegate,
  );

  console.log(`Order ${order_number} created for user ${lemonSqueezyId}`);
}

async function handleSubscriptionCreated(
  data: SubscriptionData,
  userId: string,
  prismaUserDelegate: PrismaClient["user"],
) {
  const { customer_id, status, variant_id } = data.attributes;
  const lemonSqueezyId = customer_id.toString();

  const planId = getPlanIdByVariantId(variant_id.toString());

  if (status === "active" || status === "on_trial") {
    const periodEnd = await periodEndFromSubscriptionPayload(data);
    await updateUserLemonSqueezyPaymentDetails(
      {
        lemonSqueezyId,
        userId,
        subscriptionPlan: planId,
        subscriptionStatus: status as SubscriptionStatus,
        datePaid: new Date(),
        aiUsageCount: 0,
        lemonSubscriptionId: data.id,
        aiUsagePeriodEndsAt: periodEnd ?? undefined,
      },
      prismaUserDelegate,
    );
  } else {
    console.warn(
      `Unexpected status '${status}' for newly created subscription`,
    );
  }

  console.log(`Subscription created for user ${lemonSqueezyId}`);
}

// NOTE: LemonSqueezy's 'subscription_updated' event is sent as a catch-all and fires even after 'subscription_created' & 'order_created'.
async function handleSubscriptionUpdated(
  data: SubscriptionData,
  userId: string,
  prismaUserDelegate: PrismaClient["user"],
) {
  const { customer_id, status, variant_id } = data.attributes;
  const lemonSqueezyId = customer_id.toString();

  const planId = getPlanIdByVariantId(variant_id.toString());

  // Past due / active: keep plan and sync status. Unpaid / expired: downgrade to Free and reset AI (billing period ended without renewal).
  // Note: 'cancelled' here may mean cancelled at period end — subscription_cancelled handler sets cancel_at_period_end; do not downgrade until unpaid/expired/expired webhook.
  // NOTE: ability to pause or trial a subscription is something that has to be additionally configured in the lemon squeezy dashboard.
  if (status === "unpaid" || status === "expired") {
    await resetUserToFreePlan(userId, prismaUserDelegate);
    console.log(
      `Subscription ended (${status}) for user ${lemonSqueezyId}; reset to Free plan`,
    );
    return;
  }

  if (status === "cancelled") {
    const periodEnd = await periodEndFromSubscriptionPayload(data);
    await updateUserLemonSqueezyPaymentDetails(
      {
        lemonSqueezyId,
        userId,
        subscriptionPlan: planId,
        subscriptionStatus: "cancel_at_period_end" as SubscriptionStatus,
        lemonSubscriptionId: data.id,
        aiUsagePeriodEndsAt: periodEnd ?? undefined,
      },
      prismaUserDelegate,
    );
    console.log(`Subscription cancelled (updated) for user ${lemonSqueezyId}`);
    return;
  }

  if (
    status === "past_due" ||
    status === "active" ||
    status === "on_trial" ||
    status === "paused"
  ) {
    const periodEnd = await periodEndFromSubscriptionPayload(data);
    await updateUserLemonSqueezyPaymentDetails(
      {
        lemonSqueezyId,
        userId,
        subscriptionPlan: planId,
        subscriptionStatus: status as SubscriptionStatus,
        lemonSubscriptionId: data.id,
        aiUsagePeriodEndsAt: periodEnd ?? undefined,
        ...((status === "active" || status === "on_trial") && {
          datePaid: new Date(),
        }),
      },
      prismaUserDelegate,
    );
    console.log(`Subscription updated for user ${lemonSqueezyId}`);
  }
}

async function handleSubscriptionCancelled(
  data: SubscriptionData,
  userId: string,
  prismaUserDelegate: PrismaClient["user"],
) {
  const { customer_id, variant_id } = data.attributes;
  const lemonSqueezyId = customer_id.toString();
  const planId = getPlanIdByVariantId(variant_id.toString());
  const periodEnd = await periodEndFromSubscriptionPayload(data);

  await updateUserLemonSqueezyPaymentDetails(
    {
      lemonSqueezyId,
      userId,
      subscriptionPlan: planId,
      subscriptionStatus: "cancel_at_period_end" as SubscriptionStatus,
      lemonSubscriptionId: data.id,
      aiUsagePeriodEndsAt: periodEnd ?? undefined,
    },
    prismaUserDelegate,
  );

  console.log(`Subscription cancelled for user ${lemonSqueezyId}`);
}

async function handleSubscriptionExpired(
  data: SubscriptionData,
  userId: string,
  prismaUserDelegate: PrismaClient["user"],
) {
  const { customer_id } = data.attributes;
  const lemonSqueezyId = customer_id.toString();

  await resetUserToFreePlan(userId, prismaUserDelegate);

  console.log(
    `Subscription expired for user ${lemonSqueezyId}; reset to Free plan`,
  );
}

async function fetchUserCustomerPortalUrl({
  lemonSqueezyId,
}: {
  lemonSqueezyId: string;
}): Promise<string> {
  const { data: lemonSqueezyCustomer, error } =
    await getCustomer(lemonSqueezyId);
  if (error) {
    throw new Error(
      `Error fetching customer portal URL for user lemonsqueezy id ${lemonSqueezyId}: ${error}`,
    );
  }
  const customerPortalUrl =
    lemonSqueezyCustomer.data.attributes.urls.customer_portal;
  if (!customerPortalUrl) {
    throw new Error(
      `No customer portal URL found for user lemonsqueezy id ${lemonSqueezyId}`,
    );
  }
  return customerPortalUrl;
}
