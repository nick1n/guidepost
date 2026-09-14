import { Data, Effect, Schema as S } from "effect";
import { type CollectionState, CollectionStateSchema } from "#lib/types/index.ts";

export class StoreError extends Data.TaggedError("StoreError")<{
  readonly operation: "load" | "save" | "clear";
  readonly reason: "unavailable" | "invalid-data";
  readonly cause: unknown;
}> {
  get message() {
    if (this.reason === "invalid-data") return `Cannot ${this.operation} collection: stored data is invalid.`;
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

  constructor(userId: string) {
    this.key = `kdm-content-state:${userId}`;
    this.state = {};
  }

  load() {
    const self = this;
    return Effect.gen(function* () {
      const stored = yield* Effect.try({
        try: () => (typeof localStorage === "undefined" ? null : localStorage.getItem(self.key)),
        catch: (cause) => new StoreError({ operation: "load", reason: "unavailable", cause }),
      });
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
      yield* Effect.try({
        try: () => self.write(next),
        catch: (cause) => new StoreError({ operation: "save", reason: "unavailable", cause }),
      });
      self.state = next;
    });
  }

  clear() {
    const self = this;
    return Effect.gen(function* () {
      yield* Effect.try({
        try: () => {
          localStorage.removeItem(self.key);
        },
        catch: (cause) => new StoreError({ operation: "clear", reason: "unavailable", cause }),
      });
      self.state = {};
    });
  }

  private write(state: CollectionState) {
    localStorage.setItem(this.key, JSON.stringify(state));
  }
}
