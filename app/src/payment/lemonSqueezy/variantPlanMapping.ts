import { HttpError } from "wasp/server";
import { PaymentPlanId, paymentPlans } from "../plans";

/** Maps a Lemon product variant id to our internal plan id (same as checkout / webhooks). */
export function getPlanIdByVariantId(variantId: string): PaymentPlanId {
  const planId = Object.values(PaymentPlanId).find(
    (planId) => paymentPlans[planId].getPaymentProcessorPlanId() === variantId,
  );
  if (!planId) {
    throw new HttpError(
      422,
      `Unknown Lemon variant_id "${variantId}". Set PAYMENTS_STARTER_SUBSCRIPTION_PLAN_ID and/or PAYMENTS_PRO_SUBSCRIPTION_PLAN_ID on the server to this exact variant id (Lemon test vs live stores use different ids).`,
    );
  }
  return planId;
}
