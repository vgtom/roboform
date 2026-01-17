import { useState, useEffect } from "react";
import { useQuery } from "wasp/client/operations";
import { getUserOrganizations, updateOrganization, inviteOrganizationMember } from "wasp/client/operations";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "../client/components/ui/button";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { Switch } from "../client/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../client/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../client/components/ui/breadcrumb";
import { ArrowLeft, Users as UsersIcon, Mail } from "lucide-react";
import { useToast } from "../client/hooks/use-toast";
import { OrganizationRole } from "@prisma/client";
import { WorkspaceNavBar } from "./WorkspaceNavBar";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useAuth } from "wasp/client/auth";
import { getCustomerPortalUrl } from "wasp/client/operations";
import type { User } from "wasp/entities";
import {
  PaymentPlanId,
  SubscriptionStatus,
  parsePaymentPlanId,
  prettyPaymentPlanName,
} from "../payment/plans";
import { cn } from "../client/utils";

type SettingsTab = "settings" | "members" | "smtp" | "billing";

export default function OrganizationSettingsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>("settings");

  const { data: organizations, isLoading } = useQuery(
    getUserOrganizations,
    {},
  );

  const selectedOrg = organizations?.find(
    (org) => org.id === (organizationId || organizations[0]?.id),
  );

  useEffect(() => {
    if (organizations && organizations.length > 0 && !selectedOrg) {
      navigate(`/workspaces/organization/${organizations[0].id}/settings`);
    }
  }, [organizations, selectedOrg, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!organizations || organizations.length === 0 || !selectedOrg) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">No organization found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <WorkspaceNavBar
        organizations={organizations}
        selectedOrgId={selectedOrg.id}
        onOrgChange={(orgId) => {
          navigate(`/workspaces/organization/${orgId}/settings`);
        }}
        onSettingsClick={() => {}}
        onInviteClick={() => {}}
      />

      <div className="container mx-auto p-6 max-w-7xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/workspaces">
            <ArrowLeft className="h-5 w-5 text-gray-600 hover:text-gray-900" />
          </Link>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/workspaces">Workspaces</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {activeTab === "settings" && "Organization Settings"}
                {activeTab === "members" && "Members"}
                {activeTab === "smtp" && "SMTP Settings"}
                {activeTab === "billing" && "Billing"}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Main Content with Sidebar */}
        <div className="flex gap-6">
          {/* Left Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("settings")}
                className={cn(
                  "w-full text-left px-4 py-2 rounded-lg transition-colors",
                  activeTab === "settings"
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                Settings →
              </button>
              <button
                onClick={() => setActiveTab("members")}
                className={cn(
                  "w-full text-left px-4 py-2 rounded-lg transition-colors",
                  activeTab === "members"
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                Members
              </button>
              <button
                onClick={() => setActiveTab("smtp")}
                className={cn(
                  "w-full text-left px-4 py-2 rounded-lg transition-colors",
                  activeTab === "smtp"
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <div className="flex flex-col items-start">
                  <span>SMTP Settings</span>
                  <span className="text-xs text-gray-500 mt-0.5">For sending emails</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab("billing")}
                className={cn(
                  "w-full text-left px-4 py-2 rounded-lg transition-colors",
                  activeTab === "billing"
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                Billing
              </button>
            </nav>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {activeTab === "settings" && (
              <SettingsTab organization={selectedOrg} />
            )}
            {activeTab === "members" && (
              <MembersTab organizationId={selectedOrg.id} />
            )}
            {activeTab === "smtp" && (
              <SMTPTab organizationId={selectedOrg.id} />
            )}
            {activeTab === "billing" && <BillingTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ organization }: { organization: { id: string; name: string } }) {
  const { toast } = useToast();
  const [orgName, setOrgName] = useState(organization.name);
  const [isSaving, setIsSaving] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);

  useEffect(() => {
    setOrgName(organization.name);
  }, [organization.name]);

  const handleSave = async () => {
    if (!orgName.trim()) return;

    setIsSaving(true);
    try {
      await updateOrganization({
        organizationId: organization.id,
        name: orgName.trim(),
      });
      toast({
        title: "Organization updated",
        description: "Organization name has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update organization",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-6">Organization Settings</h1>
      </div>

      {/* Organization Name */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="mt-1"
              placeholder="Enter organization name"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving || !orgName.trim()}>
            {isSaving ? "Updating..." : "Update"}
          </Button>
        </CardContent>
      </Card>

      {/* Submission Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Submission Email Notifications</CardTitle>
              <CardDescription className="mt-1">
                Set the default for new form submission email notifications. Admins can still override this setting for individual forms.
              </CardDescription>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Delete Organization */}
      <Card>
        <CardHeader>
          <CardTitle>Delete Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you want to delete this organization then please delete your account from{" "}
            <WaspRouterLink to={routes.AccountRoute.to} className="text-blue-600 underline">
              account settings
            </WaspRouterLink>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MembersTab({ organizationId }: { organizationId: string }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>(OrganizationRole.EDITOR);
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) return;

    setIsInviting(true);
    try {
      await inviteOrganizationMember({
        organizationId,
        email: email.trim(),
        role,
      });
      toast({
        title: "Member invited",
        description: "Team member has been invited successfully.",
      });
      setEmail("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to invite member",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-6">Members</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
          <CardDescription>
            Invite a user to join your organization by email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as OrganizationRole)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OrganizationRole.VIEWER}>Viewer</SelectItem>
                <SelectItem value={OrganizationRole.EDITOR}>Editor</SelectItem>
                <SelectItem value={OrganizationRole.ADMIN}>Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleInvite}
            className="w-full"
            disabled={isInviting || !email.trim()}
          >
            {isInviting ? "Inviting..." : "Send Invite"}
          </Button>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Current Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <UsersIcon className="h-8 w-8 mr-2" />
            <p>Member list coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SMTPTab({ organizationId }: { organizationId: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-6">SMTP Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Configuration</CardTitle>
          <CardDescription>
            Configure SMTP settings for sending email notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mr-2" />
            <p>SMTP settings coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingTab() {
  const { data: user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg">Not authenticated</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-6">Billing</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan and Billing</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {!!user.email && (
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                  <div className="text-muted-foreground text-sm font-medium">
                    Email address
                  </div>
                  <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                    {user.email}
                  </div>
                </div>
              </div>
            )}
            {!!user.username && (
              <>
                <div className="border-t" />
                <div className="px-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                    <div className="text-muted-foreground text-sm font-medium">
                      Username
                    </div>
                    <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                      {user.username}
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="border-t" />
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                <div className="text-muted-foreground text-sm font-medium">
                  Your Plan
                </div>
                <UserCurrentSubscriptionPlan
                  subscriptionPlan={user.subscriptionPlan}
                  subscriptionStatus={user.subscriptionStatus}
                  datePaid={user.datePaid}
                />
              </div>
            </div>
            <div className="border-t" />
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                <div className="text-muted-foreground text-sm font-medium">
                  Credits
                </div>
                <div className="text-foreground mt-1 text-sm sm:col-span-1 sm:mt-0">
                  {user.credits} credits
                </div>
                <div className="ml-auto mt-4 sm:mt-0">
                  <BuyMoreButton subscriptionStatus={user.subscriptionStatus} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserCurrentSubscriptionPlan({
  subscriptionPlan,
  subscriptionStatus,
  datePaid,
}: Pick<User, "subscriptionPlan" | "subscriptionStatus" | "datePaid">) {
  let subscriptionPlanMessage = "Free Plan";
  if (
    subscriptionPlan !== null &&
    subscriptionStatus !== null &&
    datePaid !== null
  ) {
    subscriptionPlanMessage = formatSubscriptionStatusMessage(
      parsePaymentPlanId(subscriptionPlan),
      datePaid,
      subscriptionStatus as SubscriptionStatus,
    );
  }

  return (
    <>
      <div className="text-foreground mt-1 text-sm sm:col-span-1 sm:mt-0">
        {subscriptionPlanMessage}
      </div>
      <div className="ml-auto mt-4 sm:mt-0">
        <CustomerPortalButton />
      </div>
    </>
  );
}

function formatSubscriptionStatusMessage(
  subscriptionPlan: PaymentPlanId,
  datePaid: Date,
  subscriptionStatus: SubscriptionStatus,
): string {
  const paymentPlanName = prettyPaymentPlanName(subscriptionPlan);
  const statusToMessage: Record<SubscriptionStatus, string> = {
    active: `${paymentPlanName}`,
    past_due: `Payment for your ${paymentPlanName} plan is past due! Please update your subscription payment information.`,
    cancel_at_period_end: `Your ${paymentPlanName} plan subscription has been canceled, but remains active until the end of the current billing period: ${prettyPrintEndOfBillingPeriod(
      datePaid,
    )}`,
    deleted: `Your previous subscription has been canceled and is no longer active.`,
  };

  if (!statusToMessage[subscriptionStatus]) {
    throw new Error(`Invalid subscription status`);
  }

  return statusToMessage[subscriptionStatus];
}

function prettyPrintEndOfBillingPeriod(date: Date) {
  const oneMonthFromNow = new Date(date);
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
  return oneMonthFromNow.toLocaleDateString();
}

function CustomerPortalButton() {
  const { data: customerPortalUrl, isLoading: isCustomerPortalUrlLoading } =
    useQuery(getCustomerPortalUrl);

  if (!customerPortalUrl) {
    return null;
  }

  return (
    <a href={customerPortalUrl} target="_blank" rel="noopener noreferrer">
      <Button disabled={isCustomerPortalUrlLoading} variant="link">
        Manage Payment Details
      </Button>
    </a>
  );
}

function BuyMoreButton({
  subscriptionStatus,
}: Pick<User, "subscriptionStatus">) {
  if (
    subscriptionStatus === SubscriptionStatus.Active ||
    subscriptionStatus === SubscriptionStatus.CancelAtPeriodEnd
  ) {
    return null;
  }

  return (
    <WaspRouterLink
      to={routes.PricingPageRoute.to}
      className="text-primary hover:text-primary/80 text-sm font-medium transition-colors duration-200"
    >
      <Button variant="link">Buy More Credits</Button>
    </WaspRouterLink>
  );
}
