import type { Sheet } from "read-excel-file/universal";
import { Effect, Result, Schema } from "effect";
import mappingJson from "#catalog/workbook-map.json";
import {
  decodeWorkbookMap,
  sheets,
  releaseColumns,
  workbookLocator,
  WorkbookRowsSchema,
  CollectionWorkbookRowsSchema,
  MetadataSchema,
  metadataColumn,
  templateMarker,
  type MappingRow,
  type WorkbookRow,
  type ReleaseColumn,
  type CollectionWorkbookRow,
  type Metadata,
} from "#lib/types/workbook.ts";
import { TransferError } from "../state/collection-transfer.ts";
import { CopyNumberSchema, copyNumberMaximum } from "#lib/types/collection.ts";
import type { CatalogEntry } from "#lib/catalog-view.ts";
import { workbookIdentities } from "./identity.ts";

// The product-only mapping loads after a workbook action; the XLSX reader loads only for imports.
export const mapping = decodeWorkbookMap(mappingJson);
const sheetName = "Guidepost collection";
const marker = "Guidepost collection v2";
const oldHeaders = ["Sheet", "Row", "Name", "Release column", "Edition ID", "Owned", "Wanted", "Copy number"];
const headers = [...oldHeaders, "Content ID", "Missing"];
const sources = new Map(mapping.rows.map((row) => [workbookLocator(row), row]));
const decodeCopyNumber = Schema.decodeUnknownResult(CopyNumberSchema);
const decodeTableRows = Schema.decodeUnknownSync(WorkbookRowsSchema, { onExcessProperty: "error" });
const decodeMetadata = Schema.decodeUnknownSync(Schema.fromJsonString(MetadataSchema), { onExcessProperty: "error" });

type Selection = { editionId: string; contentId?: string; releaseColumn?: ReleaseColumn; label?: string };
export type Draft = { id: string; row: WorkbookRow; options: Selection[]; hint: string; overlay?: boolean };
type Cell = { value: unknown; address: string; sheet: string };

function cell(sheet: Sheet, row: number, column: number | string): Cell {
  const index = typeof column === "number" ? column : [...column].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0);
  return { value: sheet.data[row - 1]?.[index - 1], address: `${column}${row}`, sheet: sheet.sheet };
}

function invalid(operation: TransferError["operation"], message: string) {
  return new TransferError({ operation, reason: "invalid-data", message });
}

// The parser returns cached formula results and visible text; it never evaluates formulas or follows links.
function text(cell: Cell) {
  const input = cell.value;
  return typeof input === "string" ? input.trim().replace(/\s+/gu, " ") : input;
}

function checkbox(cell: Cell): boolean | undefined {
  const input = text(cell);
  if (input === null || input === undefined || input === "") return undefined;
  if (input === true || input === 1) return true;
  if (input === false || input === 0) return false;
  if (typeof input === "string") {
    const token = input.toLowerCase();
    if (["true", "yes", "x", "✓", "1"].includes(token)) return true;
    if (["false", "no", "0"].includes(token)) return false;
  }
  throw invalid("import", `Invalid checkbox at ${cell.sheet}, ${cell.address}. Use true or false.`);
}

function materialSelection(cell: Cell) {
  const input = text(cell);
  if (typeof input === "string" && input !== "") return !["false", "no", "0"].includes(input.toLowerCase());
  return checkbox(cell);
}

function numericCopyNumber(cell: Cell) {
  const input = text(cell);
  if (input === null || input === undefined || input === "") return undefined;
  const number = typeof input === "string" && /^\d+$/u.test(input) ? Number(input) : input;
  const result = decodeCopyNumber(number);
  if (Result.isFailure(result))
    throw invalid("import", `Invalid copy number at ${cell.sheet}, ${cell.address}. Use a whole number from 0 to ${copyNumberMaximum}.`);
  return result.success;
}

function copyNumber(cell: Cell) {
  const input = text(cell);
  if (typeof input === "string" && /^of\s+(?:[\d,]+|\?)$/iu.test(input)) return undefined;
  return numericCopyNumber(cell);
}

function selections(source: MappingRow, column?: ReleaseColumn): Selection[] {
  if (column) return (source.releaseEditions?.[column] ?? []).map((target) => ({ editionId: target.editionId, releaseColumn: column }));
  const options = new Map<string, Selection>([[source.primary.editionId, { editionId: source.primary.editionId }]]);
  for (const releaseColumn of releaseColumns) {
    for (const target of source.releaseEditions?.[releaseColumn] ?? []) {
      if (!options.has(target.editionId)) options.set(target.editionId, { editionId: target.editionId, releaseColumn });
    }
  }
  return [...options.values()];
}

