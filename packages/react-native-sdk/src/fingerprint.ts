import { StackFrame } from './types';

export function generateFingerprint(
  errorType: string,
  errorValue: string,
  stacktrace: StackFrame[],
): string {
  const topFrames = stacktrace
    .filter((f) => f.in_app)
    .slice(0, 3)
    .map((f) => `${f.filename}:${f.function}:${f.lineno}`)
    .join('|');

  const raw = `${errorType}:${topFrames || errorValue}`;
  return simpleHash(raw);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
