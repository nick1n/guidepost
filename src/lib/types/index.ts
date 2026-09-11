import type * as Schema from "./gen/kdm-data";

export type Edition = Schema.Edition;
export type Catalog = Schema.KingdomDeathCatalog;
export type ContentItem = Schema.ContentItem & { id: string };
export type DiceSet = Schema.DiceItem & { id: string };
export type Bundle = Schema.BundleItem & { id: string };
export type ItemKind = Schema.ContentItem["kind"];

export type SortKey = "name" | "price-desc" | "price-asc";
export type GameplayFilter = "any" | "gameplay" | "models";
export type KindFilter = "any" | "core" | "expansion" | "white-box" | "beta" | "promo" | "set";
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
