import { Prisma } from "@prisma/client";
import { HttpError, prisma } from "wasp/server";
import {
  assertCanSubmitAndReserveIfNeeded,
  ensureSubmissionPeriodBeforeSubmit,
} from "../forms/formAndSubmissionLimits";
import type { SubmitFormResponse, GetFormResponses } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { FormStatus } from "@prisma/client";
import { FormSchema, FormField } from "../shared/formTypes";
import { getStarRatingMax } from "../shared/utils";

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
    include: {
      workspace: { select: { organizationId: true } },
    },
  });

  if (!form) {
    throw new HttpError(404, "Form not found");
  }

  if (form.status !== FormStatus.PUBLISHED) {
    throw new HttpError(400, "Form is not published");
  }

  const organizationId = form.workspace.organizationId;

  await ensureSubmissionPeriodBeforeSubmit(prisma, organizationId);

  const response = await prisma.$transaction(
    async (tx) => {
      await assertCanSubmitAndReserveIfNeeded(tx, organizationId);

      return tx.formResponse.create({
        data: {
          formId,
          responseJson,
          metadata: metadata || {},
          fieldResponses: {
            create: parseResponseToFields(
              form.schemaJson as FormSchema,
              responseJson,
              formId,
            ),
          },
        },
      });
    },
    {
      maxWait: 5000,
      timeout: 15000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  await updateFormAnalytics(formId, "submission");

   // Fire-and-forget integrations (webhooks, etc.). Errors are logged but do not
   // block the form submission from succeeding.
   triggerFormIntegrations(formId, response.id, responseJson).catch((error) => {
     console.error("Error triggering form integrations:", error);
   });

  return response;
};

async function triggerFormIntegrations(
  formId: string,
  responseId: string,
  responseJson: any,
): Promise<void> {
  const integrations = await prisma.formIntegration.findMany({
    where: { formId, isEnabled: true },
  });

  if (!integrations.length) {
    return;
  }

  for (const integration of integrations) {
    const config = (integration.configJson || {}) as any;
    const url = config.url as string | undefined;

    if (!url) {
      continue;
    }

    try {
      // All integrations are implemented as outgoing webhooks for now.
      // This lets you plug into Slack, Zapier, email services, Calendly, etc.
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.headers || {}),
        },
        body: JSON.stringify({
          formId,
          responseId,
          provider: integration.provider,
          payload: responseJson,
          createdAt: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error(
        `Error calling ${integration.provider} integration webhook for form ${formId}:`,
        error,
      );
    }
  }
}

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

/**
 * Parse form response JSON into individual field rows for better analytics
 */
function parseResponseToFields(
  schema: FormSchema,
  responseJson: Record<string, any>,
  formId: string,
): Array<{
  formId: string;
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  value?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: Date;
  valueJson?: any;
}> {
  const fieldMap = new Map<string, FormField>();
  schema.fields.forEach((field) => {
    fieldMap.set(field.id, field);
  });

  const fieldResponses: Array<{
    formId: string;
    fieldId: string;
    fieldLabel: string;
    fieldType: string;
    value?: string;
    valueNumber?: number;
    valueBoolean?: boolean;
    valueDate?: Date;
    valueJson?: any;
  }> = [];

  // Process each field in the response
  for (const [fieldId, responseValue] of Object.entries(responseJson)) {
    const field = fieldMap.get(fieldId);
    if (!field) {
      // Skip unknown fields (might be from old form versions)
      continue;
    }

    const baseData = {
      formId,
      fieldId,
      fieldLabel: field.label,
      fieldType: field.type,
    };

    // Store value based on field type
    switch (field.type) {
      case "number":
        const numValue = typeof responseValue === "string" 
          ? parseFloat(responseValue) 
          : typeof responseValue === "number" 
            ? responseValue 
            : null;
        if (numValue !== null && !isNaN(numValue)) {
          fieldResponses.push({
            ...baseData,
            value: String(numValue),
            valueNumber: numValue,
          });
        }
        break;

      case "star_rating": {
        const raw =
          typeof responseValue === "number"
            ? responseValue
            : typeof responseValue === "string"
              ? parseInt(responseValue, 10)
              : NaN;
        const maxStars = getStarRatingMax(field);
        if (Number.isInteger(raw) && raw >= 1 && raw <= maxStars) {
          fieldResponses.push({
            ...baseData,
            value: String(raw),
            valueNumber: raw,
          });
        }
        break;
      }

      case "checkbox":
        fieldResponses.push({
          ...baseData,
          value: String(Boolean(responseValue)),
          valueBoolean: Boolean(responseValue),
        });
        break;

      case "date":
        const dateValue = responseValue 
          ? new Date(responseValue) 
          : null;
        if (dateValue && !isNaN(dateValue.getTime())) {
          fieldResponses.push({
            ...baseData,
            value: dateValue.toISOString(),
            valueDate: dateValue,
          });
        }
        break;

      case "multiselect":
      case "file":
        // Complex types stored as JSON
        fieldResponses.push({
          ...baseData,
          value: Array.isArray(responseValue) 
            ? responseValue.join(", ") 
            : String(responseValue || ""),
          valueJson: responseValue,
        });
        break;

      case "select":
      case "radio":
        // Single selection - store as string and JSON
        fieldResponses.push({
          ...baseData,
          value: String(responseValue || ""),
          valueJson: responseValue,
        });
        break;

      case "text":
      case "textarea":
      case "email":
      default:
        // Text-based fields
        fieldResponses.push({
          ...baseData,
          value: String(responseValue || ""),
        });
        break;
    }
  }

  return fieldResponses;
}

export { updateFormAnalytics };

