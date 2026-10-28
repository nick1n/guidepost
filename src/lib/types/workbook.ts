import { Schema } from "effect";
import { EntryStateSchema } from "./collection.ts";

export const sheets = ["KDM Miniatures", "Shirt Catalog", "Dice Catalog"] as const;
export const releaseColumns = ["M", "N", "O"] as const;
export type WorkbookSheet = (typeof sheets)[number];

const SheetSchema = Schema.Literals(sheets);
const RowNumberSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(2));
const EditionIdSchema = Schema.String.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u));

const WorkbookTargetSchema = Schema.Struct({
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
export interface MappingRow extends Schema.Schema.Type<typeof MapRowSchema> {}

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

const ReleaseColumnSchema = Schema.Literals(releaseColumns);
export type ReleaseColumn = Schema.Schema.Type<typeof ReleaseColumnSchema>;

const MappedRowSchema = Schema.Struct({
  ...EntryStateSchema.fields,
  sheet: SheetSchema,
  row: RowNumberSchema,
  name: Schema.NonEmptyString,
  releaseColumn: Schema.optionalKey(ReleaseColumnSchema),
  editionId: Schema.optionalKey(EditionIdSchema),
});
export type MappedWorkbookRow = Schema.Schema.Type<typeof MappedRowSchema>;

const CollectionRowSchema = Schema.Struct({
  ...EntryStateSchema.fields,
  sheet: Schema.Literal("Guidepost collection"),
  row: RowNumberSchema,
  name: Schema.NonEmptyString,
  contentId: Schema.NonEmptyString,
  editionId: EditionIdSchema,
});
export type CollectionWorkbookRow = Schema.Schema.Type<typeof CollectionRowSchema>;
export const CollectionWorkbookRowsSchema = Schema.Array(CollectionRowSchema);

export const metadataColumn = "AZ";
export const templateMarker = "Guidepost workbook v3";
const TemplateEntrySchema = Schema.Struct({
  contentId: CollectionRowSchema.fields.contentId,
  editionId: EditionIdSchema,
  label: Schema.String,
  material: Schema.String,
  column: Schema.optionalKey(ReleaseColumnSchema),
  state: EntryStateSchema,
});
export type TemplateEntry = Schema.Schema.Type<typeof TemplateEntrySchema>;
export const MetadataSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  entries: Schema.Array(TemplateEntrySchema),
  baseline: Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null])),
});
export type Metadata = Schema.Schema.Type<typeof MetadataSchema>;

export const WorkbookRowsSchema = Schema.Array(Schema.Union([MappedRowSchema, CollectionRowSchema]));
export type WorkbookRow = Schema.Schema.Type<typeof WorkbookRowsSchema>[number];

export function workbookLocator(row: { sheet: string; row: number }) {
  return JSON.stringify([row.sheet, row.row]);
}

// Untrusted maps and normalized rows reject personal cells and unknown fields at every depth.
export const decodeWorkbookMap = Schema.decodeUnknownSync(WorkbookMapSchema, { onExcessProperty: "error" });
