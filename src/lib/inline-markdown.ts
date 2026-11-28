import { KD_ICONS, type KdIconName } from "#lib/constants.ts";

const inlinePattern = /\*\*[^*\r\n]+\*\*|\*[^*\r\n]+\*|\[[a-z0-9-]+\]/g;

export type InlineSegment = { kind: "text" | "strong" | "em"; value: string } | { kind: "icon"; value: KdIconName };

export function parseInline(source: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let textStart = 0;

  for (const match of source.matchAll(inlinePattern)) {
    const value = match[0];
    const start = match.index;
    const delimiterSize = value.startsWith("**") ? 2 : 1;
    if (start > textStart) segments.push({ kind: "text", value: source.slice(textStart, start) });

    if (value.startsWith("[")) {
      const name = value.slice(1, -1);
      segments.push(Object.hasOwn(KD_ICONS, name) ? { kind: "icon", value: name as KdIconName } : { kind: "text", value });
    } else {
      segments.push({
        kind: delimiterSize === 2 ? "strong" : "em",
        value: value.slice(delimiterSize, -delimiterSize),
      });
    }
    textStart = start + value.length;
  }

  if (textStart < source.length) segments.push({ kind: "text", value: source.slice(textStart) });
  return segments;
}
