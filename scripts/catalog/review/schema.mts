import { Schema } from "effect";
import { ShopResponse } from "../shop-schema.mts";
import { categories } from "../types.mts";
import type { planUpdate } from "../update.mts";
import type { validateCatalog } from "../validate.mts";
import type { availabilityFromUrls } from "../availability.mts";
import type { Difference, Listing, resolutionDetails } from "./details.mts";

type Summary = Omit<ReturnType<typeof planUpdate>, "catalog" | "changes" | "sources" | "excluded" | "releaseGaps" | "unresolved"> & {
  excluded: number;
  unresolved: (ReturnType<typeof planUpdate>["unresolved"][number] & {
    listing?: Listing;
    resolution?: ReturnType<typeof resolutionDetails>;
  })[];
  changes: {
    category: (typeof categories)[number];
    itemId: string;
    after: import("../types.mts").Item;
    differences: Difference[];
    listings?: Listing[];
  }[];
};
type Common = Summary & {
  preparedAt: string;
  baselineHash: string;
  schemaHash: string;
  tagsHash: string;
  tagSchemaHash: string;
  mappingsHash: string;
  validation: Awaited<ReturnType<typeof validateCatalog>>;
};
export type Review = Common &
  (
    | {
        date: "monthly";
        newsHash: string;
        monthly: {
          posts: Record<string, string>;
          availability: Omit<ReturnType<typeof availabilityFromUrls>, "unmatched"> & { unmatched: number };
          importsHash: string | null;
          checkedAt: string;
        };
        requests?: never;
      }
    | { date: "tags-only"; newsHash?: never; monthly?: never }
  );

export const hash = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/));

export class CatalogInputError extends Schema.TaggedError<CatalogInputError>()("CatalogInputError", {
  message: Schema.String,
  cause: Schema.Defect(),
}) {}
const count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
const checkedAt = ShopResponse.fields.checkedAt;
const category = Schema.Literals(categories);
const array = <S extends Schema.Constraint>(schema: S) => Schema.mutable(Schema.Array(schema));
const strings = array(Schema.String);
// Item facts are validated against the captured catalog schema before publication.
// Preserve them here while checking the shape required to safely process a change.
const item = Schema.StructWithRest(Schema.Struct({ name: Schema.NonEmptyString, tags: strings }), [
  Schema.Record(Schema.String, Schema.Unknown),
]);
const reason = { handle: Schema.String, reason: Schema.String };
const difference = Schema.Struct({
  field: Schema.NonEmptyString,
  change: Schema.Literals(["added", "removed", "changed"]),
  before: Schema.optionalKey(Schema.Unknown),
  after: Schema.optionalKey(Schema.Unknown),
  added: Schema.optionalKey(strings),
  removed: Schema.optionalKey(strings),
});
const listing = Schema.Struct({
  url: Schema.String,
  checkedAt,
  confidence: Schema.optionalKey(Schema.String),
  product: Schema.Record(Schema.String, Schema.Unknown),
});
const resolution = Schema.Struct({
  mappingFile: Schema.String,
  catalogFile: Schema.String,
  instructions: strings,
  currentMapping: Schema.optionalKey(
    Schema.StructWithRest(Schema.Struct({ category, itemId: Schema.String }), [Schema.Record(Schema.String, Schema.Unknown)]),
  ),
  catalogItems: array(Schema.Struct({ category, itemId: Schema.String, item })),
});
const fields = {
  preparedAt: checkedAt,
  baselineHash: hash,
  schemaHash: hash,
  tagsHash: hash,
  tagSchemaHash: hash,
  mappingsHash: hash,
  changes: array(
    Schema.Struct({
      category,
      itemId: Schema.NonEmptyString,
      after: item,
      differences: array(difference),
      listings: Schema.optionalKey(array(listing)),
    }),
  ),
  unresolved: array(
    Schema.Struct({
      ...reason,
      candidates: Schema.optionalKey(strings),
      listing: Schema.optionalKey(listing),
      resolution: Schema.optionalKey(resolution),
    }),
  ),
  excluded: count,
  warnings: strings,
  validation: Schema.Struct({
    items: count,
    editions: count,
    importRows: count,
    schemas: Schema.Literal("passed"),
    references: Schema.Literal("passed"),
    cycles: Schema.Literal("none"),
  }),
};
const availability = Schema.Struct({
  checked: count,
  available: count,
  changed: count,
  shopChanged: count,
  tagsChanged: count,
  unmatched: count,
});
const review = Schema.Union([
  Schema.Struct({
    ...fields,
    date: Schema.Literal("monthly"),
    newsHash: hash,
    monthly: Schema.Struct({
      posts: Schema.Record(Schema.String, hash),
      availability,
      importsHash: Schema.NullOr(hash),
      checkedAt,
    }),
  }),
  Schema.Struct({ ...fields, date: Schema.Literal("tags-only") }),
]);
const decode = Schema.decodeUnknownSync(review, { onExcessProperty: "error" });

export function decodeReview(value: unknown): Review {
  try {
    return decode(value);
  } catch (cause) {
    throw new CatalogInputError({ message: "Invalid or outdated catalog review; rerun pnpm catalog:update or pnpm catalog:tags.", cause });
  }
}

export function parseReview(text: string): Review {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new CatalogInputError({ message: "Malformed catalog review JSON; rerun pnpm catalog:update or pnpm catalog:tags.", cause });
  }
  return decodeReview(value);
}
