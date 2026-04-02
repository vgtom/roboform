import type { Prisma, PrismaClient } from "@prisma/client";
import { OrganizationRole } from "@prisma/client";
import { HttpError } from "wasp/server";
import { ensureAiUsageBillingPeriodAligned } from "../ai/aiUsageBillingPeriod";
import {
  FORM_LIMITS,
  PaymentPlanId,
  parsePaymentPlanId,
  SUBMISSION_LIMITS,
} from "../payment/plans";

type Db = PrismaClient | Prisma.TransactionClient;

export async function getOrganizationOwnerUserId(
  db: Db,
  organizationId: string,
): Promise<string | null> {
  const m = await db.organizationMember.findFirst({
    where: { organizationId, role: OrganizationRole.OWNER },
    select: { userId: true },
  });
  return m?.userId ?? null;
}

function resolvePlan(subscriptionPlan: string | null | undefined): PaymentPlanId {
  const planIdStr = subscriptionPlan ?? PaymentPlanId.Free;
  try {
    return parsePaymentPlanId(planIdStr);
  } catch {
    return PaymentPlanId.Free;
  }
}

/**
 * Enforce max forms per org (owner’s plan). Use inside a transaction with serializable
 * isolation if you need to avoid races when creating forms.
 */
export async function assertCanCreateForm(
  db: Db,
  workspaceId: string,
): Promise<void> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });
  if (!workspace) {
    throw new HttpError(404, "Workspace not found");
  }

  const ownerId = await getOrganizationOwnerUserId(
    db,
    workspace.organizationId,
  );
  if (!ownerId) {
    throw new HttpError(500, "Workspace organization has no owner");
  }

  const owner = await db.user.findUnique({
    where: { id: ownerId },
    select: { subscriptionPlan: true },
  });
  if (!owner) {
    throw new HttpError(500, "Organization owner not found");
  }

  const plan = resolvePlan(owner.subscriptionPlan);
  const maxForms = FORM_LIMITS[plan];
  if (maxForms == null) {
    return;
  }

  const count = await db.form.count({
    where: { workspace: { organizationId: workspace.organizationId } },
  });

  if (count >= maxForms) {
    throw new HttpError(
      403,
      `Form limit reached for this workspace (${maxForms} forms on the ${plan} plan). Upgrade to create more forms.`,
    );
  }
}

/**
 * Starter: align billing period with Lemon before submit (API). Call outside the submit transaction.
 */
export async function ensureSubmissionPeriodBeforeSubmit(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const ownerId = await getOrganizationOwnerUserId(prisma, organizationId);
  if (!ownerId) {
    throw new HttpError(500, "Form organization has no owner");
  }
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { subscriptionPlan: true },
  });
  const plan = resolvePlan(owner?.subscriptionPlan);
  if (plan !== PaymentPlanId.Starter) {
    return;
  }
  await ensureAiUsageBillingPeriodAligned(ownerId, prisma);
}

/**
 * Inside a transaction: enforce Free lifetime cap or reserve one Starter slot (increment).
 * Pro/Ultimate: no-op.
 */
export async function assertCanSubmitAndReserveIfNeeded(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<void> {
  const ownerId = await getOrganizationOwnerUserId(tx, organizationId);
  if (!ownerId) {
    throw new HttpError(500, "Form organization has no owner");
  }

  const owner = await tx.user.findUnique({
    where: { id: ownerId },
    select: { subscriptionPlan: true, submissionUsageCount: true },
  });
  if (!owner) {
    throw new HttpError(500, "Organization owner not found");
  }

  const plan = resolvePlan(owner.subscriptionPlan);
  const subLimit = SUBMISSION_LIMITS[plan];

  if (subLimit.max == null) {
    return;
  }

  if (plan === PaymentPlanId.Free && subLimit.scope === "lifetime") {
    const total = await tx.formResponse.count({
      where: {
        form: { workspace: { organizationId } },
      },
    });
    if (total >= subLimit.max) {
      throw new HttpError(
        403,
        `Response limit reached (${subLimit.max} total submissions on the Free plan). Upgrade for more.`,
      );
    }
    return;
  }

  if (plan === PaymentPlanId.Starter && subLimit.scope === "billing_period") {
    const max = subLimit.max;
    const result = await tx.user.updateMany({
      where: { id: ownerId, submissionUsageCount: { lt: max } },
      data: { submissionUsageCount: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new HttpError(
        403,
        `Submission limit reached for this billing period (${max} on the Starter plan). Resets when your subscription renews, or upgrade to Pro for unlimited submissions.`,
      );
    }
  }
}
