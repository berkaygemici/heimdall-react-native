let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function safeExec(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    if (debugMode) {
      console.warn('[Heimdall] SafeExec caught error:', e);
    }
  }
}

export async function safeExecAsync<T>(
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    if (debugMode) {
      console.warn('[Heimdall] SafeExecAsync caught error:', e);
    }
    return undefined;
  }
}
