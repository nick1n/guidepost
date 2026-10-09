import type * as Schema from "./gen/kdm-data";

export type Edition = Schema.Edition;
export type Item = Schema.Item;
export type Category = Exclude<keyof Schema.KingdomDeathCombinedReviewCatalog, "$schema">;
export type Catalog = Schema.KingdomDeathCombinedReviewCatalog;
export type Currency = NonNullable<Item["currency"]>;

export * from "./collection";
