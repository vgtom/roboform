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
  Crown,
  Search,
  FileText,
  Trash2,
  Copy,
  ChevronDown,
  LayoutTemplate,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useToast } from "../client/hooks/use-toast";
import { PaymentPlanId } from "../payment/plans";
import { OrganizationRole } from "@prisma/client";
import { createForm, generateFormWithAI } from "wasp/client/operations";
import { FORM_TEMPLATES } from "../templates/templates";
import { deleteForm } from "wasp/client/operations";
import { Textarea } from "../client/components/ui/textarea";

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
  const isPro = user?.subscriptionPlan === PaymentPlanId.Pro;

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
      setIsCreateFormOpen(false);
      setCreateFormMode("manual");
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
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">Forms</h1>
          <p className="text-muted-foreground">Create and manage your forms</p>
        </div>
        <div className="flex items-center gap-3">
          {isPro && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOrgSettingsOpen(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInviteDialogOpen(true)}
              >
                <Users className="h-4 w-4 mr-2" />
                Invite
              </Button>
            </>
          )}
        </div>
      </div>

      {/* PRO Upgrade Banner */}
      {!isPro && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-semibold text-yellow-900">Upgrade to PRO</p>
                <p className="text-sm text-yellow-700">
                  Unlock team collaboration, organization customization, and more
                </p>
              </div>
            </div>
            <Button asChild variant="default">
              <Link to="/pricing">Upgrade</Link>
            </Button>
          </CardContent>
        </Card>
      )}

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
              Create Form
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Form</DialogTitle>
              <DialogDescription>
                Start from scratch, use AI, or choose a template.
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
                    Create from Scratch
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <Label>Describe your form</Label>
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g., Create a SaaS onboarding form with email, company name, team size, and use case selection..."
                      className="mt-1 min-h-[120px]"
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Describe what kind of form you want to create. AI will generate the form structure for you.
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateWithAI}
                    className="w-full"
                    disabled={!aiPrompt.trim() || aiPrompt.trim().length < 10 || isGenerating}
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
            <Card key={form.id} className="hover:shadow-lg transition-shadow">
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

      {/* Organization Settings Dialog */}
      {isPro && selectedOrg && (
        <OrganizationSettingsDialog
          organization={selectedOrg}
          open={isOrgSettingsOpen}
          onOpenChange={setIsOrgSettingsOpen}
        />
      )}

      {/* Invite Member Dialog */}
      {isPro && selectedOrg && (
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
