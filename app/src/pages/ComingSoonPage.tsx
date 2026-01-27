import { Link } from "react-router-dom";
import { routes } from "wasp/client/router";
import { Button } from "../client/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 mb-6">
            <span className="text-4xl">🚧</span>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Coming Soon</h1>
          <p className="text-xl text-gray-600 mb-2">
            We're working on something amazing!
          </p>
          <p className="text-gray-500">
            Our blog is currently under development. Check back soon for updates, tutorials, and insights.
          </p>
        </div>
        
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button asChild variant="outline">
            <Link to={routes.LandingPageRoute.to} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <Button asChild>
            <Link to={routes.LandingPageRoute.to} className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

