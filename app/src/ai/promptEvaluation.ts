import { HttpError } from "wasp/server";

/**
 * Evaluates if a prompt is related to form building/modification.
 * Uses OpenAI API to classify the prompt.
 * 
 * @param prompt - The user's prompt to evaluate
 * @returns true if the prompt is form-related, false otherwise
 * @throws HttpError if evaluation fails
 */
export async function evaluatePromptIsFormRelated(prompt: string): Promise<boolean> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new HttpError(500, "OpenAI API key not configured");
  }

  const evaluationPrompt = `You are a prompt evaluator for a form builder application. Your task is to determine if a user's prompt is related to creating, modifying, or working with forms.

A form-related prompt should:
- Request creating a new form
- Request modifying an existing form (adding/removing fields, changing field properties)
- Request changes to form structure, fields, validation, or layout
- Be about form fields, form questions, form data collection

A prompt is NOT form-related if it:
- Is about general topics unrelated to forms
- Is about other types of content (articles, code, stories, etc.)
- Is a question or request that doesn't involve form building
- Is spam, gibberish, or completely unrelated

User prompt: "${prompt}"

Respond with ONLY "YES" if the prompt is form-related, or "NO" if it is not form-related. Do not include any other text.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Use the same model for consistency
        messages: [
          {
            role: "system",
            content: "You are a prompt evaluator. Respond with only YES or NO.",
          },
          {
            role: "user",
            content: evaluationPrompt,
          },
        ],
        temperature: 0.1, // Low temperature for consistent classification
        max_tokens: 10, // Only need YES or NO
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI API error during evaluation");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim().toUpperCase();

    // Return true if the response is "YES", false otherwise
    return content === "YES";
  } catch (error: any) {
    // If evaluation fails, we'll be conservative and allow the prompt
    // but log the error for monitoring
    console.error("Prompt evaluation failed:", error.message);
    // Return true to allow the prompt if evaluation fails (fail open)
    // This prevents blocking legitimate requests due to API issues
    return true;
  }
}

