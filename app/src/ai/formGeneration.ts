import { HttpError, prisma } from "wasp/server";
import type { GenerateFormWithAI } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { FormSchema, DEFAULT_FORM_SCHEMA } from "../shared/formTypes";
import { generateId } from "../shared/utils";
import { PaymentPlanId } from "../payment/plans";
import {
  assertAiPipelineAllowed,
  assertRoomForSecondAiStep,
} from "./aiUsageBillingPeriod";
import { evaluatePromptIsFormRelated } from "./promptEvaluation";
import { parseJsonFromAiContent } from "./parseAiJson";

const generateFormWithAISchema = z.object({
  prompt: z.string().min(10).max(400), // 400 character limit
  workspaceId: z.string().uuid(),
});

export const generateFormWithAI: GenerateFormWithAI<
  z.infer<typeof generateFormWithAISchema>,
  any
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const { prompt, workspaceId } = ensureArgsSchemaOrThrowHttpError(
    generateFormWithAISchema,
    rawArgs,
  );

  const userPlan = (context.user.subscriptionPlan as PaymentPlanId) || PaymentPlanId.Free;

  await assertAiPipelineAllowed(context.user.id, prisma);

  // Evaluate the prompt first
  const isFormRelated = await evaluatePromptIsFormRelated(prompt);
  
  // Increment usage count for evaluation (1 interaction)
  await prisma.user.update({
    where: { id: context.user.id },
    data: { aiUsageCount: { increment: 1 } },
  });

  // If evaluation fails, throw error (1 usage already deducted)
  if (!isFormRelated) {
    throw new HttpError(400, "Your prompt is not related to form building. Please provide a prompt about creating forms. 1 interaction has been deducted.");
  }

  await assertRoomForSecondAiStep(context.user.id, prisma);

  try {
    const formSchema = await callAIFormGenerator(prompt, userPlan === PaymentPlanId.Starter);
    
    // Increment usage count for successful generation (1 more interaction)
    await prisma.user.update({
      where: { id: context.user.id },
      data: { aiUsageCount: { increment: 1 } },
    });
    
    return formSchema;
  } catch (error: any) {
    throw new HttpError(500, `AI generation failed: ${error.message}`);
  }
};

async function callAIFormGenerator(prompt: string, useMinimalTokens: boolean = false): Promise<FormSchema> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new HttpError(500, "OpenAI API key not configured");
  }

  // For Starter plan, use a shorter system prompt to minimize tokens
  const systemPrompt = useMinimalTokens
    ? `You output JSON only. Build a form schema: title, description, fields (each field: id, type, label, options if select/radio). Use radio or select with options for quizzes. No markdown, no commentary — JSON object only.`
    : `You are a form builder assistant. Generate a JSON form schema based on user prompts.
You must respond with a single JSON object (no markdown fences, no extra text).

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

Generate appropriate fields based on the user's request.`;

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
            content: useMinimalTokens ? prompt.substring(0, 400) : prompt,
          },
        ],
        temperature: 0.7,
        // Quizzes / many fields need a large completion budget; 500 tokens often truncated mid-JSON.
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
        "AI response was cut off (too many fields). Try a shorter prompt (e.g. fewer questions) or contact support.",
      );
    }

    let parsed: unknown;
    try {
      parsed = parseJsonFromAiContent(content);
    } catch (e) {
      const hint =
        e instanceof Error ? e.message : "Invalid JSON";
      throw new HttpError(
        500,
        `Failed to parse AI response as JSON (${hint}). Try simplifying your prompt.`,
      );
    }
    
    const obj = parsed as Record<string, unknown>;
    const formSchema: FormSchema = {
      title: (typeof obj.title === "string" ? obj.title : null) || "Untitled Form",
      description: (typeof obj.description === "string" ? obj.description : "") || "",
      fields: (Array.isArray(obj.fields) ? obj.fields : []).map((field: any) => ({
        id: field.id || generateId(),
        type: field.type || "text",
        label: field.label || "Untitled Field",
        placeholder: field.placeholder,
        required: field.required || false,
        options: field.options,
      })),
    };

    return formSchema;
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new HttpError(
        500,
        "Failed to parse AI response as JSON. Try a simpler or shorter prompt.",
      );
    }
    throw error;
  }
}

