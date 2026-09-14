import { Schema as S } from "effect";
import type * as Schema from "./gen/kdm-data";

export type ItemKind = "core" | "beta" | "promo" | "expansion" | "white-box" | "set";

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

export const EntryStateSchema = S.Struct({
  owned: S.optionalKey(S.Boolean),
  wishlisted: S.optionalKey(S.Boolean),
  versions: S.optionalKey(S.Array(S.String).pipe(S.mutable)),
  editions: S.optionalKey(S.Array(S.String).pipe(S.mutable)),
  editionNumbers: S.optionalKey(S.Record(S.String, S.Number)),
});

export type EntryState = S.Schema.Type<typeof EntryStateSchema>;

export const CollectionStateSchema = S.Record(S.String, EntryStateSchema);

export type CollectionState = S.Schema.Type<typeof CollectionStateSchema>;
