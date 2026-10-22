import { Schema } from "effect";
import { EntryStateSchema } from "./collection.ts";

const SheetSchema = Schema.Literals(["KDM Miniatures", "Shirt Catalog", "Dice Catalog"]);
const RowNumberSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(2));
const EditionIdSchema = Schema.String.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u));

export const WorkbookTargetSchema = Schema.Struct({
  category: Schema.Literals(["content", "accessories", "bundles", "included-only"]),
  contentId: Schema.NonEmptyString,
  editionId: EditionIdSchema,
  sourceEdition: Schema.optionalKey(Schema.NonEmptyString),
}).annotate({ identifier: "target" });
export interface WorkbookTarget extends Schema.Schema.Type<typeof WorkbookTargetSchema> {}

const AlternativesSchema = Schema.Array(WorkbookTargetSchema).check(
  Schema.isMinLength(1),
  Schema.makeFilter((targets) => new Set(targets.map((target) => JSON.stringify(target))).size === targets.length, {
    message: "Workbook alternatives must be unique.",
    toJsonSchema: () => ({ uniqueItems: true }),
  }),
);
const MapRowSchema = Schema.Struct({
  sheet: SheetSchema,
  row: RowNumberSchema,
  name: Schema.NonEmptyString,
  primary: WorkbookTargetSchema,
  related: Schema.optionalKey(AlternativesSchema),
  ownershipScope: Schema.optionalKey(Schema.Literal("source-row")),
  releaseEditions: Schema.optionalKey(
    Schema.Struct({
      M: Schema.optionalKey(AlternativesSchema),
      N: Schema.optionalKey(AlternativesSchema),
      O: Schema.optionalKey(AlternativesSchema),
    }).check(Schema.isMinProperties(1)),
  ),
}).check(
  Schema.makeFilter((row) => row.related === undefined || row.ownershipScope === "source-row", {
    message: "Related workbook targets require source-row ownership.",
    toJsonSchema: () => ({ if: { required: ["related"] }, then: { required: ["ownershipScope"] } }),
  }),
  Schema.makeFilter((row) => row.sheet === "KDM Miniatures" || row.primary.editionId === "item", {
    message: "Shirt and dice rows require the synthetic item edition.",
    toJsonSchema: () => ({
      if: { properties: { sheet: { enum: ["Shirt Catalog", "Dice Catalog"] } }, required: ["sheet"] },
      then: { properties: { primary: { properties: { editionId: { const: "item" } } } } },
    }),
  }),
);
export interface WorkbookMappingRow extends Schema.Schema.Type<typeof MapRowSchema> {}

export const WorkbookMapSchema = Schema.Struct({
  $schema: Schema.Literal("./workbook-map.schema.json"),
  formatVersion: Schema.Literal(1),
  source: Schema.Struct({ id: Schema.Literal("kdm-collection-sheets"), workbook: Schema.NonEmptyString }),
  rows: Schema.Array(MapRowSchema),
})
  .check(
    Schema.makeFilter((map) => new Set(map.rows.map(workbookLocator)).size === map.rows.length, {
      message: "Workbook mapping repeats a sheet and row locator.",
      // JSON Schema cannot express uniqueness by selected fields of array objects.
      toJsonSchema: () => [{}, true],
    }),
  )
  .annotate({
    title: "KDM workbook to catalog edition mapping",
    description: "Product references for one workbook snapshot. Sheet and row locate a source record; they are not permanent IDs.",
  });
export interface WorkbookMap extends Schema.Schema.Type<typeof WorkbookMapSchema> {}

export const WorkbookRowsSchema = Schema.Array(
  Schema.Struct({
    ...EntryStateSchema.fields,
    sheet: SheetSchema,
    row: RowNumberSchema,
    name: Schema.NonEmptyString,
    releaseColumn: Schema.optionalKey(Schema.Literals(["M", "N", "O"])),
    editionId: Schema.optionalKey(EditionIdSchema),
  }),
);
export type WorkbookRow = Schema.Schema.Type<typeof WorkbookRowsSchema>[number];

export function workbookLocator(row: { sheet: string; row: number }) {
  return JSON.stringify([row.sheet, row.row]);
}

// Untrusted maps and normalized rows reject personal cells and unknown fields at every depth.
export const decodeWorkbookMap = Schema.decodeUnknownSync(WorkbookMapSchema, { onExcessProperty: "error" });
