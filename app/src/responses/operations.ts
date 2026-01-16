import { HttpError, prisma } from "wasp/server";
import type { SubmitFormResponse, GetFormResponses } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { FormStatus } from "@prisma/client";

const submitFormResponseSchema = z.object({
  formId: z.string().uuid(),
  responseJson: z.any(),
  metadata: z.any().optional(),
});

const getFormResponsesSchema = z.object({
  formId: z.string().uuid(),
});

export const submitFormResponse: SubmitFormResponse<
  z.infer<typeof submitFormResponseSchema>,
  { id: string; formId: string; createdAt: Date }
> = async (rawArgs, context) => {
  const { formId, responseJson, metadata } = ensureArgsSchemaOrThrowHttpError(
    submitFormResponseSchema,
    rawArgs,
  );

  const form = await prisma.form.findUnique({
    where: { id: formId },
  });

  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  if (form.status !== FormStatus.PUBLISHED) {
    throw new HttpError(400, "Form is not published");
  }

  const response = await context.entities.FormResponse.create({
    data: {
      formId,
      responseJson,
      metadata: metadata || {},
    },
  });

  await updateFormAnalytics(formId, "submission");

  return response;
};

export const getFormResponses: GetFormResponses<
  z.infer<typeof getFormResponsesSchema>,
  Array<{ id: string; responseJson: any; createdAt: Date }>
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { formId } = ensureArgsSchemaOrThrowHttpError(
    getFormResponsesSchema,
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

  const responses = await context.entities.FormResponse.findMany({
    where: { formId },
    select: {
      id: true,
      responseJson: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return responses;
};

async function updateFormAnalytics(
  formId: string,
  event: "view" | "submission",
): Promise<void> {
  const analytics = await prisma.formAnalytics.findUnique({
    where: { formId },
  });

  if (event === "view") {
    if (analytics) {
      await prisma.formAnalytics.update({
        where: { formId },
        data: {
          views: { increment: 1 },
        },
      });
    } else {
      await prisma.formAnalytics.create({
        data: {
          formId,
          views: 1,
          submissions: 0,
          completionRate: 0,
        },
      });
    }
  } else if (event === "submission") {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: { analytics: true },
    });

    if (!form) return;

    const currentViews = form.analytics?.views || 0;
    const currentSubmissions = form.analytics?.submissions || 0;
    const newSubmissions = currentSubmissions + 1;
    const completionRate =
      currentViews > 0 ? (newSubmissions / currentViews) * 100 : 0;

    if (analytics) {
      await prisma.formAnalytics.update({
        where: { formId },
        data: {
          submissions: { increment: 1 },
          completionRate,
        },
      });
    } else {
      await prisma.formAnalytics.create({
        data: {
          formId,
          views: currentViews,
          submissions: 1,
          completionRate,
        },
      });
    }
  }
}

export { updateFormAnalytics };

