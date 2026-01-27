import { routes } from "wasp/client/router";
import { DocsUrl } from "../../../shared/common";
import type { NavigationItem } from "./NavBar";

const staticNavigationItems: NavigationItem[] = [
  { name: "Documentation", to: DocsUrl },
  { name: "Blog", to: routes.ComingSoonRoute.to },
];

export const marketingNavigationItems: NavigationItem[] = [
  { name: "Home", to: routes.LandingPageRoute.to },
  { name: "Features", to: "/#features" },
  { name: "Pricing", to: routes.PricingPageRoute.to },
  { name: "Blog", to: routes.ComingSoonRoute.to },
] as const;

export const demoNavigationitems: NavigationItem[] = [
  { name: "Forms", to: "/workspaces" },
  { name: "File Upload", to: routes.FileUploadRoute.to },
  ...staticNavigationItems,
] as const;
