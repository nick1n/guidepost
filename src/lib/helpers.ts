export function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function identity<T>(value: T): T {
  return value;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function normalizeWhitespace(text: string) {
  return text.trim().replace(/\s+/gu, " ");
}
