import { it, expect } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer, Queue, Stream } from "effect";
import { Collection } from "#lib/state/collection.svelte.ts";
import { CollectionSession } from "#lib/state/collection-session.ts";
import { CollectionError } from "#lib/state/collection-errors.ts";
import { reportAction } from "#lib/state/collection-actions.ts";
import { Notifications } from "#lib/state/notifications.ts";
import { collectionKey } from "#lib/types/collection.ts";
import { StoreError, type CollectionStore } from "#lib/state/stores.ts";

const key = collectionKey("example", "first-run");

const fixture = Effect.fn("sessionFixture")(function* (
  finalize: Effect.Effect<void> = Effect.void,
  loading: Effect.Effect<void> = Effect.void,
) {
  const collection = new Collection();
  const started = yield* Queue.make<Queue.Queue<boolean, StoreError>>();
  const reported = yield* Queue.make<string>();
  const events: string[] = [];
  let failLoad = false;
  let loads = 0;
  const store: CollectionStore = {
    load: () =>
      loading.pipe(
        Effect.andThen(
          Effect.suspend(() => {
            loads++;
            return failLoad
              ? Effect.fail(new StoreError({ operation: "load", reason: "unavailable", cause: "Load failed" }))
              : Effect.succeed({ [key]: { owned: true } });
          }),
        ),
      ),
    save: () => Effect.void,
    clear: () => Effect.void,
    changes: Stream.unwrap(
      Effect.gen(function* () {
        const changes = yield* Queue.make<boolean, StoreError>();
        yield* Effect.acquireRelease(
          Effect.sync(() => events.push("subscribe")),
          () => finalize.pipe(Effect.andThen(Effect.sync(() => events.push("unsubscribe")))),
        );
        yield* Queue.offer(started, changes);
        return Stream.fromQueue(changes);
      }),
    ),
  };
  const session = new CollectionSession(collection, (ownerId) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        events.push("open:" + ownerId);
        return store;
      }),
      () => Effect.sync(() => events.push("close")),
    ),
  );
  const layer = Layer.succeed(Notifications, {
    success: (message) => Queue.offer(reported, message).pipe(Effect.asVoid),
    error: (message) => Queue.offer(reported, message).pipe(Effect.asVoid),
  });
  return {
    collection,
    session,
    started,
    reported,
    events,
    loads: () => loads,
    failLoad: (value: boolean) => {
      failLoad = value;
    },
    start: () =>
      reportAction(session.run("guest"), { success: false }).pipe(Effect.provide(layer), Effect.forkChild({ startImmediately: true })),
  };
});

it.effect("loads once, keeps healthy monitoring through refresh, and closes without startup announcements", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const active = yield* f.start();
    expect(f.collection.loadStatus).toBe("ready");
    expect(f.collection.state).toEqual({ [key]: { owned: true } });
    f.session.monitor(f.collection.canObserve);
    yield* Queue.take(f.started);
    yield* f.collection.refresh();
    f.session.monitor(f.collection.canObserve);
    yield* Effect.yieldNow;
    expect(f.loads()).toBe(2);
    expect(f.events).toEqual(["open:guest", "subscribe"]);
    expect(yield* Queue.size(f.started)).toBe(0);
    yield* Fiber.interrupt(active);
    expect(f.events).toEqual(["open:guest", "subscribe", "unsubscribe", "close"]);
    expect(yield* Queue.size(f.reported)).toBe(0);
  }),
);

it.effect("shutdown waits for subscription finalization before closing storage", () =>
  Effect.gen(function* () {
    const closing = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const f = yield* fixture(Deferred.succeed(closing, undefined).pipe(Effect.andThen(Deferred.await(release))));
    const active = yield* f.start();
    f.session.monitor(true);
    yield* Queue.take(f.started);
    const shutdown = yield* Effect.forkChild(Fiber.interrupt(active));
    yield* Deferred.await(closing);
    expect(f.events).not.toContain("close");
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(shutdown);
    expect(f.events.slice(-2)).toEqual(["unsubscribe", "close"]);
  }),
);

it.effect("a failed load keeps storage alive for retry and starts monitoring only after success", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    f.failLoad(true);
    const active = yield* f.start();
    yield* Queue.take(f.reported);
    f.session.monitor(f.collection.canObserve);
    expect(f.collection.hasStore).toBe(true);
    expect(f.collection.loadStatus).toBe("error");
    expect(f.events).toEqual(["open:guest"]);
    f.failLoad(false);
    yield* f.collection.refresh();
    f.session.monitor(f.collection.canObserve);
    yield* Queue.take(f.started);
    expect(f.collection.canWrite).toBe(true);
    yield* Fiber.interrupt(active);
    expect(f.events.slice(-2)).toEqual(["unsubscribe", "close"]);
  }),
);

