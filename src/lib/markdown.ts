const rulePattern = /^(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/;

type MarkdownBlock = { kind: "paragraph"; text: string } | { kind: "rule" };

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let lines: string[] = [];

  function flushParagraph() {
    if (!lines.length) return;
    blocks.push({ kind: "paragraph", text: lines.join("\n") });
    lines = [];
  }

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (rulePattern.test(line)) {
      flushParagraph();
      blocks.push({ kind: "rule" });
    } else if (line) {
      lines.push(line);
    } else {
      flushParagraph();
    }
  }

  flushParagraph();
  return blocks;
}
