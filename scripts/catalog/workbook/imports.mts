import { readFile } from "node:fs/promises";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { MappingRow, ReleaseColumn, WorkbookTarget } from "#lib/types/workbook.ts";
import type { Catalog } from "../types.mts";

export type Reference = { category: WorkbookTarget["category"]; itemId: string; editionId: string };
type ImportRow = Reference & {
  sheet: MappingRow["sheet"];
  row: number;
  name: string;
  relatedItems?: Reference[];
  ownershipScope?: "source-row";
  releaseEditions?: Partial<Record<ReleaseColumn, Reference[]>>;
};
export type WorkbookImports = { workbook: string; records: ImportRow[] };

export function importTarget(ref: Reference, catalog: Catalog): WorkbookTarget {
  if ("edition" in ref || !ref.editionId)
    throw new Error(`Outdated workbook reference: ${ref.itemId}; replace edition labels with editionId using workbook-map.json.`);
  const item = catalog[ref.category]?.[ref.itemId];
  if (!item) throw new Error(`Unknown workbook item: ${ref.category}/${ref.itemId}`);
  const exists = item.editions?.length
    ? item.editions.some((edition) => edition.id === ref.editionId)
    : ref.editionId === (ref.category === "bundles" ? "bundle" : "item");
  if (!exists) throw new Error(`Unknown workbook edition: ${ref.itemId}/${ref.editionId}`);
  return { category: ref.category, contentId: ref.itemId, editionId: ref.editionId };
}

/** Keep personal workbook cells local; callers publish only resolved product references. */
export async function readImports(path: string, schemaPath: string) {
  const text = await readFile(path, "utf8");
  const schemaText = await readFile(schemaPath, "utf8");
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const check = ajv.compile<WorkbookImports>(JSON.parse(schemaText));
  const imports: unknown = JSON.parse(text);
  if (!check(imports)) throw new Error("Workbook import schema errors: " + ajv.errorsText(check.errors, { separator: "\n" }));
  return { imports, path, text, schemaPath, schemaText };
}
