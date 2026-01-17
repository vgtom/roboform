export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

export function throttleWithTrailingInvocation<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout | null = null;
  let previous = 0;
  let trailingArgs: Parameters<T> | null = null;

  const throttled = ((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func(...args);
    } else if (!timeout) {
      trailingArgs = args;
      timeout = setTimeout(() => {
        timeout = null;
        previous = Date.now();
        if (trailingArgs) {
          func(...trailingArgs);
          trailingArgs = null;
        }
      }, remaining);
    } else {
      trailingArgs = args;
    }
  }) as T;

  return throttled;
}

// Generate a consistent random color based on a string ID
export function getRandomColorForId(id: string, opacity: number = 0.1): string {
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate RGB values based on hash
  const r = (hash & 0xFF0000) >> 16;
  const g = (hash & 0x00FF00) >> 8;
  const b = hash & 0x0000FF;
  
  // Normalize to 0-255 and adjust for pleasant colors
  const normalizedR = Math.abs((r + 50) % 200) + 30;
  const normalizedG = Math.abs((g + 50) % 200) + 30;
  const normalizedB = Math.abs((b + 50) % 200) + 30;
  
  return `rgba(${normalizedR}, ${normalizedG}, ${normalizedB}, ${opacity})`;
}
