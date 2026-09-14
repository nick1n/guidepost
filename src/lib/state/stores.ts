import { Data, Effect, Schema as S } from "effect";
import { BrowserStorage, type StorageApi } from "./browser-storage";
import { type CollectionState, CollectionStateSchema } from "#lib/types/index.ts";

export class StoreError extends Data.TaggedError("StoreError")<{
  readonly operation: "load" | "save" | "clear";
  readonly reason: "unavailable" | "invalid-data" | "serialization";
  readonly cause: unknown;
}> {
  get message() {
    if (this.reason === "invalid-data") return `Cannot ${this.operation} collection: stored data is invalid.`;
    if (this.reason === "serialization") return "Cannot save collection: data could not be serialized to JSON.";
    return `Cannot ${this.operation} collection: browser storage is unavailable.`;
  }
}

const CollectionJson = S.fromJsonString(CollectionStateSchema);

export interface CollectionStore {
  load(): Effect.Effect<CollectionState, StoreError>;
  saveMany(states: CollectionState): Effect.Effect<void, StoreError>;
  clear(): Effect.Effect<void, StoreError>;
}

export class GuestStore implements CollectionStore {
  private readonly key: string;
  private state: CollectionState;

  private constructor(
    userId: string,
    private readonly storage: StorageApi,
  ) {
    this.key = `kdm-content-state:${userId}`;
    this.state = {};
  }

  static make(userId: string) {
    return Effect.map(BrowserStorage, (storage) => new GuestStore(userId, storage));
  }

  load() {
    const self = this;
    return Effect.gen(function* () {
      const stored = yield* self.storage
        .get(self.key)
        .pipe(Effect.mapError((cause) => new StoreError({ operation: "load", reason: "unavailable", cause })));
      const state =
        stored == null
          ? {}
          : yield* S.decodeUnknownEffect(CollectionJson)(stored).pipe(
              Effect.mapError((cause) => new StoreError({ operation: "load", reason: "invalid-data", cause })),
            );
      self.state = state;
      return state;
    });
  }

  saveMany(states: CollectionState) {
    const self = this;
    return Effect.gen(function* () {
      const next = { ...self.state, ...states };
      const json = yield* Effect.try({
        try: () => JSON.stringify(next),
        catch: (cause) => new StoreError({ operation: "save", reason: "serialization", cause }),
      });
      yield* self.storage
        .set(self.key, json)
        .pipe(Effect.mapError((cause) => new StoreError({ operation: "save", reason: "unavailable", cause })));
      self.state = next;
    });
  }

  clear() {
    const self = this;
    return Effect.gen(function* () {
      yield* self.storage
        .remove(self.key)
        .pipe(Effect.mapError((cause) => new StoreError({ operation: "clear", reason: "unavailable", cause })));
      self.state = {};
    });
  }
}