function readTable(sheet: Sheet): Draft[] {
  const version = cell(sheet, 1, "A").value;
  const expectedHeaders = version === "Guidepost collection v1" ? oldHeaders : headers;
  if (
    (version !== marker && version !== "Guidepost collection v1") ||
    expectedHeaders.some((header, index) => cell(sheet, 2, index + 1).value !== header)
  )
    throw invalid("import", "This Guidepost workbook has an unsupported format or changed column headings.");
  const rows: WorkbookRow[] = [];
  sheet.data.forEach((line, index) => {
    const number = index + 1;
    if (number <= 2 || line.every((value) => value === null)) return;
    const getCell = (column: number) => cell(sheet, number, column);
    const releaseColumn = text(getCell(4));
    const editionId = text(getCell(5));
    const contentId = version === marker ? text(getCell(9)) : undefined;
    const row = {
      sheet: text(getCell(1)),
      row: getCell(2).value,
      name: text(getCell(3)),
      ...(releaseColumn ? { releaseColumn } : {}),
      ...(editionId ? { editionId } : {}),
      owned: checkbox(getCell(6)),
      wished: checkbox(getCell(7)),
      copyNumber: numericCopyNumber(getCell(8)),
      ...(contentId ? { contentId } : {}),
      ...(version === marker ? { missing: checkbox(getCell(10)) } : {}),
    };
    const decoded = decodeTableRows([Object.fromEntries(Object.entries(row).filter(([, field]) => field !== undefined))]);
    rows.push(decoded[0]);
  });
  return rows.map((row, index) => ({ id: `table-${index}`, row, options: [], hint: "" }));
}

function readLegacy(workbook: Sheet[]): Draft[] {
  const drafts: Draft[] = [];
  let found = false;
  for (const name of sheets) {
    const sheet = workbook.find((sheet) => sheet.sheet === name);
    if (!sheet) continue;
    found = true;
    const miniatures = name === "KDM Miniatures";
    const expected = miniatures ? "Model" : name === "Shirt Catalog" ? "Shirts" : "Death Dice";
    if (text(cell(sheet, miniatures ? 1 : 2, miniatures ? "B" : "C")) !== expected)
      throw invalid("import", `The ${name} column headings do not match the collection workbook.`);
    sheet.data.forEach((line, index) => {
      const number = index + 1;
      if (number <= (miniatures ? 1 : 2)) return;
      const getCell = (column: string) => cell(sheet, number, column);
      const owned = checkbox(getCell(miniatures ? "A" : "B"));
      const materialOwned = miniatures ? materialSelection(getCell("I")) : undefined;
      const wished = miniatures ? materialSelection(getCell("J")) : undefined;
      const copy = miniatures ? copyNumber(getCell("L")) : undefined;
      const releases = miniatures ? releaseColumns.filter((column) => checkbox(getCell(column))) : [];
      if (!owned && !materialOwned && !wished && copy === undefined && !releases.length) return;
      const source = sources.get(workbookLocator({ sheet: name, row: number }));
      if (!source || text(getCell(miniatures ? "B" : "C")) !== source.name)
        throw invalid("import", `Selected row ${name}, ${number} does not match the mapping. Use the original collection workbook layout.`);
      const add = (fields: Pick<WorkbookRow, "owned" | "wished" | "copyNumber">, column?: ReleaseColumn, hint = "") => {
        const options = selections(source, column);
        if (!options.length) throw invalid("import", `There is no ${column} release mapping for ${source.name}.`);
        drafts.push({
          id: JSON.stringify([name, number, column ?? null, drafts.length]),
          row: { sheet: source.sheet, row: number, name: source.name, ...fields, ...(options.length === 1 ? options[0] : {}) },
          options: options.length > 1 ? options : [],
          hint,
        });
      };
      const copyColumn = copy !== undefined && source.releaseEditions?.M ? "M" : undefined;
      if (releases.length) {
        for (const column of releases) add({ owned: true, ...(column === "M" && copy !== undefined ? { copyNumber: copy } : {}) }, column);
      } else if (owned || materialOwned || copy !== undefined) {
        const materialHint = text(getCell("I"));
        add(
          { ...(owned || materialOwned ? { owned: true } : {}), ...(copy === undefined ? {} : { copyNumber: copy }) },
          copyColumn,
          typeof materialHint === "string" ? materialHint : "",
        );
      }
      if (copy !== undefined && releases.length && !releases.includes("M"))
        add({ copyNumber: copy }, source.releaseEditions?.M ? "M" : undefined);
      if (wished) add({ wished: true }, undefined, String(text(getCell("J")) ?? ""));
    });
  }
  if (!found) throw invalid("import", "Choose a KDM Collection Sheets workbook or a workbook exported by Guidepost.");
  return drafts;
}

