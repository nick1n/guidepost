import { asset } from "$app/paths";
import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http";
import { reviewEditions, reviewEntries } from "#lib/catalog-view.ts";
import {
  CollectionSnapshotSchema,
  collectionKey,
  parseCollectionKey,
  type Catalog,
  type CollectionSnapshot,
  type EntryState,
} from "#lib/types/index.ts";

import {
  workbookLocator,
  releaseColumns,
  WorkbookMapSchema,
  WorkbookRowsSchema,
  type WorkbookMap,
  type WorkbookRow,
  type MappedWorkbookRow,
  type CollectionWorkbookRow,
} from "#lib/types/workbook.ts";
import { normalizeSnapshot } from "#lib/types/collection.ts";
export type { WorkbookMap, WorkbookRow } from "#lib/types/workbook.ts";

export class TransferError extends Schema.TaggedError<TransferError>()("TransferError", {
  operation: Schema.Literals(["export", "import", "preview"]),
  reason: Schema.Literals(["invalid-data", "unknown-reference", "ambiguous"]),
  message: Schema.String,
  reference: Schema.optionalKey(Schema.String),
}) {}

const BackupSchema = Schema.Struct({
  formatVersion: Schema.Literal(1),
  entries: CollectionSnapshotSchema,
});
const BackupJsonSchema = Schema.fromJsonString(BackupSchema);

function invalid(operation: TransferError["operation"], message: string, reference?: string) {
  return new TransferError({ operation, reason: "invalid-data", message, ...(reference === undefined ? {} : { reference }) });
}

const decodeMapping = Effect.fn("CollectionTransfer.decodeMapping")(function* (operation: TransferError["operation"], mapping?: unknown) {
  const input =
    mapping ??
    (yield* HttpClient.get(asset("kdm/catalog/workbook-map.json")).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((response) => response.json),
      Effect.mapError(() => invalid(operation, "Workbook mapping could not be loaded.")),
      Effect.provide(FetchHttpClient.layer),
    ));
  const map = yield* Schema.decodeUnknownEffect(WorkbookMapSchema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(() => invalid(operation, "Workbook mapping is invalid.")),
  );
  return map;
});

function knownTarget(catalog: Catalog) {
  const items = new Map(reviewEntries(catalog).map((item) => [item.id, item]));
  return (contentId: string, editionId: string, category?: string) => {
    const item = items.get(contentId);
    return item !== undefined && (category === undefined || item.category === category)
      ? reviewEditions(item).find((edition) => edition.id === editionId)
      : undefined;
  };
}

const validateSnapshot = Effect.fn("CollectionTransfer.validateSnapshot")(function* (
  snapshot: CollectionSnapshot,
  catalog: Catalog,
  operation: TransferError["operation"],
) {
  const hasTarget = knownTarget(catalog);
  for (const [key, entry] of Object.entries(snapshot)) {
    if (entry.owned && entry.wished) return yield* invalid(operation, `Collection entry ${key} cannot be both owned and wished.`, key);
    const [contentId, editionId] = yield* Effect.fromResult(parseCollectionKey(key)).pipe(
      Effect.mapError(() => invalid(operation, "Collection entry has an invalid key.", key)),
    );
    const edition = hasTarget(contentId, editionId);
    if (!edition) {
      return yield* new TransferError({
        operation,
        reason: "unknown-reference",
        message: `Collection entry ${key} does not match the current catalog.`,
        reference: key,
      });
    }
  }
  return snapshot;
});

export const encodeBackup = Effect.fn("CollectionTransfer.encodeBackup")(function* (snapshot: CollectionSnapshot, catalog: Catalog) {
  const entries = yield* Schema.decodeUnknownEffect(CollectionSnapshotSchema, { onExcessProperty: "error" })(snapshot).pipe(
    Effect.mapError(() => invalid("export", "Collection data is invalid.")),
  );
  yield* validateSnapshot(entries, catalog, "export");
  return JSON.stringify({ formatVersion: 1, entries: normalizeSnapshot(entries) });
});

export const decodeBackup = Effect.fn("CollectionTransfer.decodeBackup")(function* (json: string, catalog: Catalog) {
  const backup = yield* Schema.decodeUnknownEffect(BackupJsonSchema, { onExcessProperty: "error" })(json).pipe(
    Effect.mapError(() => invalid("import", "Backup format or collection entries are invalid.")),
  );
  return normalizeSnapshot(yield* validateSnapshot(backup.entries, catalog, "import"));
});

