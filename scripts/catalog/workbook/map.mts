import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { decodeWorkbookMap, workbookLocator, releaseColumns, type WorkbookMap, type WorkbookTarget } from "#lib/types/workbook.ts";
import { publishFiles } from "../publication.mts";
import type { Catalog } from "../types.mts";
import { importTarget, readImports, type Reference, type WorkbookImports } from "./imports.mts";
import { readOptional } from "../inputs.mts";
import { catalogData } from "../paths.mts";
const rowKey = workbookLocator;
const targetKey = (target: WorkbookTarget) => `${target.category}/${target.contentId}/${target.editionId}`;

// Physical row numbers locate this workbook snapshot. Names and source references guard against
// silently applying an old locator after a row has been moved or repurposed.
export function buildWorkbookMap(imports: WorkbookImports, catalog: Catalog, previous?: WorkbookMap): WorkbookMap {
  if (previous && (previous.source.id !== "kdm-collection-sheets" || previous.source.workbook !== imports.workbook))
    throw new Error("Workbook source changed; review the mapping before reuse");
  const oldRows = new Map(previous?.rows.map((row) => [rowKey(row), row]));
  const usedRows = new Set<string>();
  const rows = imports.records.map((record) => {
    const key = rowKey(record);
    if (usedRows.has(key)) throw new Error(`Duplicate workbook row: ${key}`);
    usedRows.add(key);
    const old = oldRows.get(key);
    if (old && old.name !== record.name) throw new Error(`Workbook row identity changed at ${key}; review required`);
    const resolveTarget = (ref: Reference, former: WorkbookTarget | undefined, slot: string): WorkbookTarget => {
      const target = importTarget(ref, catalog);
      if (former && (former.category !== ref.category || former.contentId !== ref.itemId))
        throw new Error(`Workbook reference changed at ${key} ${slot}; review required`);
      if (former && former.editionId !== target.editionId) throw new Error(`Workbook edition changed at ${key} ${slot}; review required`);
      return target;
    };
    if (old && (old.related?.length ?? 0) !== (record.relatedItems?.length ?? 0))
      throw new Error(`Workbook related references changed at ${key}; review required`);
    const primary = resolveTarget(record, old?.primary, "primary");
    const related = record.relatedItems?.map((ref, index) => resolveTarget(ref, old?.related?.[index], `related[${index}]`));
    const releaseEditions = record.releaseEditions
      ? Object.fromEntries(
          releaseColumns
            .filter((column) => record.releaseEditions?.[column])
            .map((column) => {
              const refs = record.releaseEditions![column]!;
              const former = old?.releaseEditions?.[column];
              if (former && former.length !== refs.length)
                throw new Error(`Workbook release alternatives changed at ${key} ${column}; review required`);
              return [column, refs.map((ref, index) => resolveTarget(ref, former?.[index], `${column}[${index}]`))];
            }),
        )
      : undefined;
    if (old && JSON.stringify(Object.keys(old.releaseEditions ?? {})) !== JSON.stringify(Object.keys(releaseEditions ?? {})))
      throw new Error(`Workbook release columns changed at ${key}; review required`);
    const targets = [primary, ...(related ?? [])];
    if (new Set(targets.map(targetKey)).size !== targets.length) throw new Error(`Duplicate workbook target at ${key}`);
    for (const [column, alternatives] of Object.entries(releaseEditions ?? {})) {
      if (new Set(alternatives.map(targetKey)).size !== alternatives.length)
        throw new Error(`Duplicate workbook release target at ${key} ${column}`);
      for (const alternative of alternatives)
        if (!targets.some((target) => targetKey(target) === targetKey(alternative)))
          throw new Error(`Workbook release target absent from row choices at ${key} ${column}`);
    }
    return {
      sheet: record.sheet,
      row: record.row,
      name: record.name,
      primary,
      ...(related?.length ? { related } : {}),
      ...(record.ownershipScope ? { ownershipScope: record.ownershipScope } : {}),
      ...(releaseEditions ? { releaseEditions } : {}),
    };
  });
  for (const key of oldRows.keys()) if (!usedRows.has(key)) throw new Error(`Workbook row removed at ${key}; review required`);
  return {
    $schema: "./workbook-map.schema.json",
    formatVersion: 1,
    source: { id: "kdm-collection-sheets", workbook: imports.workbook },
    rows,
  };
}

export function normalizeWorkbookMap(value: unknown, catalog: Catalog): WorkbookMap {
  const map = decodeWorkbookMap(value);
  const reference = (target: WorkbookTarget): Reference => ({
    category: target.category,
    itemId: target.contentId,
    editionId: target.editionId,
  });
  return decodeWorkbookMap(
    buildWorkbookMap(
      {
        workbook: map.source.workbook,
        records: map.rows.map((row) => ({
          sheet: row.sheet,
          row: row.row,
          name: row.name,
          ...reference(row.primary),
          ...(row.related ? { relatedItems: row.related.map(reference) } : {}),
          ...(row.ownershipScope ? { ownershipScope: row.ownershipScope } : {}),
          ...(row.releaseEditions
            ? {
                releaseEditions: Object.fromEntries(
                  Object.entries(row.releaseEditions).map(([column, targets]) => [column, targets.map(reference)]),
                ),
              }
            : {}),
        })),
      },
      catalog,
    ),
  );
}

export async function readWorkbookMap(root: string, catalog: Catalog) {
  const path = join(root, "workbook-map.json");
  const text = await readOptional(path);
  if (text === undefined) return undefined;
  return { map: normalizeWorkbookMap(JSON.parse(text), catalog), path, text };
}

export async function writeWorkbookMap(root = process.cwd(), options: { signal?: AbortSignal; imports?: string } = {}) {
  options.signal?.throwIfAborted();
  const catalogRoot = resolve(root, "static/kdm/catalog");
  const mapPath = resolve(catalogRoot, "workbook-map.json");
  const catalogPath = resolve(catalogRoot, "data.json");
  const schemaPath = resolve(catalogRoot, "workbook-map.schema.json");
  const [source, catalogText, schemaText, oldText] = await Promise.all([
    options.imports ? readImports(resolve(root, options.imports), join(catalogData(catalogRoot), "import-records.schema.json")) : undefined,
    readFile(catalogPath, "utf8"),
    readFile(schemaPath, "utf8"),
    readOptional(mapPath),
  ]);
  if (!source && oldText === undefined) throw new Error("No committed workbook map; provide --imports PATH to create one.");
  const catalog = JSON.parse(catalogText) as Catalog;
  const previous = oldText === undefined ? undefined : decodeWorkbookMap(JSON.parse(oldText));
  const map = source ? decodeWorkbookMap(buildWorkbookMap(source.imports, catalog, previous)) : normalizeWorkbookMap(previous, catalog);
  await publishFiles([{ path: mapPath, json: map }], {
    baselines: [
      ...(source
        ? [
            { path: source.path, text: source.text, message: "Workbook imports changed during generation; rerun to preserve your edits." },
            {
              path: source.schemaPath,
              text: source.schemaText,
              message: "Workbook import schema changed during generation; rerun to validate current records.",
            },
          ]
        : []),
      {
        path: catalogPath,
        text: catalogText,
        message: "Catalog changed during workbook generation; rerun to use current edition identities.",
      },
      { path: schemaPath, text: schemaText, message: "Workbook schema changed during generation; regenerate types and rerun." },
      { path: mapPath, text: oldText, message: "Workbook map changed during generation; rerun to preserve your edits." },
    ],
    signal: options.signal,
  });
  return map;
}