function readTemplate(workbook: Sheet[]): Draft[] {
  const drafts: Draft[] = [];
  const seen = new Set<string>();
  for (const sheet of workbook) {
    if (cell(sheet, 1, metadataColumn).value !== templateMarker) continue;
    const miniature = sheet.sheet === "KDM Miniatures";
    const byRow = new Map<number, Metadata>();
    sheet.data.forEach((_line, index) => {
      const number = index + 1;
      const raw = cell(sheet, number, metadataColumn).value;
      if (number <= (miniature ? 1 : 2) || raw === null || raw === undefined || raw === "") return;
      const metadata = decodeMetadata(raw);
      byRow.set(number, metadata);
    });
    const matchProduct = workbookIdentities(byRow);
    sheet.data.forEach((_line, index) => {
      const number = index + 1;
      if (number <= (miniature ? 1 : 2)) return;
      const name = text(cell(sheet, number, miniature ? "B" : "C"));
      if (typeof name !== "string" || !name) return;
      const metadata = matchProduct(number, { name, ...(miniature ? { material: text(cell(sheet, number, "H")) } : {}) });
      if (!metadata) {
        if (byRow.has(number) || checkbox(cell(sheet, number, miniature ? "A" : "B")))
          throw invalid(
            "import",
            `Product identity changed at ${sheet.sheet}, ${number}. Keep the original product names and materials when editing the workbook.`,
          );
        return;
      }
      const getCell = (column: string) => cell(sheet, number, column);
      const add = (
        entry: Metadata["entries"][number],
        fields: Pick<WorkbookRow, "owned" | "wished" | "missing" | "copyNumber">,
        overlay = false,
        options: Selection[] = [],
        hint = "",
      ) => {
        drafts.push({
          id: JSON.stringify([sheet.sheet, number, drafts.length]),
          row: {
            sheet: "Guidepost collection",
            row: number,
            name: metadata.name,
            contentId: entry.contentId,
            editionId: entry.editionId,
            ...fields,
          },
          options,
          hint,
          ...(overlay ? { overlay } : {}),
        });
      };
      for (const entry of metadata.entries) {
        const key = JSON.stringify([entry.contentId, entry.editionId]);
        if (Object.keys(entry.state).length && !seen.has(key)) {
          add(entry, {
            owned: entry.state.owned ?? false,
            wished: entry.state.wished ?? false,
            missing: entry.state.missing ?? false,
            ...entry.state,
          });
          seen.add(key);
        }
      }
      const changed = (column: string) => (text(getCell(column)) ?? null) !== (metadata.baseline[column] ?? null);
      const ownership = (entries: Metadata["entries"], owned: boolean) => {
        for (const entry of entries) add(entry, { owned, missing: false, ...(owned ? { wished: false } : {}) }, true);
      };
      const ownColumn = miniature ? "A" : "B";
      if (changed(ownColumn)) {
        const owned = checkbox(getCell(ownColumn));
        if (owned !== undefined) ownership(owned ? metadata.entries.slice(0, 1) : metadata.entries, owned);
      }
      if (!miniature) return;
      for (const column of releaseColumns) {
        if (changed(column)) {
          const owned = checkbox(getCell(column));
          if (owned !== undefined)
            ownership(
              metadata.entries.filter((entry) => entry.column === column),
              owned,
            );
        }
      }
      for (const [column, field] of [
        ["I", "owned"],
        ["J", "wished"],
      ] as const) {
        if (!changed(column)) continue;
        const selected = materialSelection(getCell(column));
        if (!selected) {
          for (const entry of metadata.entries) add(entry, field === "owned" ? { owned: false, missing: false } : { wished: false }, true);
          continue;
        }
        const hint = String(text(getCell(column)));
        const matches = metadata.entries.filter(
          (entry) => entry.material.toLowerCase() === hint.toLowerCase() || entry.label.toLowerCase() === hint.toLowerCase(),
        );
        const candidates = matches.length ? matches : metadata.entries;
        const entry = candidates[0];
        if (!entry) continue;
        add(
          entry,
          field === "owned" ? { owned: true, wished: false, missing: false } : { wished: true },
          true,
          candidates.length > 1
            ? candidates.map((entry) => ({ contentId: entry.contentId, editionId: entry.editionId, label: entry.label }))
            : [],
          hint,
        );
      }
      if (changed("L")) {
        const copy = copyNumber(getCell("L"));
        const numbered = metadata.entries.find((entry) => entry.column === "M") ?? metadata.entries[0];
        if (copy !== undefined && numbered) add(numbered, { copyNumber: copy }, true);
      }
    });
  }
  return drafts;
}