export const previewWorkbookRows = Effect.fn("CollectionTransfer.previewWorkbookRows")(function* (
  input: unknown,
  catalog: Catalog,
  mapping?: unknown,
) {
  const rows = yield* Schema.decodeUnknownEffect(WorkbookRowsSchema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(() => invalid("preview", "Workbook rows are invalid.")),
  );
  const direct = rows.length > 0 && rows.every((row) => row.sheet === "Guidepost collection");
  const map = direct ? undefined : yield* decodeMapping("preview", mapping);
  return yield* resolveWorkbookRows(rows, catalog, map, "preview");
});

// Inputs are decoded at the public boundary; exports reuse the same resolution rules without decoding them again.
const resolveWorkbookRows = Effect.fn("CollectionTransfer.resolveWorkbookRows")(function* (
  rows: readonly WorkbookRow[],
  catalog: Catalog,
  map: WorkbookMap | undefined,
  operation: "preview" | "export",
) {
  const byLocator = new Map((map?.rows ?? []).map((row) => [workbookLocator(row), row]));
  const hasTarget = knownTarget(catalog);
  const entries: Record<string, EntryState> = {};
  const seenRows = new Set<string>();
  const directTargets = new Set<string>();
  for (const row of rows) {
    if (row.sheet === "Guidepost collection") {
      const key = collectionKey(row.contentId, row.editionId);
      if (entries[key]) return yield* invalid(operation, `Workbook repeats collection edition ${key}.`, key);
      directTargets.add(key);
      entries[key] = {
        ...(row.owned === undefined ? {} : { owned: row.owned }),
        ...(row.wished === undefined ? {} : { wished: row.wished }),
        ...(row.missing === undefined ? {} : { missing: row.missing }),
        ...(row.copyNumber === undefined ? {} : { copyNumber: row.copyNumber }),
      };
      continue;
    }
    const locator = workbookLocator(row);
    const selection = JSON.stringify([row.sheet, row.row, row.releaseColumn ?? null]);
    if (seenRows.has(selection)) return yield* invalid(operation, `Workbook selection ${selection} appears more than once.`, locator);
    seenRows.add(selection);
    const source = byLocator.get(locator);
    if (!source || source.name !== row.name) {
      return yield* new TransferError({
        operation,
        reason: "unknown-reference",
        message: `Workbook row ${row.sheet}, ${row.row} does not match the mapping name and location.`,
        reference: locator,
      });
    }
    const alternatives = row.releaseColumn ? source.releaseEditions?.[row.releaseColumn] : undefined;
    if (row.releaseColumn && (!alternatives || alternatives.length === 0)) {
      return yield* new TransferError({
        operation,
        reason: "unknown-reference",
        message: `Workbook row ${row.sheet}, ${row.row} has no ${row.releaseColumn} release mapping.`,
        reference: locator,
      });
    }
    const candidates = alternatives ?? [source.primary];
    const selected = row.editionId ? candidates.filter((candidate) => candidate.editionId === row.editionId) : candidates;
    if (selected.length === 0) {
      return yield* new TransferError({
        operation,
        reason: "unknown-reference",
        message: `Edition ${row.editionId} is not mapped to workbook row ${row.sheet}, ${row.row}.`,
        reference: locator,
      });
    }
    if (selected.length > 1) {
      return yield* new TransferError({
        operation,
        reason: "ambiguous",
        message: `Workbook row ${row.sheet}, ${row.row} has multiple release editions. Select an edition ID.`,
        reference: locator,
      });
    }
    const selectedTarget = selected[0];
    const targets = source.ownershipScope === "source-row" ? [selectedTarget, ...(source.related ?? [])] : selected;
    for (const target of targets) {
      const key = collectionKey(target.contentId, target.editionId);
      if (directTargets.has(key)) return yield* invalid(operation, `Workbook repeats collection edition ${key}.`, key);
      if (!hasTarget(target.contentId, target.editionId, target.category)) {
        return yield* new TransferError({
          operation,
          reason: "unknown-reference",
          message: `Mapped edition ${key} does not match the current catalog.`,
          reference: key,
        });
      }
      const entry = {
        ...(row.owned === undefined ? {} : { owned: row.owned }),
        ...(row.owned ? { wished: false } : row.wished === undefined ? {} : { wished: row.wished }),
        ...(row.copyNumber === undefined || target !== selectedTarget ? {} : { copyNumber: row.copyNumber }),
      };
      const previous = entries[key];
      if (
        previous &&
        Object.entries(entry).some(([field, value]) => Object.hasOwn(previous, field) && previous[field as keyof EntryState] !== value)
      ) {
        return yield* invalid(operation, `Workbook rows assign conflicting values to ${key}.`, key);
      }
      entries[key] = { ...previous, ...entry };
    }
  }
  return yield* validateSnapshot(entries, catalog, operation);
});

