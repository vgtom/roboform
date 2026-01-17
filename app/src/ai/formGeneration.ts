import { HttpError, prisma } from "wasp/server";
import type { GenerateFormWithAI } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { FormSchema, DEFAULT_FORM_SCHEMA } from "../shared/formTypes";
import { generateId } from "../shared/utils";
import { PaymentPlanId } from "../payment/plans";

const generateFormWithAISchema = z.object({
  prompt: z.string().min(10).max(500),
  workspaceId: z.string().uuid(),
});

const FREE_TIER_AI_LIMIT = 2; // Free tier gets 2 AI requests

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

  // Check if user is on PRO plan
  const isPro = context.user.subscriptionPlan === PaymentPlanId.Pro;
  
  // For free tier, check usage limit
  if (!isPro) {
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: { aiUsageCount: true },
    });

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    if (user.aiUsageCount >= FREE_TIER_AI_LIMIT) {
      throw new HttpError(403, `AI features are disabled for free tier after ${FREE_TIER_AI_LIMIT} uses. Please upgrade to PRO for unlimited AI features.`);
    }

    // Increment usage count for free tier
    await prisma.user.update({
      where: { id: context.user.id },
      data: { aiUsageCount: { increment: 1 } },
    });
  }

  try {
    // For free tier, use minimal tokens
    const formSchema = await callAIFormGenerator(prompt, !isPro);
    return formSchema;
  } catch (error: any) {
    throw new HttpError(500, `AI generation failed: ${error.message}`);
  }
};

async function callAIFormGenerator(prompt: string, isFreeTier: boolean = false): Promise<FormSchema> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new HttpError(500, "OpenAI API key not configured");
  }

  // For free tier, use a much shorter system prompt to minimize tokens
  const systemPrompt = isFreeTier
    ? `Generate form JSON. Return: {"title":"...","description":"...","fields":[{"id":"...","type":"...","label":"..."}]}`
    : `You are a form builder assistant. Generate a JSON form schema based on user prompts.

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
          { role: "user", content: isFreeTier ? prompt.substring(0, 100) : prompt }, // Limit prompt length for free tier
        ],
        temperature: 0.7,
        max_tokens: isFreeTier ? 500 : 2000, // Much lower token limit for free tier
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI API error");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content from AI");
    }

    let jsonContent = content.trim();
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/```\n?/g, "");
    }

    const parsed = JSON.parse(jsonContent);
    
    const formSchema: FormSchema = {
      title: parsed.title || "Untitled Form",
      description: parsed.description || "",
      fields: (parsed.fields || []).map((field: any) => ({
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
      throw new HttpError(500, "Failed to parse AI response as JSON");
    }
    throw error;
  }
}

