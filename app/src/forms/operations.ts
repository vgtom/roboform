import { HttpError, prisma } from "wasp/server";
import type {
  CreateForm,
  GetForms,
  GetAllForms,
  GetForm,
  UpdateForm,
  DeleteForm,
  PublishForm,
  GetPublicForm,
} from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { generateSlug, generateId } from "../shared/utils";
import { FormStatus, OrganizationRole } from "@prisma/client";
import { FormSchema, DEFAULT_FORM_SCHEMA } from "../shared/formTypes";

const createFormSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(100),
  schemaJson: z.any().optional(),
});

const updateFormSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  schemaJson: z.any().optional(),
});

const getFormSchema = z.object({
  id: z.string().uuid(),
});

const deleteFormSchema = z.object({
  id: z.string().uuid(),
});

const publishFormSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

const getPublicFormSchema = z.object({
  id: z.string().uuid(),
});

async function checkFormAccess(
  userId: string,
  workspaceId: string,
  requiredRole: OrganizationRole = OrganizationRole.VIEWER,
): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { organization: { include: { members: true } } },
  });

  if (!workspace) {
    throw new HttpError(404, "Workspace not found");
  }

  const member = workspace.organization.members.find(
    (m) => m.userId === userId,
  );

  if (!member) {
    throw new HttpError(403, "You don't have access to this workspace");
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

function validateFormSchema(schema: unknown): FormSchema {
  try {
    const parsed = z
      .object({
        title: z.string(),
        description: z.string().optional(),
        fields: z.array(
          z.object({
            id: z.string(),
            type: z.string(),
            label: z.string(),
            placeholder: z.string().optional(),
            required: z.boolean().optional(),
            image: z.string().optional(),
            options: z.array(z.string()).optional(),
            validation: z
              .object({
                min: z.number().optional(),
                max: z.number().optional(),
                pattern: z.string().optional(),
                minLength: z.number().optional(),
                maxLength: z.number().optional(),
              })
              .optional(),
          }),
        ),
      })
      .parse(schema);

    return parsed as FormSchema;
  } catch (error) {
    throw new HttpError(400, "Invalid form schema format");
  }
}

export const createForm: CreateForm<
  z.infer<typeof createFormSchema>,
  { id: string; name: string; slug: string; workspaceId: string; schemaJson: any }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { workspaceId, name, schemaJson } = ensureArgsSchemaOrThrowHttpError(
    createFormSchema,
    rawArgs,
  );

  await checkFormAccess(context.user.id, workspaceId, OrganizationRole.EDITOR);

  let baseSlug = generateSlug(name);
  let slug = baseSlug;
  
  // Ensure slug is globally unique
  let counter = 1;
  let existingSlug = await prisma.form.findFirst({
    where: { slug },
  });
  
  while (existingSlug) {
    slug = `${baseSlug}-${counter}`;
    existingSlug = await prisma.form.findFirst({
      where: { slug },
    });
    counter++;
  }

  // Also check workspace uniqueness (though global should be enough)
  const workspaceExisting = await prisma.form.findUnique({
    where: {
      workspaceId_slug: {
        workspaceId,
        slug,
      },
    },
  });

  if (workspaceExisting) {
    // If workspace conflict, append timestamp
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const formSchema = schemaJson
    ? validateFormSchema(schemaJson)
    : DEFAULT_FORM_SCHEMA;

  const newForm = await context.entities.Form.create({
    data: {
      name,
      slug,
      workspaceId,
      schemaJson: formSchema as any,
      status: FormStatus.DRAFT,
    },
  });

  return newForm;
};

export const getForms: GetForms<
  { workspaceId: string },
  Array<{
    id: string;
    name: string;
    slug: string;
    status: FormStatus;
    createdAt: Date;
    updatedAt: Date;
  }>
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { workspaceId } = ensureArgsSchemaOrThrowHttpError(
    z.object({ workspaceId: z.string().uuid() }),
    rawArgs,
  );

  await checkFormAccess(context.user.id, workspaceId);

  const forms = await context.entities.Form.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return forms;
};

export const getAllForms: GetAllForms<
  { search?: string },
  Array<{
    id: string;
    name: string;
    slug: string;
    status: FormStatus;
    createdAt: Date;
    updatedAt: Date;
    workspace: { id: string; name: string };
  }>
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { search } = ensureArgsSchemaOrThrowHttpError(
    z.object({ search: z.string().optional() }),
    rawArgs,
  );

  // Get all organizations user is member of
  const members = await prisma.organizationMember.findMany({
    where: { userId: context.user.id },
    include: { organization: { include: { workspaces: { include: { forms: true } } } } },
  });

  const allForms: Array<{
    id: string;
    name: string;
    slug: string;
    status: FormStatus;
    createdAt: Date;
    updatedAt: Date;
    workspace: { id: string; name: string };
  }> = [];

  for (const member of members) {
    for (const workspace of member.organization.workspaces) {
      for (const form of workspace.forms) {
        allForms.push({
          id: form.id,
          name: form.name,
          slug: form.slug,
          status: form.status,
          createdAt: form.createdAt,
          updatedAt: form.updatedAt,
          workspace: { id: workspace.id, name: workspace.name },
        });
      }
    }
  }

  // Filter by search if provided
  let filteredForms = allForms;
  if (search && search.trim()) {
    const searchLower = search.toLowerCase();
    filteredForms = allForms.filter(
      (form) =>
        form.name.toLowerCase().includes(searchLower) ||
        form.workspace.name.toLowerCase().includes(searchLower),
    );
  }

  // Sort by updatedAt
  filteredForms.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return filteredForms;
};