export function resolveDrafts(drafts: readonly Draft[], selected: Readonly<Record<string, string>> = {}) {
  const rows: WorkbookRow[] = [];
  for (const draft of drafts) {
    const option = draft.options.find((option) => JSON.stringify(option) === selected[draft.id]);
    if (draft.options.length && !option) return;
    const row = {
      ...draft.row,
      ...(option ? { editionId: option.editionId } : {}),
      ...(option?.contentId ? { contentId: option.contentId } : {}),
      ...(option?.releaseColumn ? { releaseColumn: option.releaseColumn } : {}),
    };
    const existing =
      draft.overlay && row.sheet === "Guidepost collection"
        ? rows.findIndex(
            (previous) =>
              previous.sheet === "Guidepost collection" && previous.contentId === row.contentId && previous.editionId === row.editionId,
          )
        : -1;
    if (existing >= 0) rows[existing] = { ...rows[existing], ...row };
    else rows.push(row);
  }
  return rows;
}

export const readWorkbook = Effect.fn("WorkbookFile.read")(function* (file: Pick<File, "size" | "arrayBuffer">) {
  if (file.size > 30 * 1024 * 1024) return yield* invalid("import", "The workbook is too large. Choose an XLSX file under 30 MB.");
  const bytes = yield* Effect.tryPromise({
    try: () => file.arrayBuffer(),
    catch: () => invalid("import", "The selected workbook could not be read."),
  });
  const workbook = yield* Effect.tryPromise({
    try: () => import("read-excel-file/universal").then(({ default: readXlsxFile }) => readXlsxFile(bytes, { trim: false })),
    catch: () => invalid("import", "The file could not be opened. Choose an unencrypted XLSX workbook."),
  });
  const drafts = yield* Effect.try({
    try: () => {
      const table = workbook.find((sheet) => sheet.sheet === sheetName);
      if (table) return readTable(table);
      if (workbook.some((sheet) => cell(sheet, 1, metadataColumn).value === templateMarker)) return readTemplate(workbook);
      return readLegacy(workbook);
    },
    catch: (error) => (error instanceof TransferError ? error : invalid("import", "The workbook contains invalid collection cells.")),
  });
  yield* validateRows(drafts.map((draft) => draft.row));
  return drafts;
});

const validateRows = (rows: unknown) =>
  Schema.decodeUnknownEffect(WorkbookRowsSchema, { onExcessProperty: "error" })(rows).pipe(
    Effect.mapError(() => invalid("import", "The workbook contains invalid row identities or collection values.")),
  );

export const writeWorkbook = Effect.fn("WorkbookFile.write")(function* (
  input: readonly CollectionWorkbookRow[],
  items: readonly CatalogEntry[],
) {
  const rows = yield* Schema.decodeUnknownEffect(CollectionWorkbookRowsSchema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(() => invalid("export", "The workbook contains invalid row identities or collection values.")),
  );
  const { writeTemplate } = yield* Effect.tryPromise({
    try: () => import("./template.ts"),
    catch: () => invalid("export", "The workbook template could not be loaded. Please try again."),
  });
  return yield* Effect.try({
    try: () => writeTemplate(rows, mapping, items),
    catch: () => invalid("export", "The workbook could not be created. Please try again."),
  });
});

export const downloadWorkbook = Effect.fn("WorkbookFile.download")((bytes: Uint8Array<ArrayBuffer>) =>
  Effect.try({
    try: () => {
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Guidepost collection.xlsx";
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        // Give the browser time to begin the download before releasing the Blob.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
    catch: () => invalid("export", "The workbook download could not be started. Please try again."),
  }),
);
