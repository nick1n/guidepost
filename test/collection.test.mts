import { it, expect } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Layer } from "effect";
import { reportAction } from "../src/lib/state/collection-actions.ts";
import { Notifications } from "../src/lib/state/notifications.ts";
import { ContentState } from "../src/lib/state/collection.svelte.ts";
import { CollectionError } from "../src/lib/state/collection-errors.ts";
import { StoreError, type CollectionStore } from "../src/lib/state/stores.ts";
import type { CollectionState } from "../src/lib/types/index.ts";

function store(initial: CollectionState = {}) {
  let state = initial;
  let failLoad = false;
  let beforeLoad: (() => Effect.Effect<void>) | undefined;
  let waitForLoad: Effect.Effect<void> | undefined;
  const api: CollectionStore = {
    load: () =>
      Effect.gen(function* () {
        if (beforeLoad) yield* beforeLoad();
        if (waitForLoad) yield* waitForLoad;
        if (failLoad) return yield* Effect.fail(new StoreError({ operation: "load", reason: "invalid-data", cause: "bad JSON" }));
        return state;
      }),
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
    onLoadStarted: (effect: () => Effect.Effect<void>) => {
      beforeLoad = effect;
    },
    waitForLoad: (effect: Effect.Effect<void>) => {
      waitForLoad = effect;
    },
  };
}

// This checks the real scheduling boundary before synchronous persistence runs.
it.live("collection commands stay lazy and update optimistically with bound methods", () =>
  Effect.gen(function* () {
    const collection = new ContentState();
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
    const collection = new ContentState();
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
    const collection = new ContentState();
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

for (const operation of ["initialize", "refresh"] as const) {
  for (const fails of [false, true]) {
    it.effect(`superseded ${operation} ${fails ? "failure" : "success"} cancels without notifications`, () =>
      Effect.gen(function* () {
        const collection = new ContentState();
        const started = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const slow = store({ core: { owned: true } });
        if (operation === "refresh") yield* collection.setStore(slow.api);
        slow.onLoadStarted(() => Deferred.succeed(started, undefined));
        slow.waitForLoad(Deferred.await(release));
        slow.failLoad(fails);
        const messages: string[] = [];
        const notifications = Layer.succeed(Notifications, {
          success: (message) =>
            Effect.sync(() => {
              messages.push(message);
            }),
          error: (message) =>
            Effect.sync(() => {
              messages.push(message);
            }),
        });
        const action = operation === "initialize" ? collection.setStore(slow.api) : collection.refresh();
        const first = yield* Effect.forkChild(Effect.exit(reportAction(action).pipe(Effect.provide(notifications))));
        yield* Deferred.await(started);
        collection.setUser("new-user");
        const fast = store({ dice: { wishlisted: true } });
        yield* collection.setStore(fast.api);
        yield* Deferred.succeed(release, undefined);
        const result = yield* Fiber.join(first);

        expect(Exit.isFailure(result) && Cause.hasInterrupts(result.cause)).toBe(true);
        expect(messages).toEqual([]);
        expect(collection.state).toEqual(fast.state);
        expect(collection.loadStatus).toBe("ready");
        expect(collection.loadError).toBeUndefined();
      }),
    );
  }
}

it.effect("a newer initialization supersedes an older load for the same user", () =>
  Effect.gen(function* () {
    const collection = new ContentState();
    const started = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const slow = store({ core: { owned: true } });
    slow.onLoadStarted(() => Deferred.succeed(started, undefined));
    slow.waitForLoad(Deferred.await(release));
    const fast = store({ dice: { wishlisted: true } });

    const first = yield* Effect.forkChild(Effect.exit(collection.setStore(slow.api)));
    yield* Deferred.await(started);
    yield* collection.setStore(fast.api);
    yield* Deferred.succeed(release, undefined);
    const result = yield* Fiber.join(first);
    expect(Exit.isFailure(result) && Cause.hasInterrupts(result.cause)).toBe(true);

    expect(collection.state).toEqual(fast.state);
    expect(collection.loadStatus).toBe("ready");
    expect(collection.loadError).toBeUndefined();
  }),
);

it.effect("bulk unowning clears ownership details and preserves wishlist and unrelated entries", () =>
  Effect.gen(function* () {
    const collection = new ContentState();
    const owned = { owned: true, versions: ["1.6"], editions: ["first"], editionNumbers: { first: 42 } };
    const f = store({ core: { ...owned, wishlisted: true }, expansion: owned, dice: { owned: true } });
    yield* collection.setStore(f.api);
    yield* collection.setManyOwned(["core", "expansion"], false);
    expect(collection.get("core")).toEqual({
      owned: false,
      wishlisted: true,
      versions: undefined,
      editions: undefined,
      editionNumbers: undefined,
    });
    expect(collection.get("expansion")).toEqual({
      owned: false,
      versions: undefined,
      editions: undefined,
      editionNumbers: undefined,
    });
    expect(collection.get("dice")).toEqual({ owned: true });
    expect(f.state).toEqual(collection.state);
  }),
);
