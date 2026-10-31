import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "@effect/vitest";
import { Effect, Fiber, Queue, Stream } from "effect";
import { DexieAppStore } from "#lib/app/preferences/dexie-preference-store.ts";
import { DexieStore } from "#lib/kdm/collection/state/dexie-store.ts";
import { DexieHuntStore } from "#lib/kdm/hunt/dexie-store.ts";
import { collectionKey } from "#lib/types/index.ts";
import { databaseFixture } from "../fixtures/database.ts";

const database = databaseFixture();
const core = collectionKey("core", "item");

it.effect.each(["app", "hunt", "collection"] as const)("shares one database when %s opens first", (first) =>
  Effect.gen(function* () {
    const { db, track } = database("guidepost");
    const app = track(new DexieAppStore());
    const hunt = track(new DexieHuntStore());
    const collection = track(yield* DexieStore.make());

    if (first === "app") yield* app.load();
    else if (first === "hunt") yield* hunt.load();
    else yield* collection.load();

    yield* Effect.all([app.load(), hunt.load(), collection.load()], { concurrency: "unbounded" });
    yield* Effect.all([app.save({ glass: false }), hunt.save({ option: "ccg" }), collection.save({ [core]: { owned: true } })], {
      concurrency: "unbounded",
    });
    yield* Effect.promise(() => db.open());
    expect(yield* Effect.promise(() => Dexie.getDatabaseNames())).toEqual(["guidepost"]);
    expect(db.tables.map((table) => table.name).sort()).toEqual(["entries", "metadata", "preferences"]);
    expect(yield* Effect.promise(() => db.entries.count())).toBe(1);
    expect(yield* Effect.promise(() => db.preferences.get("app"))).toMatchObject({ glass: false });
    expect(yield* Effect.promise(() => db.preferences.get("hunt"))).toMatchObject({ option: "ccg" });

    app.close();
    hunt.close();
    collection.close();
    expect(yield* collection.load()).toEqual({ [core]: { owned: true } });
    yield* collection.clear();
    expect(yield* collection.load()).toEqual({});
    expect(yield* app.load()).toMatchObject({ glass: false });
    expect(yield* hunt.load()).toMatchObject({ option: "ccg" });
  }),
);

// Dexie's observable uses real IndexedDB callbacks and timers.
it.live("keeps collection monitoring active when preference connections save and close", () =>
  Effect.gen(function* () {
    const { track } = database("guidepost");
    const app = track(new DexieAppStore());
    const hunt = track(new DexieHuntStore());
    const local = track(yield* DexieStore.make());
    const remote = track(yield* DexieStore.make());
    yield* local.load();
    const changes = yield* Queue.make<boolean>();
    const watcher = yield* Effect.forkChild(local.changes.pipe(Stream.runForEach((stale) => Queue.offer(changes, stale))));
    expect(yield* Queue.take(changes)).toBe(false);

    yield* app.save({ glass: false });
    yield* hunt.save({ option: "ccg" });
    app.close();
    hunt.close();
    yield* local.save({ [core]: { owned: true } });
    expect(yield* Queue.take(changes)).toBe(false);
    yield* remote.load();
    yield* remote.save({ [core]: { wished: true } });
    expect(yield* Queue.take(changes)).toBe(true);
    expect((yield* Effect.flip(local.save({}))).reason).toBe("stale");
    yield* Fiber.interrupt(watcher);
  }),
);
