import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  decodeWorkbookMap,
  workbookLocator,
  type WorkbookMap,
  type WorkbookMappingRow as WorkbookRow,
  type WorkbookTarget,
} from "../../src/lib/types/workbook.ts";
import { publishFiles } from "./publication.mts";
export type { WorkbookMap, WorkbookMappingRow as WorkbookRow, WorkbookTarget } from "../../src/lib/types/workbook.ts";
import type { Catalog } from "./types.mts";

type SourceRef = { category: WorkbookTarget["category"]; itemId: string; edition?: string };
type ImportRow = SourceRef & {
  sheet: WorkbookRow["sheet"];
  row: number;
  name: string;
  relatedItems?: SourceRef[];
  ownershipScope?: "source-row";
  releaseEditions?: Partial<Record<"M" | "N" | "O", SourceRef[]>>;
};
export type WorkbookImports = { workbook: string; records: ImportRow[] };
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
    const resolveTarget = (ref: SourceRef, former: WorkbookTarget | undefined, slot: string): WorkbookTarget => {
      const item = catalog[ref.category]?.[ref.itemId];
      if (!item) throw new Error(`Unknown workbook item at ${key} ${slot}: ${ref.category}/${ref.itemId}`);
      if (former && (former.category !== ref.category || former.contentId !== ref.itemId))
        throw new Error(`Workbook reference changed at ${key} ${slot}; review required`);
      const editions = item.editions ?? [];
      if (!ref.edition) {
        if (editions.length) throw new Error(`Ambiguous workbook item at ${key} ${slot}: ${ref.itemId} has editions`);
        const editionId = ref.category === "bundles" ? "bundle" : "item";
        if (former && former.editionId !== editionId) throw new Error(`Workbook edition changed at ${key} ${slot}; review required`);
        return { category: ref.category, contentId: ref.itemId, editionId };
      }
      let edition = editions.find((candidate) => candidate.label === ref.edition);
      if (former) {
        const retained = editions.find((candidate) => candidate.id === former.editionId);
        if (!retained) throw new Error(`Mapped edition disappeared at ${key} ${slot}: ${former.editionId}`);
        if (former.sourceEdition !== ref.edition && retained.label !== ref.edition)
          throw new Error(`Workbook edition reference changed at ${key} ${slot}; review required`);
        if (edition && edition.id !== retained.id)
          throw new Error(`Workbook edition now resolves to another ID at ${key} ${slot}; review required`);
        edition = retained;
      }
      if (!edition?.id) throw new Error(`Unknown workbook edition at ${key} ${slot}: ${ref.itemId}/${ref.edition}`);
      return { category: ref.category, contentId: ref.itemId, editionId: edition.id, sourceEdition: ref.edition };
    };
    if (old && (old.related?.length ?? 0) !== (record.relatedItems?.length ?? 0))
      throw new Error(`Workbook related references changed at ${key}; review required`);
    const primary = resolveTarget(record, old?.primary, "primary");
    const related = record.relatedItems?.map((ref, index) => resolveTarget(ref, old?.related?.[index], `related[${index}]`));
    const releaseEditions = record.releaseEditions
      ? Object.fromEntries(
          (["M", "N", "O"] as const)
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

export async function writeWorkbookMap(root = process.cwd(), options: { signal?: AbortSignal } = {}) {
  options.signal?.throwIfAborted();
  const catalogRoot = resolve(root, "static/kdm-catalog");
  const mapPath = resolve(catalogRoot, "workbook-map.json");
  const importsPath = resolve(root, "temp/kdm-catalog/imports/kdm-import-records.json");
  const importsSchemaPath = resolve(root, "temp/kdm-catalog/imports/kdm-import-records.schema.json");
  const catalogPath = resolve(catalogRoot, "data.json");
  const schemaPath = resolve(catalogRoot, "workbook-map.schema.json");
  const [importsText, importsSchemaText, catalogText, schemaText, oldText] = await Promise.all([
    readFile(importsPath, "utf8"),
    readFile(importsSchemaPath, "utf8"),
    readFile(catalogPath, "utf8"),
    readFile(schemaPath, "utf8"),
    readFile(mapPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    }),
  ]);
  const imports = JSON.parse(importsText) as WorkbookImports;
  const importValidator = new Ajv2020({ allErrors: true, strict: false });
  const checkImports = importValidator.compile(JSON.parse(importsSchemaText));
  if (!checkImports(imports))
    throw new Error("Workbook import schema errors: " + importValidator.errorsText(checkImports.errors, { separator: "\n" }));
  const catalog = JSON.parse(catalogText) as Catalog;
  const previous = oldText === undefined ? undefined : decodeWorkbookMap(JSON.parse(oldText));
  const map = decodeWorkbookMap(buildWorkbookMap(imports, catalog, previous));
  await publishFiles([{ path: mapPath, json: map }], {
    baselines: [
      { path: importsPath, text: importsText, message: "Workbook imports changed during generation; rerun to preserve your edits." },
      {
        path: importsSchemaPath,
        text: importsSchemaText,
        message: "Workbook import schema changed during generation; rerun to validate current records.",
      },
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  let map;
  try {
    map = await writeWorkbookMap(process.cwd(), { signal: controller.signal });
  } finally {
    process.off("SIGINT", cancel);
  }
  console.log(`Mapped ${map.rows.length} workbook rows to catalog edition IDs.`);
}
