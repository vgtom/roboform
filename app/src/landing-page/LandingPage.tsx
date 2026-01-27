import { Navigate } from "react-router-dom";
import { useAuth } from "wasp/client/auth";
import ExamplesCarousel from "./components/ExamplesCarousel";
import FAQ from "./components/FAQ";
import FeaturesGrid from "./components/FeaturesGrid";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import Testimonials from "./components/Testimonials";
import {
  examples,
  faqs,
  features,
  footerNavigation,
  testimonials,
} from "./contentSections";

export default function LandingPage() {
  const { data: user } = useAuth();

  // Redirect logged-in users to the forms app
  if (user) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className="bg-[#f0f8ff]/30 text-foreground" style={{ backgroundColor: 'rgba(240, 248, 255, 0.3)' }}>
      <main className="isolate">
        <Hero />
        <ExamplesCarousel examples={examples} />
        <FeaturesGrid features={features} />
        <Testimonials testimonials={testimonials} />
        <FAQ faqs={faqs} />
      </main>
      <Footer footerNavigation={footerNavigation} />
    </div>
  );
}
