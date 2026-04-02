import { CheckCircle } from "lucide-react";
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
  const isUserSubscribed =
    !!user &&
    !!user.subscriptionStatus &&
    user.subscriptionStatus !== SubscriptionStatus.Deleted;

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
      <div
        className={
          isModal
            ? "isolate mx-auto mt-6 grid w-full max-w-none grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3 xl:gap-4"
            : "isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none sm:grid-cols-2 xl:grid-cols-4 lg:gap-x-8"
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
              {isUserSubscribed ? (
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
