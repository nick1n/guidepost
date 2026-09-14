import { it, expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { collection } from "../src/lib/state/collection.svelte.ts";
import { CollectionError } from "../src/lib/state/collection-errors.ts";
import { StoreError, type CollectionStore } from "../src/lib/state/stores.ts";
import type { CollectionState } from "../src/lib/types/index.ts";

function store(initial: CollectionState = {}) {
  let state = initial;
  let failLoad = false;
  const api: CollectionStore = {
    load: () =>
      Effect.suspend(() =>
        failLoad ? Effect.fail(new StoreError({ operation: "load", reason: "invalid-data", cause: "bad JSON" })) : Effect.succeed(state),
      ),
    save: (next) =>
      Effect.sync(() => {
        state = next;
      }),
    clear: () =>
      Effect.sync(() => {
        state = {};
      }),
  };
  return {
    api,
    get state() {
      return state;
    },
    failLoad: (fail: boolean) => {
      failLoad = fail;
    },
  };
}

// This checks the real scheduling boundary before synchronous persistence runs.
it.live("collection commands stay lazy and update optimistically with bound methods", () =>
  Effect.gen(function* () {
    collection.setUser("lazy-test");
    const f = store();
    const { setStore, toggleOwned } = collection;
    const initialize = setStore(f.api);
    expect(collection.loadStatus).toBe("pending");
    yield* initialize;
    const action = toggleOwned("core", { version: "1.6" });
    expect(collection.get("core")).toEqual({});
    const fiber = yield* Effect.forkChild(action, { startImmediately: true });
    expect(collection.get("core")).toEqual({ owned: true, wishlisted: false, versions: ["1.6"] });
    expect(f.state).toEqual({});
    yield* Fiber.join(fiber);
    expect(f.state).toEqual(collection.state);
  }),
);

it.effect("migration saves the merged snapshot before clearing the source", () =>
  Effect.gen(function* () {
    collection.setUser("migration-test");
    const source = store({ core: { owned: true } });
    const destination = store({ dice: { wishlisted: true } });
    yield* collection.setStore(destination.api, source.api);
    expect(destination.state).toEqual({ core: { owned: true }, dice: { wishlisted: true } });
    expect(source.state).toEqual({});
    expect(collection.state).toEqual(destination.state);
  }),
);

it.effect("load failures stay typed and a retry clears the load error", () =>
  Effect.gen(function* () {
    collection.setUser("retry-test");
    const f = store({ core: { owned: true } });
    f.failLoad(true);
    const error = yield* Effect.flip(collection.setStore(f.api));
    expect(error).toBeInstanceOf(CollectionError);
    expect(collection.loadError).toBe(error);
    expect(collection.loadStatus).toBe("error");
    f.failLoad(false);
    yield* collection.refresh();
    expect(collection.loadError).toBeUndefined();
    expect(collection.loadStatus).toBe("ready");
    expect(collection.state).toEqual(f.state);
  }),
);
