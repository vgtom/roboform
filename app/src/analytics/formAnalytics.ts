import { HttpError, prisma } from "wasp/server";
import type { GetFormAnalytics, TrackFormView } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { updateFormAnalytics } from "../responses/operations";

const getFormAnalyticsSchema = z.object({
  formId: z.string().uuid(),
});

const trackFormViewSchema = z.object({
  formId: z.string().uuid(),
});

export const getFormAnalytics: GetFormAnalytics<
  z.infer<typeof getFormAnalyticsSchema>,
  {
    views: number;
    submissions: number;
    completionRate: number;
  }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { formId } = ensureArgsSchemaOrThrowHttpError(
    getFormAnalyticsSchema,
    rawArgs,
  );

  const form = await prisma.form.findUnique({
    where: { id: formId },
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

  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  const member = form.workspace.organization.members.find(
    (m) => m.userId === context.user!.id,
  );

  if (!member) {
    throw new HttpError(403, "You don't have access to this form");
  }

  const analytics = await prisma.formAnalytics.findUnique({
    where: { formId },
  });

  return {
    views: analytics?.views || 0,
    submissions: analytics?.submissions || 0,
    completionRate: analytics?.completionRate || 0,
  };
};

export const trackFormView: TrackFormView<
  z.infer<typeof trackFormViewSchema>,
  void
> = async (rawArgs, context) => {
  const { formId } = ensureArgsSchemaOrThrowHttpError(
    trackFormViewSchema,
    rawArgs,
  );

  const form = await prisma.form.findUnique({
    where: { id: formId },
  });

  if (!form || form.status !== "PUBLISHED") {
    return;
  }

  await updateFormAnalytics(formId, "view");
};