// These rows contain only collection fields and product locators. The XLSX adapter owns cell handling.
export const exportWorkbookRows = Effect.fn("CollectionTransfer.exportWorkbookRows")(function* (
  snapshot: CollectionSnapshot,
  catalog: Catalog,
  mapping?: unknown,
) {
  const validated = yield* Schema.decodeUnknownEffect(CollectionSnapshotSchema, { onExcessProperty: "error" })(snapshot).pipe(
    Effect.mapError(() => invalid("export", "Collection data is invalid.")),
  );
  yield* validateSnapshot(validated, catalog, "export");
  const entries = normalizeSnapshot(validated);
  const map = yield* decodeMapping("export", mapping);
  const rows: MappedWorkbookRow[] = [];
  const represented = new Set<string>();
  for (const source of map.rows) {
    const selections = [
      { target: source.primary, releaseColumn: undefined },
      ...releaseColumns.flatMap((releaseColumn) =>
        (source.releaseEditions?.[releaseColumn] ?? []).map((target) => ({ target, releaseColumn })),
      ),
    ];
    for (const { target, releaseColumn } of selections) {
      const key = collectionKey(target.contentId, target.editionId);
      const entry = entries[key];
      if (!entry || represented.has(key)) continue;
      if (source.ownershipScope === "source-row") {
        for (const related of source.related ?? []) {
          const relatedKey = collectionKey(related.contentId, related.editionId);
          const relatedEntry = entries[relatedKey];
          if (
            !relatedEntry ||
            relatedEntry.owned !== entry.owned ||
            relatedEntry.wished !== entry.wished ||
            relatedEntry.copyNumber !== undefined
          ) {
            return yield* invalid(
              "export",
              `Workbook row ${source.sheet}, ${source.row} cannot represent separate collection values for ${relatedKey}.`,
              relatedKey,
            );
          }
          represented.add(relatedKey);
        }
      }
      rows.push({
        sheet: source.sheet,
        row: source.row,
        name: source.name,
        editionId: target.editionId,
        ...entry,
        ...(releaseColumn ? { releaseColumn } : {}),
      });
      represented.add(key);
    }
  }
  for (const key of Object.keys(entries)) {
    if (!represented.has(key))
      return yield* new TransferError({
        operation: "export",
        reason: "unknown-reference",
        message: `Collection entry ${key} has no workbook mapping.`,
        reference: key,
      });
  }
  // Revalidate the chosen row identities so exports cannot silently change collection values.
  const roundtrip = yield* resolveWorkbookRows(rows, catalog, map, "export");
  if (
    Object.keys(roundtrip).length !== Object.keys(entries).length ||
    Object.entries(entries).some(
      ([key, entry]) =>
        !roundtrip[key] ||
        Boolean(roundtrip[key].owned) !== Boolean(entry.owned) ||
        Boolean(roundtrip[key].wished) !== Boolean(entry.wished) ||
        Boolean(roundtrip[key].missing) !== Boolean(entry.missing) ||
        roundtrip[key].copyNumber !== entry.copyNumber,
    )
  )
    return yield* invalid("export", "Workbook rows cannot represent this collection without changing its values.");
  return rows;
});

// Fresh workbooks use catalog identities directly, independent of the original spreadsheet's coverage and shared rows.
export const exportCollectionRows = Effect.fn("CollectionTransfer.exportCollectionRows")(function* (
  snapshot: CollectionSnapshot,
  catalog: Catalog,
) {
  const decoded = yield* Schema.decodeUnknownEffect(CollectionSnapshotSchema, { onExcessProperty: "error" })(snapshot).pipe(
    Effect.mapError(() => invalid("export", "Collection data is invalid.")),
  );
  yield* validateSnapshot(decoded, catalog, "export");
  const items = new Map(reviewEntries(catalog).map((item) => [item.id, item]));
  const rows: CollectionWorkbookRow[] = [];
  for (const [key, entry] of Object.entries(normalizeSnapshot(decoded))) {
    const [contentId, editionId] = yield* Effect.fromResult(parseCollectionKey(key)).pipe(
      Effect.mapError(() => invalid("export", "Collection entry has an invalid key.", key)),
    );
    rows.push({
      sheet: "Guidepost collection",
      row: rows.length + 3,
      name: items.get(contentId)?.name ?? contentId,
      contentId,
      editionId,
      ...entry,
    });
  }
  return rows;
});