export const getForm: GetForm<
  z.infer<typeof getFormSchema>,
  { id: string; name: string; slug: string; schemaJson: any; workspaceId: string; status: FormStatus }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { id } = ensureArgsSchemaOrThrowHttpError(getFormSchema, rawArgs);

  const form = await context.entities.Form.findUnique({
    where: { id },
    include: { workspace: { include: { organization: true } } },
  });

  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  await checkFormAccess(context.user.id, form.workspaceId);

  return form;
};

export const updateForm: UpdateForm<
  z.infer<typeof updateFormSchema>,
  { id: string; name?: string; schemaJson?: any }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { id, name, schemaJson } = ensureArgsSchemaOrThrowHttpError(
    updateFormSchema,
    rawArgs,
  );

  const form = await context.entities.Form.findUnique({
    where: { id },
    include: { workspace: true },
  });

  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  await checkFormAccess(context.user.id, form.workspaceId, OrganizationRole.EDITOR);

  const updateData: { name?: string; slug?: string; schemaJson?: any } = {};

  if (name && name !== form.name) {
    updateData.name = name;
    let baseSlug = generateSlug(name);
    let newSlug = baseSlug;
    
    // Ensure new slug is globally unique
    let counter = 1;
    let existingSlug = await prisma.form.findFirst({
      where: { 
        slug: newSlug,
        id: { not: id },
      },
    });
    
    while (existingSlug) {
      newSlug = `${baseSlug}-${counter}`;
      existingSlug = await prisma.form.findFirst({
        where: { 
          slug: newSlug,
          id: { not: id },
        },
      });
      counter++;
    }

    // Check workspace uniqueness
    const workspaceExisting = await prisma.form.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId: form.workspaceId,
          slug: newSlug,
        },
      },
    });

    if (workspaceExisting && workspaceExisting.id !== id) {
      // If workspace conflict, append timestamp
      newSlug = `${newSlug}-${Date.now().toString(36)}`;
    }
    
    updateData.slug = newSlug;
  }
  
  // Ensure form always has a slug (in case it was created without one)
  if (!form.slug && !updateData.slug) {
    updateData.slug = generateSlug(form.name || "untitled-form");
  }

  if (schemaJson !== undefined) {
    const validatedSchema = validateFormSchema(schemaJson);
    updateData.schemaJson = validatedSchema as any;
  }

  return context.entities.Form.update({
    where: { id },
    data: updateData,
  });
};

export const deleteForm: DeleteForm<
  z.infer<typeof deleteFormSchema>,
  { id: string }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { id } = ensureArgsSchemaOrThrowHttpError(deleteFormSchema, rawArgs);

  const form = await context.entities.Form.findUnique({
    where: { id },
    include: { workspace: true },
  });

  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  await checkFormAccess(context.user.id, form.workspaceId, OrganizationRole.EDITOR);

  return context.entities.Form.delete({
    where: { id },
  });
};

export const publishForm: PublishForm<
  z.infer<typeof publishFormSchema>,
  { id: string; status: FormStatus; publishedAt: Date | null }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { id, status } = ensureArgsSchemaOrThrowHttpError(
    publishFormSchema,
    rawArgs,
  );

  const form = await context.entities.Form.findUnique({
    where: { id },
    include: { workspace: true },
  });

  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  await checkFormAccess(context.user.id, form.workspaceId, OrganizationRole.EDITOR);

  return context.entities.Form.update({
    where: { id },
    data: {
      status: status as FormStatus,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });
};

export const getPublicForm: GetPublicForm<
  z.infer<typeof getPublicFormSchema>,
  { id: string; name: string; slug: string; schemaJson: any; status: FormStatus }
> = async (rawArgs, context) => {
  const { id } = ensureArgsSchemaOrThrowHttpError(
    getPublicFormSchema,
    rawArgs,
  );

  // Try to find published form first (public access)
  let form = await prisma.form.findUnique({
    where: {
      id,
      status: FormStatus.PUBLISHED,
    },
  });

  // If not published and user is authenticated, check if they own/have access to draft
  if (!form && context.user) {
    const userForm = await prisma.form.findUnique({
      where: { id },
      include: {
        workspace: {
          include: {
            organization: {
              include: { members: true },
            },
          },
        },
      },
    });
    
    if (userForm) {
      // Check access permission
      const member = userForm.workspace.organization.members.find(
        (m) => m.userId === context.user!.id,
      );
      
      if (member) {
        form = userForm;
      }
    }
  }

  if (!form) {
    throw new HttpError(404, "Form not found or not published");
  }

  return form;
};

