import { Effect, Schema as S } from "effect";
import { reviewEditions, reviewEntries } from "#lib/catalog-view.ts";
import {
  CollectionSnapshotSchema,
  EntryStateSchema,
  collectionKey,
  parseCollectionKey,
  type Catalog,
  type CollectionSnapshot,
  type EntryState,
} from "#lib/types/index.ts";

export class TransferError extends S.TaggedError<TransferError>()("TransferError", {
  operation: S.Literals(["export", "import", "preview"]),
  reason: S.Literals(["invalid-data", "unknown-reference", "ambiguous"]),
  message: S.String,
  reference: S.optionalKey(S.String),
}) {}

const BackupSchema = S.Struct({
  formatVersion: S.Literal(1),
  entries: CollectionSnapshotSchema,
});
const BackupJsonSchema = S.fromJsonString(BackupSchema);

const TargetSchema = S.Struct({
  category: S.String,
  contentId: S.NonEmptyString,
  editionId: S.NonEmptyString,
  sourceEdition: S.optionalKey(S.String),
});

const MapRowSchema = S.Struct({
  sheet: S.NonEmptyString,
  row: S.Int,
  name: S.NonEmptyString,
  primary: TargetSchema,
  related: S.optionalKey(S.Array(TargetSchema)),
  ownershipScope: S.optionalKey(S.Literal("source-row")),
  releaseEditions: S.optionalKey(
    S.Struct({
      M: S.optionalKey(S.Array(TargetSchema)),
      N: S.optionalKey(S.Array(TargetSchema)),
      O: S.optionalKey(S.Array(TargetSchema)),
    }),
  ),
});

const WorkbookMapSchema = S.Struct({
  formatVersion: S.Literal(1),
  rows: S.Array(MapRowSchema),
});

const WorkbookRowsSchema = S.Array(
  S.Struct({
    ...EntryStateSchema.fields,
    sheet: S.NonEmptyString,
    row: S.Int,
    name: S.NonEmptyString,
    releaseColumn: S.optionalKey(S.Literals(["M", "N", "O"])),
    editionId: S.optionalKey(S.NonEmptyString),
  }),
);

export type WorkbookRow = S.Schema.Type<typeof WorkbookRowsSchema>[number];
export type WorkbookMap = S.Schema.Type<typeof WorkbookMapSchema>;

function invalid(operation: TransferError["operation"], message: string, reference?: string) {
  return new TransferError({ operation, reason: "invalid-data", message, ...(reference === undefined ? {} : { reference }) });
}

const decodeMapping = Effect.fn("CollectionTransfer.decodeMapping")(function* (operation: TransferError["operation"], mapping?: unknown) {
  const input =
    mapping ??
    (yield* Effect.tryPromise({
      try: () => import("../../../static/kdm-catalog/workbook-map.json").then((module) => module.default),
      catch: () => invalid(operation, "Workbook mapping could not be loaded."),
    }));
  const map = yield* S.decodeUnknownEffect(WorkbookMapSchema)(input).pipe(
    Effect.mapError(() => invalid(operation, "Workbook mapping is invalid.")),
  );
  const locators = new Set<string>();
  for (const row of map.rows) {
    const locator = JSON.stringify([row.sheet, row.row]);
    if (locators.has(locator)) return yield* invalid(operation, `Workbook mapping repeats ${locator}.`, locator);
    locators.add(locator);
  }
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
    const [contentId, editionId] = parseCollectionKey(key);
    const edition = hasTarget(contentId, editionId);
    if (!edition) {
      return yield* new TransferError({
        operation,
        reason: "unknown-reference",
        message: `Collection entry ${key} does not match the current catalog.`,
        reference: key,
      });
    }
    if (entry.copyNumber !== undefined && edition.runSize !== undefined && entry.copyNumber > edition.runSize) {
      return yield* invalid(operation, `Copy number for ${key} exceeds its run size of ${edition.runSize}.`, key);
    }
  }
  return snapshot;
});

export const encodeBackup = Effect.fn("CollectionTransfer.encodeBackup")(function* (snapshot: CollectionSnapshot, catalog: Catalog) {
  const entries = yield* S.decodeUnknownEffect(CollectionSnapshotSchema, { onExcessProperty: "error" })(snapshot).pipe(
    Effect.mapError(() => invalid("export", "Collection data is invalid.")),
  );
  yield* validateSnapshot(entries, catalog, "export");
  return JSON.stringify({ formatVersion: 1, entries });
});

export const decodeBackup = Effect.fn("CollectionTransfer.decodeBackup")(function* (json: string, catalog: Catalog) {
  const backup = yield* S.decodeUnknownEffect(BackupJsonSchema, { onExcessProperty: "error" })(json).pipe(
    Effect.mapError(() => invalid("import", "Backup format or collection entries are invalid.")),
  );
  return yield* validateSnapshot(backup.entries, catalog, "import");
});

export const previewWorkbookRows = Effect.fn("CollectionTransfer.previewWorkbookRows")(function* (
  input: unknown,
  catalog: Catalog,
  mapping?: unknown,
) {
  const rows = yield* S.decodeUnknownEffect(WorkbookRowsSchema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(() => invalid("preview", "Workbook rows are invalid.")),
  );
  const map = yield* decodeMapping("preview", mapping);
  return yield* resolveWorkbookRows(rows, catalog, map, "preview");
});

// Inputs are decoded at the public boundary; exports reuse the same resolution rules without decoding them again.
const resolveWorkbookRows = Effect.fn("CollectionTransfer.resolveWorkbookRows")(function* (
  rows: readonly WorkbookRow[],
  catalog: Catalog,
  map: WorkbookMap,
  operation: "preview" | "export",
) {
  const byLocator = new Map(map.rows.map((row) => [JSON.stringify([row.sheet, row.row]), row]));
  const hasTarget = knownTarget(catalog);
  const entries: Record<string, EntryState> = {};
  const seenRows = new Set<string>();
  for (const row of rows) {
    const locator = JSON.stringify([row.sheet, row.row]);
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

// These rows contain only collection fields and product locators. XLSX cell handling belongs in a future adapter.
export const exportWorkbookRows = Effect.fn("CollectionTransfer.exportWorkbookRows")(function* (
  snapshot: CollectionSnapshot,
  catalog: Catalog,
  mapping?: unknown,
) {
  const entries = yield* S.decodeUnknownEffect(CollectionSnapshotSchema, { onExcessProperty: "error" })(snapshot).pipe(
    Effect.mapError(() => invalid("export", "Collection data is invalid.")),
  );
  yield* validateSnapshot(entries, catalog, "export");
  const map = yield* decodeMapping("export", mapping);
  const rows: WorkbookRow[] = [];
  const represented = new Set<string>();
  for (const source of map.rows) {
    const selections = [
      { target: source.primary, releaseColumn: undefined },
      ...(["M", "N", "O"] as const).flatMap((releaseColumn) =>
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
        roundtrip[key].copyNumber !== entry.copyNumber,
    )
  )
    return yield* invalid("export", "Workbook rows cannot represent this collection without changing its values.");
  return rows;
});
