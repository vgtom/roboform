import { CheckCircle, Sparkles } from "lucide-react";
import { useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "wasp/client/auth";
import {
  generateCheckoutSession,
  getCustomerPortalUrl,
  useQuery,
} from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardTitle,
} from "../client/components/ui/card";
import { cn } from "../client/utils";
import {
  isRecurringSubscriptionPlanId,
  PaymentPlanId,
  paymentPlans,
  prettyPaymentPlanName,
  SubscriptionStatus,
} from "./plans";

const bestDealPaymentPlanId: PaymentPlanId = PaymentPlanId.Ultimate;

interface PaymentPlanCard {
  name: string;
  price: string;
  description: string;
  features: string[];
}

const paymentPlanCards: Record<PaymentPlanId, PaymentPlanCard> = {
  [PaymentPlanId.Free]: {
    name: prettyPaymentPlanName(PaymentPlanId.Free),
    price: "$0",
    description: "Perfect for getting started",
    features: [
      "Up to 5 forms",
      "100 total submissions (lifetime)",
      "Basic form builder",
      "All standard features",
      "No AI features",
    ],
  },
  [PaymentPlanId.Starter]: {
    name: prettyPaymentPlanName(PaymentPlanId.Starter),
    price: "$7.99",
    description: "AI features with 150 interactions",
    features: [
      "Unlimited forms",
      "10,000 submissions per billing period",
      "Everything in Free",
      "AI-powered form generation",
      "AI form modifications",
      "150 AI interactions included",
    ],
  },
  [PaymentPlanId.Pro]: {
    name: prettyPaymentPlanName(PaymentPlanId.Pro),
    price: "$59.99",
    description: "Advanced AI features with 2500 interactions",
    features: [
      "Unlimited forms and submissions",
      "Everything in Starter",
      "Enhanced AI-powered features",
      "2500 AI interactions included",
      "Priority support",
    ],
  },
  [PaymentPlanId.Ultimate]: {
    name: prettyPaymentPlanName(PaymentPlanId.Ultimate),
    price: "$249.99",
    description: "Maximum AI power with voice-based prompts",
    features: [
      "Unlimited forms and submissions",
      "Everything in Pro",
      "12,500 AI interactions per billing period",
      "Voice input for AI prompts (Whisper transcription)",
      "Dedicated priority support",
    ],
  },
  [PaymentPlanId.Lifetime]: {
    name: "Lifetime Deal",
    price: "$799.99",
    description: "Pay once for unlimited forms and a large AI quota for life.",
    features: [
      "Unlimited forms and submissions",
      "25,000 AI interactions including voice input (lifetime total, never resets)",
    ],
  },
};

/** Shown under "Pick your pricing" on /pricing and in the upgrade modal */
export const defaultPricingSubtitle = (
  <span>
    Upgrade your plan to unlock more features and get the most out of
    VinForms.
  </span>
);


export interface PricingContentProps {
  /** When provided, shown under "Pick your pricing" instead of the default VinForms subtitle */
  subtitle?: ReactNode;
  /** Wider, denser layout for dialogs so four plans fit comfortably */
  variant?: "page" | "modal";
}

