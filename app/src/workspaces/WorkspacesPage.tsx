import { useState, useEffect, useMemo } from "react";
import { useQuery } from "wasp/client/operations";
import {
  getUserOrganizations,
  updateOrganization,
  inviteOrganizationMember,
  getWorkspaces,
  createWorkspace,
  getAllForms,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../client/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../client/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../client/components/ui/dropdown-menu";
import {
  Plus,
  FolderOpen,
  Settings,
  Users,
  Search,
  FileText,
  Trash2,
  Copy,
  ChevronDown,
  LayoutTemplate,
  Sparkles,
  Loader2,
  Crown,
} from "lucide-react";
import { useToast } from "../client/hooks/use-toast";
import { PaymentPlanId, AI_USAGE_LIMITS } from "../payment/plans";
import { OrganizationRole } from "@prisma/client";
import { createForm, generateFormWithAI } from "wasp/client/operations";
import { FORM_TEMPLATES } from "../templates/templates";
import { deleteForm } from "wasp/client/operations";
import { Textarea } from "../client/components/ui/textarea";
import { WorkspaceNavBar } from "./WorkspaceNavBar";
import { getRandomColorForId } from "../shared/utils";
import { cn } from "../client/utils";

export default function WorkspacesPage() {
  const { data: user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [isOrgSettingsOpen, setIsOrgSettingsOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newFormName, setNewFormName] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [createFormMode, setCreateFormMode] = useState<"manual" | "ai">("manual");

  const { data: organizations, isLoading: orgsLoading } = useQuery(
    getUserOrganizations,
    {},
  );

  useEffect(() => {
    if (organizations && organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const { data: workspaces, isLoading: workspacesLoading } = useQuery(
    getWorkspaces,
    selectedOrgId ? { organizationId: selectedOrgId } : undefined,
  );

  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !selectedWorkspaceId) {
      const myWorkspace = workspaces.find((w) => w.name === "My Workspace");
      setSelectedWorkspaceId(myWorkspace ? myWorkspace.id : workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId]);

  const { data: allForms, isLoading: formsLoading } = useQuery(
    getAllForms,
    { search: searchQuery || undefined },
  );

  const selectedOrg = organizations?.find((org) => org.id === selectedOrgId);
  const selectedWorkspace = workspaces?.find((w) => w.id === selectedWorkspaceId);
  const userPlan = (user?.subscriptionPlan as PaymentPlanId) || PaymentPlanId.Free;
  const aiLimit = AI_USAGE_LIMITS[userPlan];
  const aiUsageCount = user?.aiUsageCount || 0;
  const isAIDisabled = !aiLimit.enabled || (aiLimit.enabled && aiUsageCount >= aiLimit.requestLimit);

  // Filter forms by selected workspace if one is selected
  const displayedForms = useMemo(() => {
    if (!allForms) return [];
    if (selectedWorkspaceId) {
      return allForms.filter((form) => form.workspace.id === selectedWorkspaceId);
    }
    return allForms;
  }, [allForms, selectedWorkspaceId]);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim() || !selectedOrgId) return;

    try {
      await createWorkspace({
        organizationId: selectedOrgId,
        name: newWorkspaceName.trim(),
      });
      setNewWorkspaceName("");
      setIsCreateWorkspaceOpen(false);
      toast({
        title: "Workspace created",
        description: "Your workspace has been created successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create workspace",
        variant: "destructive",
      });
    }
  };

  const handleCreateForm = async (templateName?: string) => {
    if (!selectedWorkspaceId) return;

    const formName = templateName
      ? `${FORM_TEMPLATES[templateName].title}`
      : newFormName.trim();

    if (!formName) return;

    try {
      const template = templateName ? FORM_TEMPLATES[templateName] : undefined;
      const result = await createForm({
        workspaceId: selectedWorkspaceId,
        name: formName,
        schemaJson: template,
      });
      setNewFormName("");
      setIsCreateFormOpen(false);
      toast({
        title: "Form created",
        description: "Your form has been created successfully.",
      });
      navigate(`/workspaces/${selectedWorkspaceId}/forms/${result.id}/edit`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create form",
        variant: "destructive",
      });
    }
  };

  const handleGenerateWithAI = async () => {
    if (!selectedWorkspaceId || !aiPrompt.trim() || aiPrompt.trim().length < 10) {
      toast({
        title: "Error",
        description: "Please enter a prompt with at least 10 characters",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const generatedSchema = await generateFormWithAI({
        workspaceId: selectedWorkspaceId,
        prompt: aiPrompt.trim(),
      });

      // Create form with generated schema
      const formName = generatedSchema.title || "AI Generated Form";
      const result = await createForm({
        workspaceId: selectedWorkspaceId,
        name: formName,
        schemaJson: generatedSchema,
      });

      setAiPrompt("");
      toast({
        title: "Form generated!",
        description: "Your form has been created with AI. You can edit it now.",
      });
      navigate(`/workspaces/${selectedWorkspaceId}/forms/${result.id}/edit`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate form with AI",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteForm = async (formId: string) => {
    if (!confirm("Are you sure you want to delete this form?")) return;

    try {
      await deleteForm({ id: formId });
      toast({
        title: "Form deleted",
        description: "The form has been deleted successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete form",
        variant: "destructive",
      });
    }
  };

  if (orgsLoading || workspacesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Setting up your organization...</div>
      </div>
    );
  }

  const isMyWorkspace = selectedWorkspace?.name === "My Workspace";

  return (
    <div className="min-h-screen bg-background">
      {/* Custom Navbar */}
      <WorkspaceNavBar
        organizations={organizations || []}
        selectedOrgId={selectedOrgId}
        onOrgChange={setSelectedOrgId}
        onSettingsClick={() => setIsOrgSettingsOpen(true)}
        onInviteClick={() => setIsInviteDialogOpen(true)}
      />

      <div className="container mx-auto p-6 max-w-7xl">
        {/* AI Powered Quick Generate Form */}
        <Card className="mb-6 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-gradient-to-br from-blue-500 to-purple-500 p-3">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1 text-gray-900">AI Powered Quick Generate Form</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Describe your form and let AI generate it instantly. No need to build from scratch!
                </p>
                {isAIDisabled ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-yellow-600" />
                        <div>
                          <p className="font-semibold text-yellow-900">
                            {!aiLimit.enabled ? "AI Features Not Available" : "AI Usage Limit Reached"}
                          </p>
                          <p className="text-sm text-yellow-700">
                            {!aiLimit.enabled 
                              ? "AI features are not available on the Free plan. Upgrade to Starter or Pro to use AI features."
                              : `You've reached your AI usage limit (${aiLimit.requestLimit} requests). Upgrade to Pro for more requests.`
                            }
                          </p>
                        </div>
                      </div>
                      <Button asChild variant="default" size="sm">
                        <Link to="/pricing">Upgrade Plan</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Textarea
                          value={aiPrompt}
                          onChange={(e) => {
                            if (e.target.value.length <= 400) {
                              setAiPrompt(e.target.value);
                            }
                          }}
                          placeholder="e.g., Create a SaaS onboarding form with email, company name, team size, and use case selection..."
                          className="min-h-[80px] resize-none bg-white border-blue-200 focus:border-blue-400"
                          disabled={isGenerating || isAIDisabled}
                          maxLength={400}
                        />
                        <div className="flex items-center justify-between mt-1">
                          {aiLimit.enabled && (
                            <p className="text-xs text-gray-500">
                              {aiLimit.requestLimit - aiUsageCount} AI requests remaining ({aiLimit.requestLimit} request limit)
                            </p>
                          )}
                          <p className={cn(
                            "text-xs ml-auto",
                            (400 - aiPrompt.length) < 50 ? "text-orange-600 font-medium" : "text-gray-500"
                          )}>
                            {400 - aiPrompt.length} characters remaining (400 character limit)
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleGenerateWithAI}
                        disabled={!aiPrompt.trim() || aiPrompt.trim().length < 10 || aiPrompt.length > 400 || isGenerating || !selectedWorkspaceId || isAIDisabled}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold px-6 h-[80px] whitespace-nowrap"
                        size="lg"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5 mr-2" />
                            Generate Form
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Minimum 10 characters, maximum 400 characters required. AI will create your form structure automatically.
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Workspace Selector and Actions */}
      <div className="flex items-center gap-4 mb-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[200px] justify-between">
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                {selectedWorkspace?.name || "Select Workspace"}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[200px]">
            {workspaces?.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setSelectedWorkspaceId(workspace.id)}
                className={selectedWorkspaceId === workspace.id ? "bg-accent" : ""}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                {workspace.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsCreateWorkspaceOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Dialog 
          open={isCreateFormOpen} 
          onOpenChange={(open) => {
            setIsCreateFormOpen(open);
            if (!open) {
              // Reset state when dialog closes
              setCreateFormMode("manual");
              setNewFormName("");
              setAiPrompt("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create AI Form
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create AI Form</DialogTitle>
              <DialogDescription>
                Build your form manually or let AI generate it from your description.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="flex gap-2 border-b pb-3">
                <Button
                  variant={createFormMode === "manual" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCreateFormMode("manual")}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Manual
                </Button>
                <Button
                  variant={createFormMode === "ai" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCreateFormMode("ai")}
                  className="flex-1"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Generate
                </Button>
              </div>

              {createFormMode === "manual" ? (
                <>
                  <div>
                    <Label>Form Name</Label>
                    <Input
                      value={newFormName}
                      onChange={(e) => setNewFormName(e.target.value)}
                      placeholder="Enter form name"
                      className="mt-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newFormName.trim()) {
                          handleCreateForm();
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={() => handleCreateForm()}
                    className="w-full"
                    disabled={!newFormName.trim()}
                  >
                    Create Blank Form
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <Label>Describe your form</Label>
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => {
                        if (e.target.value.length <= 400) {
                          setAiPrompt(e.target.value);
                        }
                      }}
                      placeholder="e.g., Create a SaaS onboarding form with email, company name, team size, and use case selection..."
                      className="mt-1 min-h-[120px]"
                      disabled={isGenerating}
                      maxLength={400}
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        Describe what kind of form you want to create. AI will generate the form structure for you.
                      </p>
                      <p className={cn(
                        "text-xs ml-auto",
                        (400 - aiPrompt.length) < 50 ? "text-orange-600 font-medium" : "text-gray-500"
                      )}>
                        {400 - aiPrompt.length} characters remaining (400 character limit)
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleGenerateWithAI}
                    className="w-full"
                    disabled={!aiPrompt.trim() || aiPrompt.trim().length < 10 || aiPrompt.length > 400 || isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Form with AI
                      </>
                    )}
                  </Button>
                </>
              )}
              {isMyWorkspace && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or use a template
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(FORM_TEMPLATES).map((templateName) => (
                      <Button
                        key={templateName}
                        variant="outline"
                        onClick={() => handleCreateForm(templateName)}
                        className="h-auto py-3 flex-col items-start"
                        style={{
                          backgroundColor: getRandomColorForId(templateName, 0.12),
                          borderColor: getRandomColorForId(templateName, 0.3),
                        }}
                      >
                        <LayoutTemplate className="h-5 w-5 mb-1" />
                        <span className="text-xs">
                          {FORM_TEMPLATES[templateName].title}
                        </span>
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Forms Grid */}
      {formsLoading ? (
        <div className="text-center py-12">Loading forms...</div>
      ) : displayedForms && displayedForms.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedForms.map((form) => (
            <Card 
              key={form.id} 
              className="hover:shadow-lg transition-shadow"
              style={{ 
                backgroundColor: getRandomColorForId(form.id, 0.08),
              }}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{form.name}</CardTitle>
                    <CardDescription>
                      {form.workspace.name} • {form.status === "PUBLISHED" ? "Published" : "Draft"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteForm(form.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    asChild
                  >
                    <Link to={`/workspaces/${form.workspace.id}/forms/${form.id}/edit`}>
                      <FileText className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  {form.status === "PUBLISHED" && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const url = `${window.location.origin}/f/${form.id}`;
                        navigator.clipboard.writeText(url);
                        toast({
                          title: "Link copied",
                          description: "Form link copied to clipboard",
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? "No forms found" : "No forms yet"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery
                ? "Try adjusting your search"
                : "Create your first form to get started"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Form
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Organization Settings Dialog - Now accessible via navbar */}
      {userPlan !== PaymentPlanId.Free && selectedOrg && (
        <OrganizationSettingsDialog
          organization={selectedOrg}
          open={isOrgSettingsOpen}
          onOpenChange={setIsOrgSettingsOpen}
        />
      )}

      {/* Invite Member Dialog */}
      {userPlan !== PaymentPlanId.Free && selectedOrg && (
        <InviteMemberDialog
          organizationId={selectedOrg.id}
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
        />
      )}

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateWorkspaceOpen} onOpenChange={setIsCreateWorkspaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Create a workspace to organize your forms.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateWorkspace();
                }
              }}
            />
            <Button onClick={handleCreateWorkspace} className="w-full" disabled={!newWorkspaceName.trim()}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

function OrganizationSettingsDialog({
  organization,
  open,
  onOpenChange,
}: {
  organization: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [orgName, setOrgName] = useState(organization.name);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

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
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Organization Settings</DialogTitle>
          <DialogDescription>
            Update your organization name and settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={handleSave} className="w-full" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InviteMemberDialog({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>(OrganizationRole.EDITOR);
  const [isInviting, setIsInviting] = useState(false);
  const { toast } = useToast();

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
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Invite a user to join your organization by email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
            <Select value={role} onValueChange={(value) => setRole(value as OrganizationRole)}>
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
          <Button onClick={handleInvite} className="w-full" disabled={isInviting}>
            {isInviting ? "Inviting..." : "Send Invite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
