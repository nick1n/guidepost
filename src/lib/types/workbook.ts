import { Schema as S } from "effect";
import { EntryStateSchema } from "./collection.ts";

const SheetSchema = S.Literals(["KDM Miniatures", "Shirt Catalog", "Dice Catalog"]);
const RowNumberSchema = S.Int.check(S.isGreaterThanOrEqualTo(2));
const EditionIdSchema = S.String.check(S.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u));

export const WorkbookTargetSchema = S.Struct({
  category: S.Literals(["content", "accessories", "bundles", "included-only"]),
  contentId: S.NonEmptyString,
  editionId: EditionIdSchema,
  sourceEdition: S.optionalKey(S.NonEmptyString),
}).annotate({ identifier: "target" });
export interface WorkbookTarget extends S.Schema.Type<typeof WorkbookTargetSchema> {}

const AlternativesSchema = S.Array(WorkbookTargetSchema).check(
  S.isMinLength(1),
  S.makeFilter((targets) => new Set(targets.map((target) => JSON.stringify(target))).size === targets.length, {
    message: "Workbook alternatives must be unique.",
    toJsonSchema: () => ({ uniqueItems: true }),
  }),
);
const MapRowSchema = S.Struct({
  sheet: SheetSchema,
  row: RowNumberSchema,
  name: S.NonEmptyString,
  primary: WorkbookTargetSchema,
  related: S.optionalKey(AlternativesSchema),
  ownershipScope: S.optionalKey(S.Literal("source-row")),
  releaseEditions: S.optionalKey(
    S.Struct({
      M: S.optionalKey(AlternativesSchema),
      N: S.optionalKey(AlternativesSchema),
      O: S.optionalKey(AlternativesSchema),
    }).check(S.isMinProperties(1)),
  ),
}).check(
  S.makeFilter((row) => row.related === undefined || row.ownershipScope === "source-row", {
    message: "Related workbook targets require source-row ownership.",
    toJsonSchema: () => ({ if: { required: ["related"] }, then: { required: ["ownershipScope"] } }),
  }),
  S.makeFilter((row) => row.sheet === "KDM Miniatures" || row.primary.editionId === "item", {
    message: "Shirt and dice rows require the synthetic item edition.",
    toJsonSchema: () => ({
      if: { properties: { sheet: { enum: ["Shirt Catalog", "Dice Catalog"] } }, required: ["sheet"] },
      then: { properties: { primary: { properties: { editionId: { const: "item" } } } } },
    }),
  }),
);
export interface WorkbookMappingRow extends S.Schema.Type<typeof MapRowSchema> {}

export const WorkbookMapSchema = S.Struct({
  $schema: S.Literal("./workbook-map.schema.json"),
  formatVersion: S.Literal(1),
  source: S.Struct({ id: S.Literal("kdm-collection-sheets"), workbook: S.NonEmptyString }),
  rows: S.Array(MapRowSchema),
})
  .check(
    S.makeFilter((map) => new Set(map.rows.map(workbookLocator)).size === map.rows.length, {
      message: "Workbook mapping repeats a sheet and row locator.",
      // JSON Schema cannot express uniqueness by selected fields of array objects.
      toJsonSchema: () => [{}, true],
    }),
  )
  .annotate({
    title: "KDM workbook to catalog edition mapping",
    description: "Product references for one workbook snapshot. Sheet and row locate a source record; they are not permanent IDs.",
  });
export interface WorkbookMap extends S.Schema.Type<typeof WorkbookMapSchema> {}

export const WorkbookRowsSchema = S.Array(
  S.Struct({
    ...EntryStateSchema.fields,
    sheet: SheetSchema,
    row: RowNumberSchema,
    name: S.NonEmptyString,
    releaseColumn: S.optionalKey(S.Literals(["M", "N", "O"])),
    editionId: S.optionalKey(EditionIdSchema),
  }),
);
export type WorkbookRow = S.Schema.Type<typeof WorkbookRowsSchema>[number];

export function workbookLocator(row: { sheet: string; row: number }) {
  return JSON.stringify([row.sheet, row.row]);
}

// Untrusted maps and normalized rows reject personal cells and unknown fields at every depth.
export const decodeWorkbookMap = S.decodeUnknownSync(WorkbookMapSchema, { onExcessProperty: "error" });
