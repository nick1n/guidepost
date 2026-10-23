import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, vi } from "vitest";
import { it, expect } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Queue } from "effect";
import { AppPreferences } from "#lib/app/preferences/preferences.svelte.ts";
import { DatePreferences } from "#lib/app/preferences/date-preferences.svelte.ts";
import { DexieAppStore } from "#lib/app/preferences/dexie-preference-store.ts";
import { PreferenceDatabase } from "#lib/app/preferences/preference-database.ts";
import { appDefaults, AppStorageError, type AppPreferenceStore, type AppValues } from "#lib/app/preferences/preference-store.ts";
import { DexieHuntStore } from "#lib/kdm/hunt/dexie-store.ts";
import { huntDefaults } from "#lib/kdm/hunt/preference-store.ts";

const connections: Array<{ close(): void }> = [];
const databases = new Set<string>();

afterEach(async () => {
  vi.restoreAllMocks();
  for (const connection of connections.splice(0)) connection.close();
  for (const name of databases) await Dexie.delete(name);
  databases.clear();
});

function fixture() {
  const name = `app-preferences-${crypto.randomUUID()}`;
  databases.add(name);
  const db = new PreferenceDatabase(name);
  const first = new DexieAppStore(name);
  const second = new DexieAppStore(name);
  connections.push(db, first, second);
  return { name, db, first, second };
}

it.effect("loads defaults without writing and persists both preferences independently of the hunt record", () =>
  Effect.gen(function* () {
    const f = fixture();
    const hunts = new DexieHuntStore(f.name);
    connections.push(hunts);
    yield* hunts.save({ option: "ccg" });
    expect(yield* f.first.load()).toEqual(appDefaults);
    yield* Effect.promise(() => f.db.open());
    expect(yield* Effect.promise(() => f.db.preferences.get("app"))).toBeUndefined();
    yield* f.first.save({ dateFormat: "written", glass: false });
    expect(yield* f.second.load()).toEqual({ dateFormat: "written", glass: false });
    expect(yield* hunts.load()).toEqual({ ...huntDefaults, option: "ccg" });
  }),
);

it.effect("merges unrelated writes across connections and persists the cleared glass override", () =>
  Effect.gen(function* () {
    const f = fixture();
    yield* f.first.load();
    yield* Effect.all([f.first.save({ dateFormat: "month-first" }), f.second.save({ glass: false })], { concurrency: "unbounded" });
    expect(yield* f.first.load()).toEqual({ dateFormat: "month-first", glass: false });
    yield* f.second.save({ glass: null });
    expect(yield* f.first.load()).toEqual({ dateFormat: "month-first", glass: null });
  }),
);

it.effect("rejects malformed IndexedDB data without overwriting it", () =>
  Effect.gen(function* () {
    const f = fixture();
    yield* Effect.promise(() => f.db.open());
    yield* Effect.promise(() => f.db.preferences.put({ dateFormat: "invalid", glass: false }, "app"));
    expect(Exit.isFailure(yield* Effect.exit(f.first.load()))).toBe(true);
    expect(Exit.isFailure(yield* Effect.exit(f.first.save({ glass: true })))).toBe(true);
    expect(yield* Effect.promise(() => f.db.preferences.get("app"))).toEqual({ dateFormat: "invalid", glass: false });
  }),
);

const memoryFixture = Effect.fn("appPreferencesFixture")(function* (
  load: Effect.Effect<AppValues, AppStorageError> = Effect.succeed(appDefaults),
) {
  const saved = yield* Queue.make<Partial<AppValues>>();
  const record = vi.fn();
  const close = vi.fn();
  const store: AppPreferenceStore = { load: () => load, save: (patch) => Queue.offer(saved, patch).pipe(Effect.asVoid), close };
  const preferences = new AppPreferences(record, Effect.succeed(store));
  return { preferences, saved, record, close, store, start: () => Effect.forkChild(preferences.run(), { startImmediately: true }) };
});

it.effect("preserves startup edits, serializes writes, and closes the session on interruption", () =>
  Effect.gen(function* () {
    const load = yield* Deferred.make<AppValues>();
    const release = yield* Deferred.make<void>();
    const started = yield* Queue.make<Partial<AppValues>>();
    const f = yield* memoryFixture(Deferred.await(load));
    f.store.save = (patch) => Queue.offer(started, patch).pipe(Effect.andThen(Deferred.await(release)));
    const dates = new DatePreferences(f.preferences);
    dates.setDateFormat("written");
    const active = yield* f.start();
    f.preferences.save({ glass: false });
    yield* Deferred.succeed(load, { dateFormat: "day-first", glass: true });
    expect(yield* Queue.take(started)).toEqual({ dateFormat: "written" });
    expect(f.preferences).toMatchObject({ dateFormat: "written", glass: false, ready: true });
    dates.setDateFormat("invalid");
    expect(dates.dateFormat).toBe("written");
    f.preferences.save({ glass: null });
    yield* Effect.yieldNow;
    expect(yield* Queue.size(started)).toBe(0);
    yield* Deferred.succeed(release, undefined);
    expect(yield* Queue.take(started)).toEqual({ glass: false });
    expect(yield* Queue.take(started)).toEqual({ glass: null });
    yield* Effect.yieldNow;
    expect(f.preferences.hasPendingChanges).toBe(false);
    yield* Fiber.interrupt(active);
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.record).not.toHaveBeenCalled();
  }),
);

it.effect("keeps date and glass choices after save failures and continues processing later edits", () =>
  Effect.gen(function* () {
    const f = yield* memoryFixture();
    const active = yield* f.start();
    f.store.save = () => Effect.fail(new AppStorageError({ operation: "save", cause: "Quota" }));
    new DatePreferences(f.preferences).setDateFormat("written");
    f.preferences.save({ glass: false });
    yield* Effect.yieldNow;
    expect(f.preferences).toMatchObject({ dateFormat: "written", glass: false });
    expect(f.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "error", message: expect.stringContaining("could not be saved") }),
    );
    f.store.save = (patch) => Queue.offer(f.saved, patch).pipe(Effect.asVoid);
    f.preferences.save({ glass: null });
    expect(yield* Queue.take(f.saved)).toEqual({ glass: null });
    yield* Fiber.interrupt(active);
  }),
);

it.effect("does not apply a superseded load or notify on mixed interruption causes", () =>
  Effect.gen(function* () {
    const load = yield* Deferred.make<AppValues>();
    const f = yield* memoryFixture(Deferred.await(load));
    const active = yield* f.start();
    f.preferences.save({ glass: false });
    yield* Fiber.interrupt(active);
    yield* Deferred.succeed(load, { dateFormat: "written", glass: true });
    expect(f.preferences).toMatchObject({ dateFormat: "iso", glass: false });
    expect(f.record).not.toHaveBeenCalled();
    const mixed = yield* memoryFixture(
      Effect.failCause(Cause.combine(Cause.fail(new AppStorageError({ operation: "load", cause: "Denied" })), Cause.interrupt(1))),
    );
    const result = yield* Fiber.await(yield* mixed.start());
    expect(Exit.isFailure(result) && Cause.hasInterrupts(result.cause)).toBe(true);
    expect(mixed.record).not.toHaveBeenCalled();
    expect(mixed.close).toHaveBeenCalledOnce();
  }),
);
