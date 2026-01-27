import { HttpError, prisma } from "wasp/server";
import type { ModifyFormWithAI } from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { FormSchema } from "../shared/formTypes";
import { generateId } from "../shared/utils";
import { PaymentPlanId, AI_USAGE_LIMITS } from "../payment/plans";
import { evaluatePromptIsFormRelated } from "./promptEvaluation";

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
  const isFormRelated = await evaluatePromptIsFormRelated(modificationPrompt);
  
  // Increment usage count for evaluation (1 request)
  await prisma.user.update({
    where: { id: context.user.id },
    data: { aiUsageCount: { increment: 1 } },
  });

  // If evaluation fails, throw error (1 usage already deducted)
  if (!isFormRelated) {
    throw new HttpError(400, "Your prompt is not related to form building or modification. Please provide a prompt about creating or modifying forms. 1 request has been deducted.");
  }

  try {
    const modifiedSchema = await callAIModifyForm(
      currentSchema, 
      modificationPrompt,
      userPlan === PaymentPlanId.Starter // Use minimal tokens for Starter
    );
    
    // Increment usage count for successful modification (1 more request)
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

Modify the form according to the user's request and return the complete modified schema.`;

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
          { role: "user", content: useMinimalTokens ? modificationPrompt.substring(0, 100) : modificationPrompt }, // Limit prompt length for Starter
        ],
        temperature: 0.3, // Lower temperature for more consistent modifications
        max_tokens: useMinimalTokens ? 500 : 3000, // Lower token limit for Starter plan
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
    
    const modifiedSchema: FormSchema = {
      title: parsed.title || currentSchema.title || "Untitled Form",
      description: parsed.description !== undefined ? parsed.description : currentSchema.description || "",
      fields: (parsed.fields || []).map((field: any) => ({
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
      throw new HttpError(500, "Failed to parse AI response as JSON");
    }
    throw error;
  }
}

