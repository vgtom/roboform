/**
 * OpenAI sometimes wraps JSON in markdown fences or adds a short preamble.
 * Responses can also be truncated (max_tokens), producing invalid JSON.
 */

function stripMarkdownFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```json")) {
    s = s.replace(/^```json\n?/i, "").replace(/```\n?$/g, "");
  } else if (s.startsWith("```")) {
    s = s.replace(/^```\n?/g, "").replace(/```\n?$/g, "");
  }
  return s.trim();
}

/**
 * Extract the first top-level `{ ... }` object, respecting strings and escapes.
 */
export function extractFirstJsonObjectString(raw: string): string {
  const s = stripMarkdownFences(raw);
  const first = s.indexOf("{");
  if (first === -1) {
    throw new SyntaxError("No JSON object found in AI response");
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = first; i < s.length; i++) {
    const c = s[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) {
        return s.slice(first, i + 1);
      }
    }
  }
  throw new SyntaxError("Unbalanced braces — response may be truncated");
}

export function parseJsonFromAiContent(content: string): unknown {
  const jsonStr = extractFirstJsonObjectString(content);
  return JSON.parse(jsonStr);
}
