import { useAuth } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { Link } from "react-router-dom";
import { Button } from "../client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../client/components/ui/dropdown-menu";
import { ChevronDown, Users, Building2, Settings, CreditCard, Crown } from "lucide-react";
import { UserDropdown } from "../user/UserDropdown";
import { PaymentPlanId } from "../payment/plans";
import { Card, CardContent } from "../client/components/ui/card";

interface WorkspaceNavBarProps {
  organizations: Array<{ id: string; name: string }>;
  selectedOrgId: string | null;
  onOrgChange: (orgId: string) => void;
  onSettingsClick: () => void;
  onInviteClick: () => void;
}

export function WorkspaceNavBar({
  organizations,
  selectedOrgId,
  onSettingsClick,
  onInviteClick,
}: WorkspaceNavBarProps) {
  const { data: user } = useAuth();
  const selectedOrg = organizations.find((org) => org.id === selectedOrgId);
  const isPro = user?.subscriptionPlan === PaymentPlanId.Pro;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Organization Dropdown */}
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 justify-between min-w-[200px]">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {selectedOrg?.name || "Select Organization"}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[220px]">
                <div className="px-2 py-1.5">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    Current Organization
                  </div>
                  <div className="text-sm font-medium">
                    {selectedOrg?.name || "Organization"}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={`/workspaces/organization/${selectedOrgId}/settings`} className="flex items-center w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Organization Settings
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* PRO Upgrade Banner and User Dropdown */}
          <div className="flex items-center gap-3">
            {!isPro && (
              <Card className="border-yellow-200 bg-yellow-50 mr-2">
                <CardContent className="p-2 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                  <div className="hidden md:block">
                    <p className="text-xs font-semibold text-yellow-900">Upgrade to PRO</p>
                  </div>
                  <Button asChild variant="default" size="sm" className="h-7 px-3 text-xs bg-yellow-600 hover:bg-yellow-700">
                    <WaspRouterLink to={routes.PricingPageRoute.to}>Upgrade</WaspRouterLink>
                  </Button>
                </CardContent>
              </Card>
            )}
            {user && <UserDropdown user={user} />}
          </div>
        </div>
      </header>
    </>
  );
}

