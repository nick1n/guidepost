import { Effect, Schema as S, Stream } from "effect";
import type { CollectionSnapshot } from "#lib/types/index.ts";

export class StoreError extends S.TaggedError<StoreError>()("StoreError", {
  operation: S.Literals(["load", "save", "clear"]),
  reason: S.Literals(["unavailable", "invalid-data", "stale"]),
  cause: S.Defect(),
}) {
  get message() {
    if (this.reason === "stale") return "Your collection changed in another tab. Refresh your collection before editing again.";
    if (this.reason === "invalid-data") return `Cannot ${this.operation} collection: stored data is invalid.`;
    return `Cannot ${this.operation} collection: browser storage is unavailable.`;
  }
}

export interface CollectionStore {
  /** Emits whether the loaded snapshot has become stale. Consuming it owns the subscription. */
  readonly changes?: Stream.Stream<boolean, StoreError>;
  load(): Effect.Effect<CollectionSnapshot, StoreError>;
  save(state: CollectionSnapshot): Effect.Effect<void, StoreError>;
  clear(): Effect.Effect<void, StoreError>;
}
