import { HttpError, prisma } from "wasp/server";
import type { GetUserOrganizations, CreateOrganization } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { generateSlug } from "../shared/utils";
import { OrganizationRole } from "@prisma/client";

export const getUserOrganizations: GetUserOrganizations<
  {},
  Array<{
    id: string;
    name: string;
    slug: string;
    role: OrganizationRole;
  }>
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const members = await prisma.organizationMember.findMany({
    where: { userId: context.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  return members.map((member) => ({
    id: member.organization.id,
    name: member.organization.name,
    slug: member.organization.slug,
    role: member.role,
  }));
};

export const createOrganization: CreateOrganization<
  { name: string },
  { id: string; name: string; slug: string }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { name } = ensureArgsSchemaOrThrowHttpError(
    z.object({ name: z.string().min(1).max(100) }),
    rawArgs,
  );

  const slug = generateSlug(name);
  const existing = await prisma.organization.findUnique({
    where: { slug },
  });

  if (existing) {
    throw new HttpError(400, "Organization with this name already exists");
  }

  const organization = await prisma.organization.create({
    data: {
      name,
      slug,
      members: {
        create: {
          userId: context.user.id,
          role: OrganizationRole.OWNER,
        },
      },
    },
  });

  return organization;
};

export async function ensureUserHasOrganization(userId: string): Promise<string> {
  const member = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: true },
  });

  if (member) {
    return member.organization.id;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const orgName = user.email || user.username || `Organization ${userId.slice(0, 8)}`;
  const slug = generateSlug(orgName);
  
  let finalSlug = slug;
  let counter = 1;
  while (await prisma.organization.findUnique({ where: { slug: finalSlug } })) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  const organization = await prisma.organization.create({
    data: {
      name: orgName,
      slug: finalSlug,
      members: {
        create: {
          userId,
          role: OrganizationRole.OWNER,
        },
      },
    },
  });

  return organization.id;
}

