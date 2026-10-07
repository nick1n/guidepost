import { Schema as S } from "effect";
import type * as Schema from "./gen/kdm-data";

export type Edition = Schema.Edition;
export type Item = Schema.Item;
export type Category = Exclude<keyof Schema.KingdomDeathCombinedReviewCatalog, "$schema">;
export type Catalog = Schema.KingdomDeathCombinedReviewCatalog;
export type Currency = NonNullable<Item["currency"]>;

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
