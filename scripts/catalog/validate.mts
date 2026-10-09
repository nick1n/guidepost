import { catalogTemp } from "./paths.mts";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { editionComparator } from "./order.mts";
import { categories, type Catalog, type Category } from "./types.mts";
import { normalizeItem } from "./normalize.mts";
import { organizeCatalog } from "./order.mts";
import { loadTags, checkTags } from "./tags.mts";
import { prefixedId } from "./identity.mts";
import { loadMappings } from "./shop.mts";

export async function validateCatalog(catalog: Catalog, schemaPath = "static/kdm-catalog/data.schema.json") {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const check = ajv.compile(schema);
  if (!check(catalog)) throw new Error("Catalog schema errors: " + ajv.errorsText(check.errors, { separator: "\n" }));
  const ordered = organizeCatalog(structuredClone(catalog));
  for (const category of categories)
    if (JSON.stringify(Object.keys(catalog[category])) !== JSON.stringify(Object.keys(ordered[category])))
      throw new Error("Catalog items are out of catalog order: " + category);
  const items = new Map<string, Catalog["content"][string]>();
  for (const category of categories)
    for (const [id, item] of Object.entries(catalog[category])) {
      const includedOnly = !!item.editions?.length && item.editions.every((edition) => edition.standalone === false);
      if (category === "included-only" && !includedOnly)
        throw new Error("Included-only item has a standalone or unconfirmed edition: " + id);
      if (category === "content" && includedOnly) throw new Error("Move included-only item to included-only: " + id);
      if (category !== "bundles" && prefixedId(id, item) !== id)
        throw new Error("Item ID needs its family prefix: " + id + " -> " + prefixedId(id, item));
      if (items.has(id)) throw new Error("Duplicate item ID: " + id);
      items.set(id, item);
      const normalized = structuredClone(item);
      normalizeItem(normalized);
      if (JSON.stringify(normalized) !== JSON.stringify(item)) throw new Error("Untrimmed catalog facts or URLs: " + id);
      const labels = (item.editions ?? []).map((edition) => edition.label);
      if (new Set(labels).size !== labels.length) throw new Error("Duplicate edition label: " + id);
      if (item.editions?.some((edition) => edition.simulator) && !item.editions[0]?.simulator) throw new Error("Sim must be first: " + id);
      if (labels.some((label, index) => label !== item.editions!.toSorted(editionComparator(item, id))[index]!.label))
        throw new Error("Editions are out of release order: " + id);
      const editionIds = new Set<string>();
      for (const edition of item.editions ?? []) {
        if (editionIds.has(edition.id!)) throw new Error("Duplicate edition ID: " + id + "/" + edition.id);
        editionIds.add(edition.id!);
        if (
          edition.releaseDate &&
          (!Number.isFinite(Date.parse(edition.releaseDate)) ||
            new Date(edition.releaseDate).toISOString().slice(0, 10) !== edition.releaseDate)
        )
          throw new Error("Invalid release date: " + id);
        if (edition.gameplay !== undefined && edition.gameplay === (item.gameplay === true))
          throw new Error("Redundant gameplay override: " + id);
        if (edition.simulator && (edition.format !== "digital" || edition.size || edition.materials))
          throw new Error("Invalid simulator facts: " + id);
        if (edition.format === "digital" && edition.size) throw new Error("Physical model size on digital edition: " + id);
      }
    }
  const visited = new Set<string>();
  function walk(id: string, path = new Set<string>()) {
    if (path.has(id)) throw new Error("Contents cycle: " + [...path, id].join(" -> "));
    if (visited.has(id)) return;
    const item = items.get(id)!;
    for (const reference of item.includes ?? []) {
      const childId = typeof reference === "string" ? reference : reference.item;
      const child = items.get(childId);
      if (!child) throw new Error("Missing included item: " + childId);
      if (typeof reference !== "string") {
        if (reference.editionId && !child.editions?.some((edition) => edition.id === reference.editionId))
          throw new Error("Missing child edition: " + childId + "/" + reference.editionId);
        for (const editionId of reference.parentEditionIds ?? [])
          if (!item.editions?.some((edition) => edition.id === editionId))
            throw new Error("Missing parent edition: " + id + "/" + editionId);
        if (
          child.editions?.some((edition) => edition.id === reference.editionId && edition.format === "digital") &&
          !reference.parentEditionIds?.length
        )
          throw new Error("Unscoped digital inclusion: " + id);
      }
      walk(childId, new Set([...path, id]));
    }
    for (const required of item.requires ?? []) if (!items.has(required)) throw new Error("Missing prerequisite: " + required);
    visited.add(id);
  }
  for (const id of items.keys()) walk(id);
  type Ref = { category: Category; itemId: string; edition?: string };
  const importsRoot = join(catalogTemp(dirname(schemaPath)), "imports");
  const importText = await readFile(join(importsRoot, "kdm-import-records.json"), "utf8").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  });
  const imports: { records: (Ref & { relatedItems?: Ref[]; releaseEditions?: Record<string, Ref[]> })[] } =
    importText !== undefined ? JSON.parse(importText) : { records: [] };
  if (importText !== undefined) {
    const checkImports = ajv.compile(JSON.parse(await readFile(join(importsRoot, "kdm-import-records.schema.json"), "utf8")));
    if (!checkImports(imports)) throw new Error("Import schema errors: " + ajv.errorsText(checkImports.errors, { separator: "\n" }));
  }
  for (const record of imports.records) {
    for (const ref of [record, ...(record.relatedItems ?? []), ...Object.values(record.releaseEditions ?? {}).flat()]) {
      const item = catalog[ref.category][ref.itemId];
      if (!item) throw new Error("Missing imported item: " + ref.itemId);
      if (ref.edition && !item.editions?.some((edition) => edition.label === ref.edition))
        throw new Error("Missing imported edition: " + ref.itemId + "/" + ref.edition);
    }
  }
  return {
    items: items.size,
    editions: [...items.values()].reduce((count, item) => count + (item.editions?.length ?? 0), 0),
    importRows: imports.records.length,
    schemas: "passed",
    references: "passed",
    cycles: "none",
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2] ?? "static/kdm-catalog/data.json";
  const catalog = JSON.parse(await readFile(path, "utf8"));
  const master = await loadTags(dirname(path));
  const mappings = await loadMappings(dirname(path));
  checkTags(catalog, master.tags, mappings);
  console.log(JSON.stringify(await validateCatalog(catalog, join(dirname(path), "data.schema.json")), null, 2));
}
