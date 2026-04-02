import { HttpError } from "wasp/server";
import type {
  GenerateCheckoutSession,
  GetCustomerPortalUrl,
  SyncSubscriptionFromLemon,
} from "wasp/server/operations";
import * as z from "zod";
import { PaymentPlanId, paymentPlans } from "../payment/plans";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { paymentProcessor } from "./paymentProcessor";
import { syncSubscriptionFromLemonForUser } from "./lemonSqueezy/syncSubscriptionFromLemon";

export type CheckoutSession = {
  sessionUrl: string | null;
  sessionId: string;
};

const generateCheckoutSessionSchema = z.nativeEnum(PaymentPlanId);

type GenerateCheckoutSessionInput = z.infer<
  typeof generateCheckoutSessionSchema
>;

export const generateCheckoutSession: GenerateCheckoutSession<
  GenerateCheckoutSessionInput,
  CheckoutSession
> = async (rawPaymentPlanId, context) => {
  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  const paymentPlanId = ensureArgsSchemaOrThrowHttpError(
    generateCheckoutSessionSchema,
    rawPaymentPlanId,
  );
  if (paymentPlanId === PaymentPlanId.Free) {
    throw new HttpError(
      400,
      "The Free plan does not use checkout. Use the app without subscribing, or choose a paid plan.",
    );
  }
  const userId = context.user.id;
  const userEmail = context.user.email;
  if (!userEmail) {
    // If using the usernameAndPassword Auth method, switch to an Auth method that provides an email.
    throw new HttpError(403, "User needs an email to make a payment.");
  }

  const paymentPlan = paymentPlans[paymentPlanId];
  let session: { id: string; url: string };
  try {
    ({ session } = await paymentProcessor.createCheckoutSession({
      userId,
      userEmail,
      paymentPlan,
      prismaUserDelegate: context.entities.User,
    }));
  } catch (err: unknown) {
    console.error("[generateCheckoutSession] Lemon/processor error:", err);
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
    throw new HttpError(
      502,
      `Could not start checkout. If this persists, verify Lemon Squeezy secrets (API key, store ID, variant IDs) and WASP_WEB_CLIENT_URL on the server. ${msg}`,
    );
  }

  return {
    sessionUrl: session.url,
    sessionId: session.id,
  };
};

export const getCustomerPortalUrl: GetCustomerPortalUrl<
  void,
  string | null
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  return paymentProcessor.fetchCustomerPortalUrl({
    userId: context.user.id,
    prismaUserDelegate: context.entities.User,
  });
};

export const syncSubscriptionFromLemon: SyncSubscriptionFromLemon<
  void,
  { synced: boolean; message: string }
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  return syncSubscriptionFromLemonForUser(
    context.user.id,
    context.user.email ?? null,
    context.entities.User,
  );
};
