import { useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { routes } from "wasp/client/router";
import { Toaster } from "../client/components/ui/toaster";
import "./Main.css";
import NavBar from "./components/NavBar/NavBar";
import {
  demoNavigationitems,
  marketingNavigationItems,
} from "./components/NavBar/constants";
import CookieConsentBanner from "./components/cookie-consent/Banner";

/**
 * use this component to wrap all child components
 * this is useful for templates, themes, and context
 */
export default function App() {
  const location = useLocation();
  const isMarketingPage = useMemo(() => {
    return (
      location.pathname === "/" || 
      location.pathname.startsWith("/pricing") ||
      location.pathname.startsWith("/coming-soon")
    );
  }, [location]);

  const navigationItems = isMarketingPage
    ? marketingNavigationItems
    : demoNavigationitems;

  const shouldDisplayAppNavBar = useMemo(() => {
    return (
      location.pathname !== routes.LoginRoute.build() &&
      location.pathname !== routes.SignupRoute.build() &&
      !location.pathname.includes("/forms/") &&
      !location.pathname.includes("/edit") &&
      !location.pathname.startsWith("/workspaces") &&
      !location.pathname.startsWith("/f/")
    );
  }, [location]);

  const isWorkspacesPage = useMemo(() => {
    return location.pathname.startsWith("/workspaces") && !location.pathname.includes("/organization/");
  }, [location]);

  const isOrganizationPages = useMemo(() => {
    return location.pathname.includes("/workspaces/organization/");
  }, [location]);

  const isPublicFormPage = useMemo(() => {
    return location.pathname.startsWith("/f/");
  }, [location]);

  const isAdminDashboard = useMemo(() => {
    return location.pathname.startsWith("/admin");
  }, [location]);

  const isFormBuilder = useMemo(() => {
    return location.pathname.includes("/forms/") && location.pathname.includes("/edit");
  }, [location]);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView();
      }
    }
  }, [location]);

  const isLandingPageRoute = location.pathname === "/";
  
  return (
    <>
      <div className={isLandingPageRoute ? "bg-[#f0f8ff]/30 text-foreground min-h-screen" : "bg-background text-foreground min-h-screen"} style={isLandingPageRoute ? { backgroundColor: 'rgba(240, 248, 255, 0.3)' } : undefined}>
        {isAdminDashboard ? (
          <Outlet />
        ) : isFormBuilder ? (
          <Outlet />
        ) : isWorkspacesPage || isOrganizationPages ? (
          <Outlet />
        ) : (
          <>
            {shouldDisplayAppNavBar && (
              <NavBar navigationItems={navigationItems} />
            )}
            <div className="mx-auto max-w-screen-2xl">
              <Outlet />
            </div>
          </>
        )}
      </div>
      <Toaster position="bottom-right" />
      <CookieConsentBanner />
    </>
  );
}
