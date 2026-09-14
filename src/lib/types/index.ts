import type * as Schema from "./gen/kdm-data";

type Id = { id: string };

export type Edition = Schema.Edition;
export type Catalog = Schema.KingdomDeathCatalog;
export type ContentItem = Id & Schema.ContentItem;
export type DiceSet = Id & Schema.DiceItem;
export type Bundle = Id & Schema.BundleItem;
export type Currency = NonNullable<Schema.ContentItem["currency"]>;
export type ItemKind = Schema.ContentItem["kind"];

export type SortKey = "name" | "price-desc" | "price-asc";
export type GameplayFilter = "any" | "gameplay" | "models";
export type KindFilter = "any" | ItemKind;
export type StatusFilter = "any" | "owned" | "unowned" | "wishlisted";

export type Filters = {
  query: string;
  sort: SortKey;
  gameplay: GameplayFilter;
  kind: KindFilter;
  status: StatusFilter;
  tags: string[];
};

export type EntryState = {
  owned?: boolean;
  wishlisted?: boolean;
  versions?: string[];
  editions?: string[];
  editionNumbers?: Record<string, number>;
};

export type CollectionState = Record<string, EntryState>;
