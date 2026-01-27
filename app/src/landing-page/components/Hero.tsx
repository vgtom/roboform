import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { Button } from "../../client/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <div className="relative w-full pt-20 pb-16 overflow-hidden">
      <TopGradient />
      <BottomGradient />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex items-center gap-6 rounded-full border border-gray-200 bg-white/50 px-12 py-6 text-xl font-medium backdrop-blur-sm">
            <Sparkles className="h-10 w-10 text-blue-600" />
            <span className="text-gray-700">AI-Powered Form Builder</span>
          </div>
          <h1 className="text-foreground text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Create beautiful AI forms{" "}
            <span className="text-gradient-primary">in seconds</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-8 sm:text-xl">
            Build powerful forms with AI, collect responses, and analyze results—all in one place. 
            No coding required.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-4">
            <Button size="lg" variant="default" className="text-base px-8" asChild>
              <WaspRouterLink to={routes.SignupRoute.to}>
                Start Building Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </WaspRouterLink>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" asChild>
              <WaspRouterLink to={routes.PricingPageRoute.to}>
                View Pricing
              </WaspRouterLink>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            No credit card required • Free forever plan available
          </p>
        </div>
        
        {/* Form Builder Preview */}
        <div className="mt-16">
          <div className="relative rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-10" />
            <div className="relative p-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-12 text-center text-white min-h-[400px] flex items-center justify-center">
                <div className="max-w-md">
                  <h2 className="text-3xl font-bold mb-4">What did you think of your experience?</h2>
                  <p className="text-blue-100 mb-8">Your feedback helps us improve</p>
                  <div className="space-y-4">
                    <div className="bg-white/20 rounded-lg p-4 text-left cursor-pointer hover:bg-white/30 transition">
                      ⭐ Excellent
                    </div>
                    <div className="bg-white/20 rounded-lg p-4 text-left cursor-pointer hover:bg-white/30 transition">
                      👍 Good
                    </div>
                    <div className="bg-white/20 rounded-lg p-4 text-left cursor-pointer hover:bg-white/30 transition">
                      😐 Average
                    </div>
                  </div>
                  <Button className="mt-8 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-8 py-3 rounded-lg">
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopGradient() {
  return (
    <div
      className="absolute right-0 top-0 -z-10 w-full transform-gpu overflow-hidden blur-3xl"
      aria-hidden="true"
    >
      <div
        className="aspect-[1020/880] w-[70rem] flex-none bg-gradient-to-tr from-blue-400 to-purple-300 opacity-20 sm:right-1/4 sm:translate-x-1/2"
        style={{
          clipPath:
            "polygon(80% 20%, 90% 55%, 50% 100%, 70% 30%, 20% 50%, 50% 0)",
        }}
      />
    </div>
  );
}

function BottomGradient() {
  return (
    <div
      className="absolute inset-x-0 top-[calc(100%-40rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-65rem)]"
      aria-hidden="true"
    >
      <div
        className="relative aspect-[1020/880] w-[90rem] bg-gradient-to-br from-blue-400 to-purple-300 opacity-20 sm:-left-3/4 sm:translate-x-1/4"
        style={{
          clipPath: "ellipse(80% 30% at 80% 50%)",
        }}
      />
    </div>
  );
}
