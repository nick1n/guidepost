import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { catalogData } from "./paths.mts";
import { loadTags } from "./tags.mts";
import { parseMappings } from "./mappings.mts";
import type { Catalog } from "./types.mts";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function readOptional(path: string) {
  return readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
}

export async function loadMappings(root: string) {
  const path = join(catalogData(root), "shop-mappings.json");
  return parseMappings(await readOptional(path), path);
}

export async function captureWorkbookInputs(root: string) {
  const files = [
    ["workbook-map.json", "Workbook map"],
    ["workbook-map.schema.json", "Workbook schema"],
  ] as const;
  return Promise.all(
    files.map(async ([name, label]) => {
      const path = join(root, name);
      return { path, text: await readOptional(path), message: `${label} changed; rerun to preserve your edits.` };
    }),
  );
}

/** Capture physical inputs once, retaining absence separately from generated tag fallbacks. */
export async function captureInputs(root: string) {
  const paths = {
    catalog: join(root, "data.json"),
    schema: join(root, "data.schema.json"),
    mappings: join(catalogData(root), "shop-mappings.json"),
    tags: join(catalogData(root), "tags.json"),
    tagSchema: join(catalogData(root), "tags.schema.json"),
  };
  const [catalogText, schemaText, mappingText, tagText, tagSchemaText, workbookInputs] = await Promise.all([
    readFile(paths.catalog, "utf8"),
    readFile(paths.schema, "utf8"),
    readOptional(paths.mappings),
    readOptional(paths.tags),
    readOptional(paths.tagSchema),
    captureWorkbookInputs(root),
  ]);
  const source = (path: string, text: string | undefined) => ({ path, text, hash: text === undefined ? undefined : digest(text) });
  const sources = {
    catalog: { path: paths.catalog, text: catalogText, hash: digest(catalogText) },
    schema: { path: paths.schema, text: schemaText, hash: digest(schemaText) },
    mappings: { ...source(paths.mappings, mappingText), hash: digest(mappingText ?? "") },
    tags: source(paths.tags, tagText),
    tagSchema: source(paths.tagSchema, tagSchemaText),
  };
  const catalog: Catalog = JSON.parse(catalogText);
  const mappings = parseMappings(mappingText, paths.mappings);
  const master = await loadTags(root, { catalog, text: tagText, schemaText: tagSchemaText });
  const labels = { catalog: "Catalog", schema: "Schema", mappings: "Mappings", tags: "Master tags", tagSchema: "Tag schema" };
  const baselines = Object.entries(sources).map(([key, value]) => ({
    path: value.path,
    text: value.text,
    message: `${labels[key as keyof typeof labels]} changed; regenerate the review to preserve your edits.`,
  }));
  baselines.push(...workbookInputs);
  return { catalog, mappings, master, sources, baselines };
}
