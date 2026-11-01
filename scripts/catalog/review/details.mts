import { isDeepStrictEqual } from "node:util";
import { dirname, resolve } from "node:path";
import { parseDocument } from "htmlparser2";
import { categories, type Catalog, type Evidence, type Item, type Mapping } from "../types.mts";

export type Difference = {
  field: string;
  change: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
  added?: string[];
  removed?: string[];
};
export type Listing = { url: string; checkedAt: string; confidence?: string; product: Record<string, unknown> };

export function itemDifferences(before: Item | null, after: Item) {
  const differences: Difference[] = [];
  if (!before) return [{ field: "item", change: "added" as const }];
  function compare(left: Record<string, unknown>, right: Record<string, unknown>, prefix = "") {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (key === "editions" || isDeepStrictEqual(left[key], right[key])) continue;
      const oldValues = left[key],
        newValues = right[key];
      if (
        ["announcements", "tags", "aliases"].includes(key) &&
        Array.isArray(oldValues) &&
        Array.isArray(newValues) &&
        oldValues.every((value): value is string => typeof value === "string") &&
        newValues.every((value): value is string => typeof value === "string")
      ) {
        const added = newValues.filter((value) => !oldValues.includes(value));
        const removed = oldValues.filter((value) => !newValues.includes(value));
        if (added.length || removed.length) {
          differences.push({
            field: prefix + key,
            change: "changed",
            ...(added.length ? { added } : {}),
            ...(removed.length ? { removed } : {}),
          });
          continue;
        }
      }
      differences.push({
        field: prefix + key,
        change: !(key in left) ? "added" : !(key in right) ? "removed" : "changed",
        ...(key in left ? { before: left[key] } : {}),
        ...(key in right ? { after: right[key] } : {}),
      });
    }
  }
  compare(before, after);
  const previous = new Map((before.editions ?? []).map((edition) => [edition.id, edition]));
  const next = new Map((after.editions ?? []).map((edition) => [edition.id, edition]));
  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    const left = previous.get(id),
      right = next.get(id);
    if (left && right) compare(left, right, `editions[${id}].`);
    else
      differences.push({ field: `editions[${id}]`, change: right ? "added" : "removed", ...(left ? { before: left } : { after: right }) });
  }
  if (
    previous.size === next.size &&
    [...previous.keys()].every((id) => next.has(id)) &&
    !isDeepStrictEqual([...previous.keys()], [...next.keys()])
  )
    differences.push({ field: "editions.order", change: "changed", before: [...previous.keys()], after: [...next.keys()] });
  return differences;
}

const mediaFields = /(?:^|_)(?:images?|media|videos?|preview_image|featured_image|featured_media)(?:_|$)/i;
const mediaTags = new Set([
  "img",
  "video",
  "audio",
  "picture",
  "source",
  "track",
  "iframe",
  "model-viewer",
  "svg",
  "canvas",
  "object",
  "embed",
]);

const hiddenTags = new Set(["script", "style", "noscript", "template", "meta", "link"]);
const blockTags = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "table",
  "tr",
  "dl",
  "dt",
  "dd",
]);

function descriptionText(html: string) {
  const document = parseDocument(html);
  const hasMarkup = document.children.some((node) => "name" in node);
  function render(nodes: typeof document.children): string {
    return nodes
      .map((node) => {
        if (node.type === "text") return hasMarkup ? node.data.replace(/\s+/g, " ") : node.data;
        if (!("attribs" in node) || mediaTags.has(node.name) || hiddenTags.has(node.name)) return "";
        if (node.name === "br") return "\n";
        if (node.name === "hr") return "\n\n";
        if (node.name === "ul" || node.name === "ol") {
          const items = node.children.filter((child) => "name" in child && child.name === "li");
          return (
            "\n" +
            items
              .map((child, index) => {
                const text = "children" in child ? render(child.children).trim() : "";
                return (node.name === "ol" ? `${index + 1}. ` : "- ") + text;
              })
              .join("\n") +
            "\n"
          );
        }
        const text = render(node.children);
        if (node.name === "a") {
          const label = text.trim(),
            href = node.attribs.href;
          return label && href && label !== href ? `${label} (${href})` : label;
        }
        return blockTags.has(node.name) ? `\n\n${text}\n\n` : text;
      })
      .join("");
  }
  return render(document.children)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const metadataFields = new Set(["requires_shipping", "option1", "option2", "option3", "taxable", "position", "vendor", "options"]);

function cleanListing(value: Record<string, unknown>): Record<string, unknown>;
function cleanListing(value: unknown): unknown;
function cleanListing(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((field) => cleanListing(field));
  if (!value || typeof value !== "object") return value;
  const cleaned = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !mediaFields.test(key) && !metadataFields.has(key))
      .map(([key, field]) => [
        key,
        typeof field === "string" && ["description", "body_html"].includes(key) ? descriptionText(field) : cleanListing(field),
      ]),
  );
  if (typeof cleaned.description === "string" && cleaned.body_html === cleaned.description) delete cleaned.body_html;
  return cleaned;
}

export function listingDetails(source: Evidence, confidence?: string): Listing {
  const product = cleanListing(source.data);
  return { url: source.url, checkedAt: source.checkedAt, ...(confidence ? { confidence } : {}), product };
}

export function resolutionDetails(
  issue: { handle: string; candidates?: string[] },
  catalog: Catalog,
  mappings: Record<string, Mapping>,
  mappingFile: string,
) {
  const catalogFile = resolve(dirname(mappingFile), "../../../static/kdm/catalog/data.json");
  const mapping = mappings[issue.handle];
  const matches = categories.flatMap((category) =>
    Object.entries(catalog[category]).flatMap(([itemId, item]) =>
      (mapping?.category === category && mapping.itemId === itemId) || issue.candidates?.includes(itemId)
        ? [{ category, itemId, item }]
        : [],
    ),
  );
  const instructions = matches.length
    ? [
        "Confirm which existing edition each shop variant represents, or confirm that it is a distinct new release.",
        `For an existing edition, save its matching handle on the sale edition in ${catalogFile}, then rerun pnpm catalog:update. Do not use included-only editions.`,
        "If variants represent different editions, map each Shopify variant ID with variantEditionIds; use editionId only when all variants target one edition.",
        "For a new release, provide its edition label, material, and known release date/window; use editionLabel only after that decision.",
      ]
    : [
        "Provide category and itemId for an existing catalog item, or the name, category, tags, and edition details for a new item.",
        "If the listing should be excluded or is a superseded alias, provide that decision and the replacement item/edition IDs where applicable.",
      ];
  return { mappingFile, catalogFile, instructions, ...(mapping ? { currentMapping: mapping } : {}), catalogItems: matches };
}
