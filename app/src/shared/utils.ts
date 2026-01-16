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
