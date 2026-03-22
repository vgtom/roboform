import { HttpError, prisma } from "wasp/server";
import type { ModifyFormWithAI } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { FormSchema } from "../shared/formTypes";
import { generateId } from "../shared/utils";
import { PaymentPlanId } from "../payment/plans";
import {
  assertAiPipelineAllowed,
  assertRoomForSecondAiStep,
} from "./aiUsageBillingPeriod";
import { evaluatePromptIsFormRelated } from "./promptEvaluation";
import { parseJsonFromAiContent } from "./parseAiJson";

const modifyFormWithAISchema = z.object({
  currentSchema: z.any(), // The current form schema
  modificationPrompt: z.string().min(10).max(400), // What the user wants to change (400 char limit)
});

export const modifyFormWithAI: ModifyFormWithAI<
  z.infer<typeof modifyFormWithAISchema>,
  FormSchema
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { currentSchema, modificationPrompt } = ensureArgsSchemaOrThrowHttpError(
    modifyFormWithAISchema,
    rawArgs,
  );

  const userPlan = (context.user.subscriptionPlan as PaymentPlanId) || PaymentPlanId.Free;

  await assertAiPipelineAllowed(context.user.id, prisma);

  // Evaluate the prompt first
  const isFormRelated = await evaluatePromptIsFormRelated(modificationPrompt);
  
  // Increment usage count for evaluation (1 interaction)
  await prisma.user.update({
    where: { id: context.user.id },
    data: { aiUsageCount: { increment: 1 } },
  });

  // If evaluation fails, throw error (1 usage already deducted)
  if (!isFormRelated) {
    throw new HttpError(400, "Your prompt is not related to form building or modification. Please provide a prompt about creating or modifying forms. 1 interaction has been deducted.");
  }

  await assertRoomForSecondAiStep(context.user.id, prisma);

  try {
    const modifiedSchema = await callAIModifyForm(
      currentSchema, 
      modificationPrompt,
      userPlan === PaymentPlanId.Starter // Use minimal tokens for Starter
    );
    
    // Increment usage count for successful modification (1 more interaction)
    await prisma.user.update({
      where: { id: context.user.id },
      data: { aiUsageCount: { increment: 1 } },
    });
    
    return modifiedSchema;
  } catch (error: any) {
    throw new HttpError(500, `AI modification failed: ${error.message}`);
  }
};

async function callAIModifyForm(
  currentSchema: FormSchema,
  modificationPrompt: string,
  useMinimalTokens: boolean = false,
): Promise<FormSchema> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new HttpError(500, "OpenAI API key not configured");
  }

  // For Starter plan, use a shorter system prompt to minimize tokens
  const systemPrompt = useMinimalTokens
    ? `Modify this form schema. Return complete JSON. Preserve existing fields unless removed. Current: ${JSON.stringify(currentSchema)}. Return JSON:`
    : `You are a form builder assistant. Your task is to MODIFY an existing form schema based on user requests.

IMPORTANT RULES:
1. You MUST return the COMPLETE modified form schema, not just the changes
2. Preserve all existing fields unless the user explicitly asks to remove them
3. When adding fields, use unique IDs (generate new IDs for new fields)
4. When modifying fields, keep the same field IDs
5. Only make the exact changes requested by the user
6. Preserve the form title and description unless the user asks to change them

The current form schema is:
${JSON.stringify(currentSchema, null, 2)}

Return ONLY valid JSON matching this structure:
{
  "title": "Form Title",
  "description": "Optional description",
  "fields": [
    {
      "id": "unique-id",
      "type": "text|textarea|email|number|select|multiselect|radio|checkbox|date|file",
      "label": "Field Label",
      "placeholder": "Optional placeholder",
      "required": true/false,
      "options": ["option1", "option2"]
    }
  ]
}

Field types:
- text: Single line text input
- textarea: Multi-line text input
- email: Email input
- number: Number input
- select: Dropdown selection
- multiselect: Multiple checkboxes
- radio: Radio buttons
- checkbox: Single checkbox
- date: Date picker
- file: File upload

Modify the form according to the user's request and return the complete modified schema.
You must respond with a single JSON object (no markdown fences, no extra text).`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: useMinimalTokens ? modificationPrompt.substring(0, 400) : modificationPrompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent modifications
        max_tokens: useMinimalTokens ? 3000 : 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI API error");
    }

    const data = await response.json();
    const choice = data.choices[0];
    const content = choice?.message?.content;

    if (!content) {
      throw new Error("No content from AI");
    }

    if (choice?.finish_reason === "length") {
      throw new HttpError(
        500,
        "AI response was cut off (form too large). Try removing some fields or a shorter change request.",
      );
    }

    let parsed: unknown;
    try {
      parsed = parseJsonFromAiContent(content);
    } catch (e) {
      const hint = e instanceof Error ? e.message : "Invalid JSON";
      throw new HttpError(
        500,
        `Failed to parse AI response as JSON (${hint}). Try simplifying your request.`,
      );
    }

    const obj = parsed as Record<string, unknown>;
    const modifiedSchema: FormSchema = {
      title:
        (typeof obj.title === "string" ? obj.title : null) ||
        currentSchema.title ||
        "Untitled Form",
      description:
        obj.description !== undefined && typeof obj.description === "string"
          ? obj.description
          : currentSchema.description || "",
      fields: (Array.isArray(obj.fields) ? obj.fields : []).map((field: any) => ({
        id: field.id || generateId(),
        type: field.type || "text",
        label: field.label || "Untitled Field",
        placeholder: field.placeholder,
        required: field.required || false,
        options: field.options,
        image: field.image, // Preserve image if present
      })),
    };

    return modifiedSchema;
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new HttpError(
        500,
        "Failed to parse AI response as JSON. Try a simpler request.",
      );
    }
    throw error;
  }
}

