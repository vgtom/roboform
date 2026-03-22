import { HttpError } from "wasp/server";
import * as z from "zod";
import { UnhandledWebhookEventError } from "../errors";

export async function parseWebhookPayload(rawPayload: string) {
  try {
    const rawEvent: unknown = JSON.parse(rawPayload);
    const { meta, data } = await genericEventSchema.parseAsync(rawEvent);
    switch (meta.event_name) {
      case "order_created":
        const orderData = await orderDataSchema.parseAsync(data);
        return { eventName: meta.event_name, meta, data: orderData };
      case "subscription_payment_success":
        const invoiceData = await subscriptionInvoiceDataSchema.parseAsync(data);
        return { eventName: meta.event_name, meta, data: invoiceData };
      case "subscription_created":
      case "subscription_updated":
      case "subscription_cancelled":
      case "subscription_expired":
        const subscriptionData = await subscriptionDataSchema.parseAsync(data);
        return { eventName: meta.event_name, meta, data: subscriptionData };
      default:
        // If you'd like to handle more events, you can add more cases above.
        throw new UnhandledWebhookEventError(meta.event_name);
    }
  } catch (e: unknown) {
    if (e instanceof UnhandledWebhookEventError) {
      throw e;
    } else {
      if (e instanceof z.ZodError) {
        console.error(
          "[Lemon webhook] Payload validation failed:",
          JSON.stringify(e.flatten()),
        );
      } else {
        console.error(e);
      }
      throw new HttpError(400, "Error parsing Lemon Squeezy webhook payload");
    }
  }
}

/**
 * This schema is based on LemonSqueezyResponse type
 */
const genericEventSchema = z.object({
  meta: z.object({
    event_name: z.string(),
    /** Set from checkout; some events (e.g. invoice) may omit — resolve user via customer_id. */
    custom_data: z
      .object({
        user_id: z.string(),
      })
      .optional(),
  }),
  data: z.unknown(),
});

/**
 * This schema is based on
 * @type import('@lemonsqueezy/lemonsqueezy.js').Order
 * specifically Order['data'].
 */
const orderDataSchema = z.object({
  attributes: z.object({
    customer_id: z.coerce.number(),
    status: z.string(),
    first_order_item: z.object({
      variant_id: z.coerce.number(),
    }),
    order_number: z.coerce.number(),
  }),
});

/**
 * This schema is based on
 * @type import('@lemonsqueezy/lemonsqueezy.js').Subscription
 * specifically Subscription['data'].
 */
const subscriptionDataSchema = z.object({
  id: z.coerce.string(),
  attributes: z.object({
    customer_id: z.coerce.number(),
    status: z.string(),
    variant_id: z.coerce.number(),
    renews_at: z.string().optional(),
    ends_at: z.string().nullable().optional(),
  }),
});

/** Subscription invoice (subscription_payment_success webhook). */
const subscriptionInvoiceDataSchema = z.object({
  attributes: z.object({
    customer_id: z.coerce.number(),
    subscription_id: z.coerce.number(),
    /** initial | renewal | updated */
    billing_reason: z.string(),
    status: z.string(),
  }),
});

export type SubscriptionData = z.infer<typeof subscriptionDataSchema>;

export type OrderData = z.infer<typeof orderDataSchema>;

export type SubscriptionInvoiceData = z.infer<
  typeof subscriptionInvoiceDataSchema
>;
