import { HttpError, prisma } from "wasp/server";
import type { GenerateFormWithAI } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { FormSchema, DEFAULT_FORM_SCHEMA } from "../shared/formTypes";
import { generateId } from "../shared/utils";
import { PaymentPlanId, AI_USAGE_LIMITS } from "../payment/plans";
import { evaluatePromptIsFormRelated } from "./promptEvaluation";

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
  const aiLimit = AI_USAGE_LIMITS[userPlan];
  
  // Check if AI features are enabled for this plan
  if (!aiLimit.enabled) {
    throw new HttpError(403, "AI features are not available on the Free plan. Please upgrade to Starter or Pro to use AI features.");
  }
  
  // Check AI usage count limit
  const user = await prisma.user.findUnique({
    where: { id: context.user.id },
    select: { aiUsageCount: true },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  // Check if user has reached their request limit
  if (user.aiUsageCount >= aiLimit.requestLimit) {
    const remaining = aiLimit.requestLimit - user.aiUsageCount;
    throw new HttpError(403, `AI usage limit reached. You have used all ${aiLimit.requestLimit} requests. Please upgrade to Pro for more requests.`);
  }

  // Evaluate the prompt first
  const isFormRelated = await evaluatePromptIsFormRelated(prompt);
  
  // Increment usage count for evaluation (1 request)
  await prisma.user.update({
    where: { id: context.user.id },
    data: { aiUsageCount: { increment: 1 } },
  });

  // If evaluation fails, throw error (1 usage already deducted)
  if (!isFormRelated) {
    throw new HttpError(400, "Your prompt is not related to form building. Please provide a prompt about creating forms. 1 request has been deducted.");
  }

  try {
    const formSchema = await callAIFormGenerator(prompt, userPlan === PaymentPlanId.Starter);
    
    // Increment usage count for successful generation (1 more request)
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
          { role: "user", content: useMinimalTokens ? prompt.substring(0, 100) : prompt }, // Limit prompt length for Starter
        ],
        temperature: 0.7,
        max_tokens: useMinimalTokens ? 500 : 2000, // Lower token limit for Starter plan
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

