import { catalogTemp } from "./paths.mts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { categories, type Catalog, type Category, type Mapping } from "./types.mts";

export type Tags = Record<Category, Record<string, string[]>>;

export function organizeTags(catalog: Catalog, tags: Tags) {
  return Object.fromEntries(
    (["content", "included-only", "bundles", "homebrew", "accessories"] as const).map((category) => [
      category,
      Object.fromEntries(
        [...new Set([...Object.keys(catalog[category]), ...Object.keys(tags[category])])].map((id) => [id, tags[category][id]]),
      ),
    ]),
  ) as Tags;
}

export async function loadTags(root: string) {
  const text = await readFile(join(catalogTemp(root), "kdm-tags.json"), "utf8").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  });
  if (text === undefined) {
    const catalog: Catalog = JSON.parse(await readFile(join(root, "kdm-data.json"), "utf8"));
    const tags = Object.fromEntries(
      categories.map((category) => [
        category,
        Object.fromEntries(Object.entries(catalog[category]).map(([id, item]) => [id, item.tags ?? []])),
      ]),
    ) as Tags;
    const vocabulary = [...new Set(categories.flatMap((category) => Object.values(tags[category]).flat()))].sort();
    return { tags, text: JSON.stringify(tags), schemaText: JSON.stringify(tagSchema(vocabulary)), local: false };
  }
  const schemaText = await readFile(join(catalogTemp(root), "kdm-tags.schema.json"), "utf8");
  const value = JSON.parse(text);
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const check = ajv.compile<Record<string, unknown>>(JSON.parse(schemaText));
  if (!check(value)) throw new Error("Master tag errors: " + ajv.errorsText(check.errors, { separator: "\n" }));
  const { $schema, ...tags } = value;
  return { tags: tags as Tags, text, schemaText, local: true };
}

export function applyTags(catalog: Catalog, tags: Tags, mappings: Record<string, Mapping> = {}) {
  const missing: string[] = [];
  const extra: string[] = [];
  for (const category of categories) {
    const ids = new Set(Object.keys(catalog[category]));
    const pending = new Set(
      Object.values(mappings)
        .filter((mapping) => mapping.create && mapping.category === category)
        .map((mapping) => mapping.itemId),
    );
    missing.push(...[...ids].filter((id) => !tags[category]?.[id]?.length).map((id) => category + "/" + id));
    extra.push(
      ...Object.keys(tags[category] ?? {})
        .filter((id) => !ids.has(id) && !pending.has(id))
        .map((id) => category + "/" + id),
    );
  }
  if (missing.length || extra.length)
    throw new Error(
      [
        missing.length ? "Add reviewed tags to kdm-tags.json for: " + missing.join(", ") : "",
        extra.length ? "Unknown master tag item IDs: " + extra.join(", ") : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  for (const category of categories)
    for (const [id, item] of Object.entries(catalog[category])) {
      const values = tags[category][id]!;
      if (new Set(values).size !== values.length || values.some((tag) => !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(tag)))
        throw new Error("Invalid or duplicate master tags: " + id);
      item.tags = [...values];
    }
}

export function tagSchema(vocabulary: string[]) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "KDM master item tags",
    description: "Reviewed tag assignments. Item keys are unrestricted here; catalog merging checks missing and unknown IDs.",
    type: "object",
    additionalProperties: false,
    required: [...categories],
    properties: {
      $schema: { type: "string" },
      ...Object.fromEntries(categories.map((category) => [category, { $ref: "#/$defs/group" }])),
    },
    $defs: {
      group: { type: "object", additionalProperties: { $ref: "#/$defs/tagList" } },
      tag: { type: "string", pattern: "^[a-z0-9]+(?:[.-][a-z0-9]+)*$", enum: vocabulary },
      tagList: { type: "array", minItems: 1, uniqueItems: true, items: { $ref: "#/$defs/tag" } },
    },
  };
}

export function checkTags(catalog: Catalog, tags: Tags, mappings: Record<string, Mapping> = {}) {
  const expected = structuredClone(catalog);
  applyTags(expected, tags, mappings);
  for (const category of categories)
    for (const id of Object.keys(catalog[category]))
      if (JSON.stringify(catalog[category][id]!.tags) !== JSON.stringify(expected[category][id]!.tags))
        throw new Error("Catalog tags differ from kdm-tags.json for " + id + "; regenerate the review with pnpm catalog:tags");
}