it.effect("shutdown waits for an in-flight storage transaction before closing the opened store", () =>
  Effect.gen(function* () {
    const loading = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const transaction = Deferred.succeed(loading, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.uninterruptible);
    const f = yield* fixture(Effect.void, transaction);
    const active = yield* f.start();
    yield* Deferred.await(loading);
    const shutdown = yield* Effect.forkChild(Fiber.interrupt(active));
    yield* Effect.yieldNow;
    expect(f.events).toEqual(["open:guest"]);
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(shutdown);
    expect(f.events).toEqual(["open:guest", "close"]);
    expect(yield* Queue.size(f.reported)).toBe(0);
  }),
);

it.effect("a readiness restart waits for the preceding observer to finish unsubscribing", () =>
  Effect.gen(function* () {
    const stopping = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const f = yield* fixture(Deferred.succeed(stopping, undefined).pipe(Effect.andThen(Deferred.await(release))));
    const active = yield* f.start();
    f.session.monitor(true);
    yield* Queue.take(f.started);
    f.session.monitor(false);
    f.session.monitor(true);
    yield* Deferred.await(stopping);
    expect(yield* Queue.size(f.started)).toBe(0);
    yield* Deferred.succeed(release, undefined);
    yield* Queue.take(f.started);
    expect(f.events).toEqual(["open:guest", "subscribe", "unsubscribe", "subscribe"]);
    yield* Fiber.interrupt(active);
    expect(f.events.slice(-2)).toEqual(["unsubscribe", "close"]);
  }),
);

it.effect("observer failure preserves the snapshot and resubscribes only after a successful retry", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const active = yield* f.start();
    f.session.monitor(true);
    const changes = yield* Queue.take(f.started);
    yield* Queue.fail(changes, new StoreError({ operation: "load", reason: "unavailable", cause: "Monitor failed" }));
    yield* Queue.take(f.reported);
    f.session.monitor(f.collection.canObserve);
    expect(f.collection.canWrite).toBe(false);
    expect(f.collection.state).toEqual({ [key]: { owned: true } });
    f.failLoad(true);
    yield* Effect.exit(f.collection.refresh());
    f.session.monitor(f.collection.canObserve);
    expect(f.events.filter((event) => event === "subscribe")).toHaveLength(1);
    f.failLoad(false);
    yield* f.collection.refresh();
    f.session.monitor(f.collection.canObserve);
    yield* Queue.take(f.started);
    expect(f.events.filter((event) => event === "subscribe")).toHaveLength(2);
    expect(f.collection.loadError).toBeUndefined();
    yield* Fiber.interrupt(active);
  }),
);

it.effect("disposing during startup interrupts opening without attaching storage or reporting a failure", () =>
  Effect.gen(function* () {
    const collection = new Collection();
    const opening = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const messages: string[] = [];
    const session = new CollectionSession(collection, () =>
      Deferred.succeed(opening, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.andThen(Effect.die("Must not open"))),
    );
    const layer = Layer.succeed(Notifications, {
      success: (message) =>
        Effect.sync(() => {
          messages.push(message);
        }),
      error: (message) =>
        Effect.sync(() => {
          messages.push(message);
        }),
    });
    const active = yield* Effect.forkChild(reportAction(session.run("guest"), { success: false }).pipe(Effect.provide(layer)));
    yield* Deferred.await(opening);
    yield* Fiber.interrupt(active);
    yield* Deferred.succeed(release, undefined);
    expect(collection.hasStore).toBe(false);
    expect(collection.loadError).toBeUndefined();
    expect(messages).toEqual([]);
  }),
);

it.effect("a storage-module failure exposes the reload error without a retryable store", () =>
  Effect.gen(function* () {
    const collection = new Collection();
    const error = new CollectionError({ operation: "load", itemIds: [], message: "Reload the page.", cause: "Download failed" });
    const session = new CollectionSession(collection, () => Effect.fail(error));
    expect(yield* Effect.flip(session.run("guest"))).toBe(error);
    expect(collection.hasStore).toBe(false);
    expect(collection.loadStatus).toBe("error");
    expect(collection.loadError).toBe(error);
  }).pipe(Effect.provide(Notifications.layer)),
);
