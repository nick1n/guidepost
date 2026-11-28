import { describe, expect, it } from "vitest";
import { parseInline } from "#lib/inline-markdown.ts";
import { parseMarkdown } from "#lib/markdown.ts";

describe("Guidepost markdown", () => {
  it("preserves inline emphasis, named icons, and unknown names", () => {
    expect(parseInline("Use [activation] with **bold** and *italics*. [unknown]")).toEqual([
      { kind: "text", value: "Use " },
      { kind: "icon", value: "activation" },
      { kind: "text", value: " with " },
      { kind: "strong", value: "bold" },
      { kind: "text", value: " and " },
      { kind: "em", value: "italics" },
      { kind: "text", value: ". " },
      { kind: "text", value: "[unknown]" },
    ]);
  });

  it("separates standalone dividers from inline punctuation and emphasis", () => {
    expect(parseMarkdown("**Ready**\r\nSet\r\n\r\nGo\r\n --- \r\n*Now* --- [story]\r\n* * *\r\n___")).toEqual([
      { kind: "paragraph", text: "**Ready**\nSet" },
      { kind: "paragraph", text: "Go" },
      { kind: "rule" },
      { kind: "paragraph", text: "*Now* --- [story]" },
      { kind: "rule" },
      { kind: "rule" },
    ]);
    expect(parseMarkdown(" \r\n\n ")).toEqual([]);
    expect(parseInline("---")).toEqual([{ kind: "text", value: "---" }]);
  });
});
