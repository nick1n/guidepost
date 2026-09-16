import { Effect, Schema as S } from "effect";
import { BrowserStorage, type StorageApi } from "./browser-storage";
import { type CollectionState, CollectionStateSchema } from "#lib/types/index.ts";

export class StoreError extends S.TaggedError<StoreError>()("StoreError", {
  operation: S.Literals(["load", "save", "clear"]),
  reason: S.Literals(["unavailable", "invalid-data", "serialization"]),
  cause: S.Defect(),
}) {
  get message() {
    if (this.reason === "invalid-data") return `Cannot ${this.operation} collection: stored data is invalid.`;
    if (this.reason === "serialization") return "Cannot save collection: data could not be serialized to JSON.";
    return `Cannot ${this.operation} collection: browser storage is unavailable.`;
  }
}

const CollectionJson = S.fromJsonString(CollectionStateSchema);
const storeError = (operation: StoreError["operation"], reason: StoreError["reason"]) => (cause: unknown) =>
  new StoreError({ operation, reason, cause });

export interface CollectionStore {
  load(): Effect.Effect<CollectionState, StoreError>;
  save(state: CollectionState): Effect.Effect<void, StoreError>;
  clear(): Effect.Effect<void, StoreError>;
}

export class GuestStore implements CollectionStore {
  private readonly key: string;

  private constructor(
    userId: string,
    private readonly storage: StorageApi,
  ) {
    this.key = `kdm-content-state:${userId}`;
  }

  static make(userId: string) {
    return Effect.map(BrowserStorage, (storage) => new GuestStore(userId, storage));
  }

  load = Effect.fn("GuestStore.load")({ self: this }, function* () {
    const stored = yield* this.storage.get(this.key).pipe(Effect.mapError(storeError("load", "unavailable")));
    return stored == null
      ? {}
      : yield* S.decodeUnknownEffect(CollectionJson)(stored).pipe(Effect.mapError(storeError("load", "invalid-data")));
  });

  save = Effect.fn("GuestStore.save")({ self: this }, function* (state: CollectionState) {
    const json = yield* Effect.try({
      try: () => JSON.stringify(state),
      catch: storeError("save", "serialization"),
    });
    yield* this.storage.set(this.key, json).pipe(Effect.mapError(storeError("save", "unavailable")));
  });

  clear = Effect.fn("GuestStore.clear")({ self: this }, function* () {
    return yield* this.storage.remove(this.key).pipe(Effect.mapError(storeError("clear", "unavailable")));
  });
}
