import { useState, useEffect } from "react";
import { useQuery } from "wasp/client/operations";
import {
  getUserOrganizations,
  createOrganization,
  getWorkspaces,
  createWorkspace,
} from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { Link } from "react-router-dom";
import { Button } from "../client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../client/components/ui/dialog";
import { Plus, FolderOpen } from "lucide-react";
import { useToast } from "../client/hooks/use-toast";

export default function WorkspacesPage() {
  const { data: user } = useAuth();
  const { toast } = useToast();
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: organizations, isLoading: orgsLoading } = useQuery(
    getUserOrganizations,
    {},
  );

  useEffect(() => {
    if (!orgsLoading && organizations && organizations.length === 0 && user) {
      const defaultOrgName = user.email || user.username || "My Organization";
      createOrganization({ name: defaultOrgName }).catch((error) => {
        console.error("Failed to create default organization:", error);
      });
    }
  }, [orgsLoading, organizations, user]);

  const { data: workspaces, isLoading: workspacesLoading } = useQuery(
    getWorkspaces,
    selectedOrgId ? { organizationId: selectedOrgId } : undefined,
  );

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) return;

    try {
      await createOrganization({ name: newOrgName.trim() });
      setNewOrgName("");
      setIsCreateDialogOpen(false);
      toast({
        title: "Organization created",
        description: "Your organization has been created successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create organization",
        variant: "destructive",
      });
    }
  };

  if (orgsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const defaultOrg = organizations?.[0];
  if (defaultOrg && !selectedOrgId) {
    setSelectedOrgId(defaultOrg.id);
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Workspaces</h1>
          <p className="text-muted-foreground mt-1">
            Manage your workspaces and forms
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>
                Create a new organization to group your workspaces.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Organization name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateOrganization();
                  }
                }}
              />
              <Button onClick={handleCreateOrganization} className="w-full">
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {organizations && organizations.length > 0 ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Organizations</h2>
            <div className="flex gap-2 flex-wrap">
              {organizations.map((org) => (
                <Button
                  key={org.id}
                  variant={selectedOrgId === org.id ? "default" : "outline"}
                  onClick={() => setSelectedOrgId(org.id)}
                >
                  {org.name}
                </Button>
              ))}
            </div>
          </div>

          {selectedOrgId && (
            <WorkspacesList
              organizationId={selectedOrgId}
              workspaces={workspaces || []}
              isLoading={workspacesLoading}
            />
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first organization to get started
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WorkspacesList({
  organizationId,
  workspaces,
  isLoading,
}: {
  organizationId: string;
  workspaces: Array<{ id: string; name: string; slug: string }>;
  isLoading: boolean;
}) {
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;

    try {
      await createWorkspace({
        organizationId,
        name: newWorkspaceName.trim(),
      });
      setNewWorkspaceName("");
      setIsCreateDialogOpen(false);
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

  if (isLoading) {
    return <div className="text-lg">Loading workspaces...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Workspaces</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace
            </Button>
          </DialogTrigger>
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
              <Button onClick={handleCreateWorkspace} className="w-full">
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {workspaces.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card key={workspace.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>{workspace.name}</CardTitle>
                <CardDescription>Workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/workspaces/${workspace.id}`}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Open
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No workspaces yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first workspace to get started
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