export function PricingContent({
  subtitle = defaultPricingSubtitle,
  variant = "page",
}: PricingContentProps) {
  const [isPaymentLoading, setIsPaymentLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: user } = useAuth();
  const userPlan =
    (user?.subscriptionPlan as PaymentPlanId | undefined) ?? PaymentPlanId.Free;
  const isLifetimeUser = userPlan === PaymentPlanId.Lifetime;
  const isUserSubscribed =
    !!user &&
    !!user.subscriptionStatus &&
    user.subscriptionStatus !== SubscriptionStatus.Deleted;
  const isRecurringSubscriber =
    isUserSubscribed && isRecurringSubscriptionPlanId(userPlan);

  const {
    data: customerPortalUrl,
    isLoading: isCustomerPortalUrlLoading,
    error: customerPortalUrlError,
  } = useQuery(getCustomerPortalUrl, { enabled: isUserSubscribed });

  const navigate = useNavigate();

  async function handleBuyNowClick(paymentPlanId: PaymentPlanId) {
    if (paymentPlanId === PaymentPlanId.Free) {
      if (!user) {
        navigate("/signup");
      } else {
        navigate("/workspaces");
      }
      return;
    }
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      setIsPaymentLoading(true);

      const checkoutResults = await generateCheckoutSession(paymentPlanId);

      if (checkoutResults?.sessionUrl) {
        window.open(checkoutResults.sessionUrl, "_self");
      } else {
        throw new Error("Error generating checkout session URL");
      }
    } catch (error: unknown) {
      console.error(error);
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Error processing payment. Please try again later.");
      }
      setIsPaymentLoading(false);
    }
  }

  const handleCustomerPortalClick = () => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (customerPortalUrlError) {
      setErrorMessage("Error fetching Customer Portal URL");
      return;
    }

    if (!customerPortalUrl) {
      setErrorMessage(`Customer Portal does not exist for user ${user.id}`);
      return;
    }

    window.open(customerPortalUrl, "_blank");
  };

  const isModal = variant === "modal";

  return (
    <div
      className={cn(
        "mx-auto max-w-7xl px-6 lg:px-8",
        isModal && "max-w-full px-0",
      )}
    >
      <div
        id="pricing"
        className={cn(
          "mx-auto max-w-4xl text-center",
          isModal && "max-w-full",
        )}
      >
        <h2
          className={cn(
            "text-foreground mt-2 text-4xl font-bold tracking-tight sm:text-5xl",
            isModal && "text-2xl sm:text-3xl lg:text-4xl",
          )}
        >
          Pick your <span className="text-primary">pricing</span>
        </h2>
      </div>
      <p
        className={cn(
          "text-muted-foreground mx-auto mt-6 max-w-2xl text-center text-lg leading-8",
          isModal && "mt-3 max-w-full text-sm sm:text-base",
        )}
      >
        {subtitle}
      </p>
      {errorMessage && (
        <Alert variant="destructive" className="mt-8">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <section
        aria-labelledby="lifetime-deal-heading"
        className={cn(
          "relative",
          errorMessage
            ? "mt-8"
            : isModal
              ? "mt-4 sm:mt-6"
              : "mt-6 sm:mt-8",
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border-2 border-primary/35 bg-gradient-to-br from-primary/[0.12] via-background to-violet-500/[0.08] shadow-lg shadow-primary/10",
            isModal ? "p-4 sm:p-5" : "p-5 sm:p-6 lg:p-7",
          )}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl"
            aria-hidden
          />

          <div className="relative flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1 space-y-2.5 text-left sm:space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-primary/15 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Limited offer
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  One-time payment · USD
                </span>
              </div>
              <h3
                id="lifetime-deal-heading"
                className={cn(
                  "text-foreground text-xl font-bold tracking-tight sm:text-2xl",
                  isModal && "text-lg sm:text-xl",
                )}
              >
                {paymentPlanCards[PaymentPlanId.Lifetime].name}
              </h3>
              <p
                className={cn(
                  "text-muted-foreground max-w-xl text-sm leading-relaxed",
                  isModal && "text-xs sm:text-sm",
                )}
              >
                {paymentPlanCards[PaymentPlanId.Lifetime].description}
              </p>
              <ul
                className={cn(
                  "text-muted-foreground max-w-xl space-y-1.5 text-sm",
                  isModal && "text-xs sm:text-sm",
                )}
              >
                {paymentPlanCards[PaymentPlanId.Lifetime].features.map(
                  (feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <CheckCircle
                        className="text-primary mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5"
                        aria-hidden
                      />
                      <span>{feature}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div
              className={cn(
                "flex w-full shrink-0 flex-col justify-center rounded-xl border border-primary/20 bg-background/80 p-4 backdrop-blur-sm sm:p-5 lg:max-w-[280px] lg:self-center",
              )}
            >
              <p className="text-muted-foreground text-xs font-medium sm:text-sm">
                Pay once
              </p>
              <p className="text-foreground mt-0.5 flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-4xl font-bold tracking-tight sm:text-5xl",
                    isModal && "text-3xl sm:text-4xl",
                  )}
                >
                  {paymentPlanCards[PaymentPlanId.Lifetime].price}
                </span>
                <span className="text-muted-foreground text-sm">USD</span>
              </p>

              {isLifetimeUser ? (
                <div className="mt-4 flex flex-col gap-2 sm:mt-5">
                  <Button
                    size="lg"
                    className="h-12 w-full text-sm font-semibold shadow-md sm:h-14 sm:text-base"
                    disabled
                  >
                    You have Lifetime access
                  </Button>
                  {customerPortalUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleCustomerPortalClick}
                      disabled={isCustomerPortalUrlLoading}
                    >
                      Open billing portal
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 h-12 w-full text-sm font-semibold shadow-lg transition hover:shadow-xl sm:mt-5 sm:h-14 sm:text-base"
                  onClick={() =>
                    handleBuyNowClick(PaymentPlanId.Lifetime)
                  }
                  disabled={isPaymentLoading}
                >
                  {!user
                    ? "Log in to unlock Lifetime Deal"
                    : "Get Lifetime Deal — $799.99"}
                </Button>
              )}

              {isRecurringSubscriber && !isLifetimeUser && user && (
                <p className="text-muted-foreground mt-2 text-center text-[11px] sm:text-xs">
                  Your current subscription can stay active; Lifetime is a
                  separate one-time purchase in Lemon checkout.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div
        className={
          isModal
            ? "isolate mx-auto mt-4 grid w-full max-w-none grid-cols-1 gap-4 sm:mt-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3 xl:gap-4"
            : "isolate mx-auto mt-8 grid max-w-md grid-cols-1 gap-y-8 sm:mt-10 lg:mx-0 lg:max-w-none sm:grid-cols-2 xl:grid-cols-4 lg:gap-x-8"
        }
      >
        {[
          PaymentPlanId.Free,
          PaymentPlanId.Starter,
          PaymentPlanId.Pro,
          PaymentPlanId.Ultimate,
        ].map((planId) => (
          <Card
            key={planId}
            className={cn(
              "relative flex grow flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-lg",
              {
                "ring-primary !bg-transparent ring-2":
                  planId === bestDealPaymentPlanId,
                "ring-border ring-1 lg:my-8":
                  planId !== bestDealPaymentPlanId && !isModal,
                "ring-border ring-1 lg:my-1":
                  planId !== bestDealPaymentPlanId && isModal,
              },
            )}
          >
            {planId === bestDealPaymentPlanId && (
              <div
                className="absolute right-0 top-0 -z-10 h-full w-full transform-gpu blur-3xl"
                aria-hidden="true"
              >
                <div
                  className="from-primary/40 via-primary/20 to-primary/10 absolute h-full w-full bg-gradient-to-br opacity-30"
                  style={{
                    clipPath: "circle(670% at 50% 50%)",
                  }}
                />
              </div>
            )}
            <CardContent
              className={cn(
                "h-full justify-between",
                isModal ? "p-4 sm:p-5" : "p-8 xl:p-10",
              )}
            >
              <div className="flex items-center justify-between gap-x-4">
                <CardTitle
                  id={planId}
                  className={cn(
                    "text-foreground text-lg font-semibold leading-8",
                    isModal && "text-base leading-7",
                  )}
                >
                  {paymentPlanCards[planId].name}
                </CardTitle>
              </div>
              <p
                className={cn(
                  "text-muted-foreground mt-4 text-sm leading-6",
                  isModal && "mt-2 text-xs sm:text-sm",
                )}
              >
                {paymentPlanCards[planId].description}
              </p>
              <p className={cn("mt-6 flex items-baseline gap-x-1", isModal && "mt-4")}>
                <span
                  className={cn(
                    "text-foreground text-4xl font-bold tracking-tight",
                    isModal && "text-2xl sm:text-3xl",
                  )}
                >
                  {paymentPlanCards[planId].price}
                </span>
                <span className="text-muted-foreground text-sm font-semibold leading-6">
                  {planId !== PaymentPlanId.Free &&
                    paymentPlans[planId].effect.kind === "subscription" &&
                    "/month (USD)"}
                </span>
              </p>
              <ul
                role="list"
                className={cn(
                  "text-muted-foreground mt-8 space-y-3 text-sm leading-6",
                  isModal && "mt-4 space-y-2 text-xs sm:text-sm",
                )}
              >
                {paymentPlanCards[planId].features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <CheckCircle
                      className="text-primary h-5 w-5 flex-none"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {isLifetimeUser ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled
                  aria-label="Included in your Lifetime plan"
                >
                  Included in your Lifetime plan
                </Button>
              ) : isRecurringSubscriber ? (
                <Button
                  onClick={handleCustomerPortalClick}
                  disabled={isCustomerPortalUrlLoading}
                  aria-describedby="manage-subscription"
                  variant={
                    planId === bestDealPaymentPlanId ? "default" : "outline"
                  }
                  className="w-full"
                >
                  Manage Subscription
                </Button>
              ) : (
                <Button
                  onClick={() => handleBuyNowClick(planId)}
                  aria-describedby={planId}
                  variant={
                    planId === bestDealPaymentPlanId ? "default" : "outline"
                  }
                  className="w-full"
                  disabled={isPaymentLoading}
                >
                  {planId === PaymentPlanId.Free
                    ? user
                      ? "Go to app"
                      : "Get started free"
                    : !!user
                      ? "Buy plan"
                      : "Log in to buy plan"}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
