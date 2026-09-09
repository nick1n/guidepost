import { Effect, Schema } from "effect";
import type { CollectionState, EntryState } from "#lib/types/index.ts";

export type ContentStateStoreError = {
  readonly _tag: "ContentStateStoreError";
  readonly operation: "load" | "save" | "clear";
  readonly reason: "unavailable" | "invalid-data";
  readonly cause: unknown;
};

function storeError(
  operation: ContentStateStoreError["operation"],
  reason: ContentStateStoreError["reason"],
  cause: unknown,
): ContentStateStoreError {
  return { _tag: "ContentStateStoreError", operation, reason, cause };
}

const EntryStateSchema = Schema.Struct({
  owned: Schema.optionalKey(Schema.Boolean),
  wishlisted: Schema.optionalKey(Schema.Boolean),
  versions: Schema.optionalKey(Schema.Array(Schema.String).pipe(Schema.mutable)),
  editions: Schema.optionalKey(Schema.Array(Schema.String).pipe(Schema.mutable)),
  editionNumbers: Schema.optionalKey(Schema.Record(Schema.String, Schema.Number)),
});

const CollectionStateSchema = Schema.Record(Schema.String, EntryStateSchema);

export interface ContentStateStore {
  load(): Effect.Effect<CollectionState, ContentStateStoreError>;
  save(itemId: string, state: EntryState): Effect.Effect<void, ContentStateStoreError>;
  saveMany(states: CollectionState): Effect.Effect<void, ContentStateStoreError>;
  clear(): Effect.Effect<void, ContentStateStoreError>;
}

export class LocalGuestStore implements ContentStateStore {
  private readonly key: string;
  private state: CollectionState;

  constructor(userId: string) {
    this.key = `kdm-content-state:${userId}`;
    this.state = {};
  }

  load() {
    return Effect.suspend(() => {
      if (typeof localStorage === "undefined") return Effect.succeed({});

      return Effect.try({
        try: () => localStorage.getItem(this.key),
        catch: (cause) => storeError("load", "unavailable", cause),
      }).pipe(
        Effect.flatMap((stored) => {
          if (stored === null) return Effect.succeed({});
          return Effect.try({
            try: () => JSON.parse(stored) as unknown,
            catch: (cause) => storeError("load", "invalid-data", cause),
          });
        }),
        Effect.flatMap((value) =>
          Schema.decodeUnknownEffect(CollectionStateSchema)(value).pipe(
            Effect.mapError((cause) => storeError("load", "invalid-data", cause)),
          ),
        ),
        Effect.tap((state) =>
          Effect.sync(() => {
            this.state = state;
          }),
        ),
      );
    });
  }

  save(itemId: string, state: EntryState) {
    return this.saveMany({ [itemId]: state });
  }

  saveMany(states: CollectionState) {
    return Effect.suspend(() => {
      const next = { ...this.state, ...states };
      return Effect.try({
        try: () => this.write(next),
        catch: (cause) => storeError("save", "unavailable", cause),
      }).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            this.state = next;
          }),
        ),
      );
    });
  }

  clear() {
    return Effect.try({
      try: () => {
        if (typeof localStorage !== "undefined") localStorage.removeItem(this.key);
      },
      catch: (cause) => storeError("clear", "unavailable", cause),
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          this.state = {};
        }),
      ),
    );
  }

  private write(state: CollectionState) {
    if (typeof localStorage !== "undefined") localStorage.setItem(this.key, JSON.stringify(state));
  }
}
