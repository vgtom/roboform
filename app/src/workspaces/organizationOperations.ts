import { HttpError, prisma } from "wasp/server";
import type {
  GetUserOrganizations,
  UpdateOrganization,
  InviteOrganizationMember,
} from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { generateSlug } from "../shared/utils";
import { OrganizationRole } from "@prisma/client";
import { PaymentPlanId } from "../payment/plans";

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

  let members = await prisma.organizationMember.findMany({
    where: { userId: context.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  // If user doesn't have an organization, create one automatically on signup
  if (members.length === 0) {
    const orgId = await ensureUserHasOrganization(context.user.id);
    // Fetch the newly created organization
    const newMember = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: context.user.id,
          organizationId: orgId,
        },
      },
      include: { organization: true },
    });
    if (newMember) {
      members = [newMember];
    }
  }

  return members.map((member) => ({
    id: member.organization.id,
    name: member.organization.name,
    slug: member.organization.slug,
    role: member.role,
  }));
};

export const updateOrganization: UpdateOrganization<
  { organizationId: string; name: string },
  { id: string; name: string; slug: string }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { organizationId, name } = ensureArgsSchemaOrThrowHttpError(
    z.object({
      organizationId: z.string().uuid(),
      name: z.string().min(1).max(100),
    }),
    rawArgs,
  );

  // Check if user has PRO plan
  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (user.subscriptionPlan !== PaymentPlanId.Pro) {
    throw new HttpError(403, "Organization name editing requires PRO plan");
  }

  // Check if user is OWNER or ADMIN
  const member = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: context.user.id,
        organizationId,
      },
    },
  });

  if (!member) {
    throw new HttpError(403, "You don't have access to this organization");
  }

  if (member.role !== OrganizationRole.OWNER && member.role !== OrganizationRole.ADMIN) {
    throw new HttpError(403, "Only owners and admins can update organization");
  }

  const slug = generateSlug(name);
  const existing = await prisma.organization.findUnique({
    where: { slug },
  });

  if (existing && existing.id !== organizationId) {
    throw new HttpError(400, "Organization with this name already exists");
  }

  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      name,
      slug,
    },
  });

  return organization;
};

export const inviteOrganizationMember: InviteOrganizationMember<
  { organizationId: string; email: string; role: OrganizationRole },
  { success: boolean }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { organizationId, email, role } = ensureArgsSchemaOrThrowHttpError(
    z.object({
      organizationId: z.string().uuid(),
      email: z.string().email(),
      role: z.nativeEnum(OrganizationRole),
    }),
    rawArgs,
  );

  // Check if user has PRO plan
  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  if (user.subscriptionPlan !== PaymentPlanId.Pro) {
    throw new HttpError(403, "Team member invites require PRO plan");
  }

  // Check if user is OWNER or ADMIN
  const member = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: context.user.id,
        organizationId,
      },
    },
  });

  if (!member) {
    throw new HttpError(403, "You don't have access to this organization");
  }

  if (member.role !== OrganizationRole.OWNER && member.role !== OrganizationRole.ADMIN) {
    throw new HttpError(403, "Only owners and admins can invite members");
  }

  // Find user by email
  const invitedUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!invitedUser) {
    throw new HttpError(404, "User with this email not found. They need to sign up first.");
  }

  // Check if user is already a member
  const existingMember = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: invitedUser.id,
        organizationId,
      },
    },
  });

  if (existingMember) {
    throw new HttpError(400, "User is already a member of this organization");
  }

  // Create member
  await prisma.organizationMember.create({
    data: {
      userId: invitedUser.id,
      organizationId,
      role,
    },
  });

  return { success: true };
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
