import type * as Schema from "./gen/kdm-data";

export type Edition = Schema.Edition;
export type Item = Schema.Item;
export const catalogCategories = [
  "content",
  "bundles",
  "homebrew",
  "included-only",
  "accessories",
] as const satisfies readonly (keyof Schema.KingdomDeathCombinedReviewCatalog)[];
export type Category = (typeof catalogCategories)[number];
export type Catalog = Schema.KingdomDeathCombinedReviewCatalog;
export type Currency = NonNullable<Item["currency"]>;

export * from "./collection.ts";
