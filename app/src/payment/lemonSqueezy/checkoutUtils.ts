import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { requireNodeEnvVar } from "../../server/utils";

interface LemonSqueezyCheckoutSessionParams {
  storeId: string;
  variantId: string;
  userEmail: string;
  userId: string;
}

export async function createLemonSqueezyCheckoutSession({
  storeId,
  variantId,
  userEmail,
  userId,
}: LemonSqueezyCheckoutSessionParams) {
  const clientUrl = requireNodeEnvVar("WASP_WEB_CLIENT_URL").replace(/\/$/, "");
  const redirectUrl = `${clientUrl}/workspaces?payment=success`;

  // Lemon shows every variant of the same product by default. Lock checkout to this variant only.
  // https://docs.lemonsqueezy.com/api/checkouts/create-checkout — product_options.enabled_variants
  const variantIdNum = Number.parseInt(String(variantId), 10);
  if (Number.isNaN(variantIdNum)) {
    throw new Error(`Invalid Lemon variant id (expected integer): ${variantId}`);
  }

  const { data: session, error } = await createCheckout(storeId, variantId, {
    productOptions: {
      redirectUrl,
      enabledVariants: [variantIdNum],
    },
    checkoutData: {
      email: userEmail,
      custom: {
        user_id: userId, // You app's unique user ID is sent on checkout, and it's returned in the webhook so we can easily identify the user.
      },
    },
  });
  if (error) {
    throw error;
  }
  if (!session) {
    throw new Error("Checkout not found");
  }
  return {
    url: session.data.attributes.url,
    id: session.data.id,
  };
}
