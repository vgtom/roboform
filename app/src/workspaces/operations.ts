import { type User } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import type {
  CreateWorkspace,
  GetWorkspaces,
  GetWorkspace,
  UpdateWorkspace,
  DeleteWorkspace,
} from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { generateSlug } from "../shared/utils";
import { OrganizationRole } from "@prisma/client";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  organizationId: z.string().uuid(),
});

const updateWorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
});

const getWorkspaceSchema = z.object({
  id: z.string().uuid(),
});

const deleteWorkspaceSchema = z.object({
  id: z.string().uuid(),
});

async function checkWorkspaceAccess(
  userId: string,
  organizationId: string,
  requiredRole: OrganizationRole = OrganizationRole.VIEWER,
): Promise<void> {
  const member = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!member) {
    throw new HttpError(403, "You don't have access to this organization");
  }

  const roleHierarchy = {
    [OrganizationRole.VIEWER]: 0,
    [OrganizationRole.EDITOR]: 1,
    [OrganizationRole.ADMIN]: 2,
    [OrganizationRole.OWNER]: 3,
  };

  if (roleHierarchy[member.role] < roleHierarchy[requiredRole]) {
    throw new HttpError(
      403,
      `You need at least ${requiredRole} role to perform this action`,
    );
  }
}

export const createWorkspace: CreateWorkspace<
  z.infer<typeof createWorkspaceSchema>,
  { id: string; name: string; slug: string; organizationId: string }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { name, organizationId } = ensureArgsSchemaOrThrowHttpError(
    createWorkspaceSchema,
    rawArgs,
  );

  await checkWorkspaceAccess(
    context.user.id,
    organizationId,
    OrganizationRole.EDITOR,
  );

  const slug = generateSlug(name);
  const existing = await prisma.workspace.findUnique({
    where: {
      organizationId_slug: {
        organizationId,
        slug,
      },
    },
  });

  if (existing) {
    throw new HttpError(400, "Workspace with this name already exists");
  }

  return context.entities.Workspace.create({
    data: {
      name,
      slug,
      organizationId,
    },
  });
};

export const getWorkspaces: GetWorkspaces<
  { organizationId: string },
  Array<{ id: string; name: string; slug: string; createdAt: Date }>
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { organizationId } = ensureArgsSchemaOrThrowHttpError(
    z.object({ organizationId: z.string().uuid() }),
    rawArgs,
  );

  await checkWorkspaceAccess(context.user.id, organizationId);

  let workspaces = await context.entities.Workspace.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // If no workspaces exist, create "My Workspace"
  if (workspaces.length === 0) {
    const defaultWorkspace = await context.entities.Workspace.create({
      data: {
        name: "My Workspace",
        slug: generateSlug("My Workspace"),
        organizationId,
      },
    });
    workspaces = [{
      id: defaultWorkspace.id,
      name: defaultWorkspace.name,
      slug: defaultWorkspace.slug,
      createdAt: defaultWorkspace.createdAt,
    }];
  }

  // Ensure "My Workspace" exists (if user deleted it, recreate it)
  const myWorkspaceExists = workspaces.some((w) => w.name === "My Workspace");
  if (!myWorkspaceExists) {
    const myWorkspace = await context.entities.Workspace.create({
      data: {
        name: "My Workspace",
        slug: generateSlug("My Workspace"),
        organizationId,
      },
    });
    workspaces = [{ ...myWorkspace, id: myWorkspace.id, name: myWorkspace.name, slug: myWorkspace.slug, createdAt: myWorkspace.createdAt }, ...workspaces];
  }

  return workspaces;
};

export const getWorkspace: GetWorkspace<
  z.infer<typeof getWorkspaceSchema>,
  { id: string; name: string; slug: string; organizationId: string }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { id } = ensureArgsSchemaOrThrowHttpError(
    getWorkspaceSchema,
    rawArgs,
  );

  const workspace = await context.entities.Workspace.findUnique({
    where: { id },
    include: { organization: true },
  });

  if (!workspace) {
    throw new HttpError(404, "Workspace not found");
  }

  await checkWorkspaceAccess(context.user.id, workspace.organizationId);

  return workspace;
};

export const updateWorkspace: UpdateWorkspace<
  z.infer<typeof updateWorkspaceSchema>,
  { id: string; name: string; slug: string }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { id, name } = ensureArgsSchemaOrThrowHttpError(
    updateWorkspaceSchema,
    rawArgs,
  );

  const workspace = await context.entities.Workspace.findUnique({
    where: { id },
    include: { organization: true },
  });

  if (!workspace) {
    throw new HttpError(404, "Workspace not found");
  }

  await checkWorkspaceAccess(
    context.user.id,
    workspace.organizationId,
    OrganizationRole.EDITOR,
  );

  const updateData: { name?: string; slug?: string } = {};
  if (name && name !== workspace.name) {
    updateData.name = name;
    const newSlug = generateSlug(name);
    const existing = await prisma.workspace.findUnique({
      where: {
        organizationId_slug: {
          organizationId: workspace.organizationId,
          slug: newSlug,
        },
      },
    });

    if (existing && existing.id !== id) {
      throw new HttpError(400, "Workspace with this name already exists");
    }
    updateData.slug = newSlug;
  }

  return context.entities.Workspace.update({
    where: { id },
    data: updateData,
  });
};

export const deleteWorkspace: DeleteWorkspace<
  z.infer<typeof deleteWorkspaceSchema>,
  { id: string }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { id } = ensureArgsSchemaOrThrowHttpError(
    deleteWorkspaceSchema,
    rawArgs,
  );

  const workspace = await context.entities.Workspace.findUnique({
    where: { id },
    include: { organization: true },
  });

  if (!workspace) {
    throw new HttpError(404, "Workspace not found");
  }

  await checkWorkspaceAccess(
    context.user.id,
    workspace.organizationId,
    OrganizationRole.ADMIN,
  );

  return context.entities.Workspace.delete({
    where: { id },
  });
};

