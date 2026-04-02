import { type Prisma } from "@prisma/client";
import { type User } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import {
  type GetAiUsageCalendarStatus,
  type GetPaginatedUsers,
  type DeleteUserById,
  type UpdateIsUserAdminById,
} from "wasp/server/operations";
import * as z from "zod";
import { ensureAiUsageBillingPeriodAligned } from "../ai/aiUsageBillingPeriod";
import {
  AI_USAGE_LIMITS,
  getAiUsageQuotaScope,
  PaymentPlanId,
  SubscriptionStatus,
} from "../payment/plans";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";

const updateUserAdminByIdInputSchema = z.object({
  id: z.string().nonempty(),
  isAdmin: z.boolean(),
});

type UpdateUserAdminByIdInput = z.infer<typeof updateUserAdminByIdInputSchema>;

export const updateIsUserAdminById: UpdateIsUserAdminById<
  UpdateUserAdminByIdInput,
  User
> = async (rawArgs, context) => {
  const { id, isAdmin } = ensureArgsSchemaOrThrowHttpError(
    updateUserAdminByIdInputSchema,
    rawArgs,
  );

  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  if (!context.user.isAdmin) {
    throw new HttpError(
      403,
      "Only admins are allowed to perform this operation",
    );
  }

  return context.entities.User.update({
    where: { id },
    data: { isAdmin },
  });
};

const deleteUserByIdInputSchema = z.object({
  id: z.string().uuid(),
});

type DeleteUserByIdInput = z.infer<typeof deleteUserByIdInputSchema>;

/**
 * Admin "Delete" action for the Users dashboard.
 * We don't hard-delete the User row to avoid breaking relations; instead we
 * deactivate the account back to Free / Deleted plan.
 */
export const deleteUserById: DeleteUserById<
  DeleteUserByIdInput,
  User
> = async (rawArgs, context) => {
  const { id } = ensureArgsSchemaOrThrowHttpError(
    deleteUserByIdInputSchema,
    rawArgs,
  );

  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  if (!context.user.isAdmin) {
    throw new HttpError(
      403,
      "Only admins are allowed to perform this operation",
    );
  }

  if (context.user.id === id) {
    throw new HttpError(403, "You cannot delete your own account");
  }

  return context.entities.User.update({
    where: { id },
    data: {
      isAdmin: false,
      subscriptionPlan: PaymentPlanId.Free,
      subscriptionStatus: SubscriptionStatus.Deleted,
      datePaid: null,
      credits: 0,
      aiUsageCount: 0,
      submissionUsageCount: 0,
      lemonSubscriptionId: null,
      aiUsagePeriodEndsAt: null,
    },
  });
};

type GetPaginatedUsersOutput = {
  users: Pick<
    User,
    | "id"
    | "email"
    | "username"
    | "subscriptionStatus"
    | "paymentProcessorUserId"
    | "isAdmin"
  >[];
  totalPages: number;
};

const getPaginatorArgsSchema = z.object({
  skipPages: z.number(),
  filter: z.object({
    emailContains: z.string().nonempty().optional(),
    isAdmin: z.boolean().optional(),
    subscriptionStatusIn: z
      .array(z.nativeEnum(SubscriptionStatus).nullable())
      .optional(),
  }),
});

type GetPaginatedUsersInput = z.infer<typeof getPaginatorArgsSchema>;

export const getPaginatedUsers: GetPaginatedUsers<
  GetPaginatedUsersInput,
  GetPaginatedUsersOutput
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation",
    );
  }

  if (!context.user.isAdmin) {
    throw new HttpError(
      403,
      "Only admins are allowed to perform this operation",
    );
  }

  const {
    skipPages,
    filter: {
      subscriptionStatusIn: subscriptionStatus,
      emailContains,
      isAdmin,
    },
  } = ensureArgsSchemaOrThrowHttpError(getPaginatorArgsSchema, rawArgs);

  const includeUnsubscribedUsers = !!subscriptionStatus?.some(
    (status) => status === null,
  );
  const desiredSubscriptionStatuses = subscriptionStatus?.filter(
    (status) => status !== null,
  );

  const pageSize = 10;

  const userPageQuery: Prisma.UserFindManyArgs = {
    skip: skipPages * pageSize,
    take: pageSize,
    where: {
      AND: [
        {
          email: {
            contains: emailContains,
            mode: "insensitive",
          },
          isAdmin,
        },
        {
          OR: [
            {
              subscriptionStatus: {
                in: desiredSubscriptionStatuses,
              },
            },
            {
              subscriptionStatus: includeUnsubscribedUsers ? null : undefined,
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      email: true,
      username: true,
      isAdmin: true,
      subscriptionStatus: true,
      paymentProcessorUserId: true,
    },
    orderBy: {
      username: "asc",
    },
  };

  const [pageOfUsers, totalUsers] = await prisma.$transaction([
    context.entities.User.findMany(userPageQuery),
    context.entities.User.count({ where: userPageQuery.where }),
  ]);
  const totalPages = Math.ceil(totalUsers / pageSize);

  return {
    users: pageOfUsers,
    totalPages,
  };
};

export const getAiUsageCalendarStatus: GetAiUsageCalendarStatus<
  void,
  {
    enabled: boolean;
    used: number;
    limit: number;
    /** ISO end of current prepaid period (Lemon renews_at / ends_at); null for lifetime quota or unknown */
    billingPeriodEndsAt: string | null;
    /** `lifetime` = total cap never resets with renewals */
    quotaScope: "billing_period" | "lifetime" | null;
  }
> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }
  await ensureAiUsageBillingPeriodAligned(context.user.id, prisma);
  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
    select: {
      subscriptionPlan: true,
      aiUsageCount: true,
      aiUsagePeriodEndsAt: true,
    },
  });
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  const plan =
    (user.subscriptionPlan as PaymentPlanId) || PaymentPlanId.Free;
  const cfg = AI_USAGE_LIMITS[plan];
  const quotaScope = getAiUsageQuotaScope(plan);
  return {
    enabled: cfg.enabled,
    used: user.aiUsageCount,
    limit: cfg.enabled ? cfg.interactionLimit : 0,
    billingPeriodEndsAt:
      quotaScope === "lifetime"
        ? null
        : user.aiUsagePeriodEndsAt?.toISOString() ?? null,
    quotaScope,
  };
};
