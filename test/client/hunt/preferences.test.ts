import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, vi } from "vitest";
import { it, expect } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Queue } from "effect";
import { HuntPreferences } from "#lib/kdm/hunt/preferences.svelte.ts";
import { DexieHuntStore } from "#lib/kdm/hunt/dexie-store.ts";
import { huntDefaults, HuntStorageError, type HuntPreferenceStore, type HuntValues } from "#lib/kdm/hunt/preference-store.ts";

const connections: Array<{ close(): void }> = [];
const databases = new Set<string>();

afterEach(async () => {
  vi.restoreAllMocks();
  for (const connection of connections.splice(0)) connection.close();
  for (const name of databases) await Dexie.delete(name);
  databases.clear();
});

function fixture() {
  const name = `hunt-test-${crypto.randomUUID()}`;
  databases.add(name);
  const make = () => {
    const store = new DexieHuntStore(name);
    connections.push(store);
    return store;
  };
  return { name, make };
}

it.effect("returns defaults on a fresh database and saves all settings across connections", () =>
  Effect.gen(function* () {
    const f = fixture();
    const first = f.make();
    expect(yield* first.load()).toEqual(huntDefaults);
    const values: HuntValues = { option: "ccg", bravadoBeta: true, devilSatan: true, gregalopeCE: true };
    yield* first.save(values);
    first.close();
    expect(yield* f.make().load()).toEqual(values);
  }),
);

it.effect("merges field patches from competing connections without losing unrelated settings", () =>
  Effect.gen(function* () {
    const f = fixture();
    const first = f.make();
    const second = f.make();
    yield* first.load();
    yield* second.load();
    yield* Effect.all([first.save({ option: "fen" }), second.save({ bravadoBeta: true })], { concurrency: "unbounded" });
    yield* first.save({ devilSatan: true, gregalopeCE: true });
    yield* second.save({ bravadoBeta: false });
    expect(yield* first.load()).toEqual({ option: "fen", bravadoBeta: false, devilSatan: true, gregalopeCE: true });
  }),
);

it.effect("reports invalid stored values without rewriting them", () =>
  Effect.gen(function* () {
    const f = fixture();
    const store = f.make();
    yield* store.load();
    const db = new Dexie(f.name);
    connections.push(db);
    yield* Effect.promise(() => db.open());
    const invalid = { ...huntDefaults, option: "unknown-set" };
    yield* Effect.promise(() => db.table("preferences").put(invalid, "hunt"));
    expect((yield* Effect.flip(store.load())).operation).toBe("load");
    expect((yield* Effect.flip(store.save({ devilSatan: true }))).operation).toBe("save");
    expect(yield* Effect.promise(() => db.table("preferences").get("hunt"))).toEqual(invalid);
  }),
);

const memoryFixture = Effect.fn("huntFixture")(function* (
  loading: Effect.Effect<HuntValues, HuntStorageError> = Effect.succeed(huntDefaults),
) {
  const saved = yield* Queue.make<Partial<HuntValues>>();
  const record = vi.fn();
  const close = vi.fn();
  const store: HuntPreferenceStore = {
    load: () => loading,
    save: (patch) => Queue.offer(saved, patch).pipe(Effect.asVoid),
    close,
  };
  const preferences = new HuntPreferences(record, Effect.succeed(store));
  return { preferences, saved, record, close, store, start: () => Effect.forkChild(preferences.run(), { startImmediately: true }) };
});

it.effect("loads saved choices, ignores invalid setters, and persists edits in order", () =>
  Effect.gen(function* () {
    const values: HuntValues = { option: "ccg", bravadoBeta: true, devilSatan: false, gregalopeCE: true };
    const f = yield* memoryFixture(Effect.succeed(values));
    const active = yield* f.start();
    expect(f.preferences).toMatchObject(values);
    f.preferences.setOption("invalid");
    expect(f.preferences.hasPendingChanges).toBe(false);
    f.preferences.setOption("fen");
    f.preferences.setBravadoBeta(false);
    f.preferences.setDevilSatan(true);
    f.preferences.setGregalopeCE(false);
    expect(f.preferences).toMatchObject({ option: "fen", bravadoBeta: false, devilSatan: true, gregalopeCE: false });
    expect(f.preferences.hasPendingChanges).toBe(true);
    expect(yield* Queue.take(f.saved)).toEqual({ option: "fen" });
    expect(yield* Queue.take(f.saved)).toEqual({ bravadoBeta: false });
    expect(yield* Queue.take(f.saved)).toEqual({ devilSatan: true });
    expect(yield* Queue.take(f.saved)).toEqual({ gregalopeCE: false });
    yield* Effect.yieldNow;
    expect(f.preferences.hasPendingChanges).toBe(false);
    yield* Fiber.interrupt(active);
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.record).not.toHaveBeenCalled();
  }),
);

it.effect("preserves edits made before and during a delayed load and serializes slow writes", () =>
  Effect.gen(function* () {
    const load = yield* Deferred.make<HuntValues>();
    const release = yield* Deferred.make<void>();
    const started = yield* Queue.make<Partial<HuntValues>>();
    const f = yield* memoryFixture(Deferred.await(load));
    f.store.save = (patch) => Queue.offer(started, patch).pipe(Effect.andThen(Deferred.await(release)));
    f.preferences.setOption("fen");
    const active = yield* f.start();
    f.preferences.setDevilSatan(true);
    yield* Deferred.succeed(load, { ...huntDefaults, option: "ccg", bravadoBeta: true } satisfies HuntValues);
    expect(yield* Queue.take(started)).toEqual({ option: "fen" });
    expect(f.preferences).toMatchObject({ option: "fen", bravadoBeta: true, devilSatan: true });
    f.preferences.setOption("kekasi");
    yield* Effect.yieldNow;
    expect(yield* Queue.size(started)).toBe(0);
    expect(f.preferences.option).toBe("kekasi");
    yield* Deferred.succeed(release, undefined);
    expect(yield* Queue.take(started)).toEqual({ devilSatan: true });
    expect(yield* Queue.take(started)).toEqual({ option: "kekasi" });
    yield* Effect.yieldNow;
    expect(f.preferences.hasPendingChanges).toBe(false);
    yield* Fiber.interrupt(active);
  }),
);

it.effect("keeps edits in memory after failures and continues saving subsequent changes", () =>
  Effect.gen(function* () {
    const error = new HuntStorageError({ operation: "save", cause: "quota" });
    const f = yield* memoryFixture(Effect.fail(new HuntStorageError({ operation: "load", cause: "unavailable" })));
    const active = yield* f.start();
    expect(f.preferences).toMatchObject(huntDefaults);
    expect(f.record).toHaveBeenCalledWith(expect.objectContaining({ message: "Hunt preferences could not be loaded on this device." }));
    f.store.save = () => Effect.fail(error);
    f.preferences.setOption("fen");
    yield* Effect.yieldNow;
    expect(f.preferences.option).toBe("fen");
    expect(f.preferences.hasPendingChanges).toBe(false);
    expect(f.record).toHaveBeenCalledWith(expect.objectContaining({ message: error.message }));
    f.store.save = (patch) => Queue.offer(f.saved, patch).pipe(Effect.asVoid);
    f.preferences.setBravadoBeta(true);
    expect(yield* Queue.take(f.saved)).toEqual({ bravadoBeta: true });
    yield* Fiber.interrupt(active);
  }),
);

it.effect("interrupts a delayed load without publishing its result or reporting a failure", () =>
  Effect.gen(function* () {
    const loading = yield* Deferred.make<HuntValues>();
    const f = yield* memoryFixture(Deferred.await(loading));
    const active = yield* f.start();
    f.preferences.setOption("fen");
    yield* Fiber.interrupt(active);
    yield* Deferred.succeed(loading, { ...huntDefaults, option: "ccg" } satisfies HuntValues);
    yield* Effect.yieldNow;
    expect(f.preferences.option).toBe("fen");
    expect(f.record).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
  }),
);

it.effect("preserves mixed interruption causes without a failure notification", () =>
  Effect.gen(function* () {
    const error = new HuntStorageError({ operation: "load", cause: "unavailable" });
    const f = yield* memoryFixture(Effect.failCause(Cause.combine(Cause.fail(error), Cause.interrupt(123))));
    const active = yield* f.start();
    const result = yield* Fiber.await(active);
    expect(Exit.isFailure(result) && Cause.hasInterrupts(result.cause)).toBe(true);
    expect(f.record).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
  }),
);

it.effect("reports a storage startup failure without leaving later edits waiting forever", () =>
  Effect.gen(function* () {
    const record = vi.fn();
    const preferences = new HuntPreferences(record, Effect.fail(new HuntStorageError({ operation: "load", cause: "Module unavailable" })));
    preferences.setBravadoBeta(true);
    yield* preferences.run();
    preferences.setOption("fen");
    yield* Effect.yieldNow;
    expect(preferences).toMatchObject({ option: "fen", bravadoBeta: true });
    expect(preferences.hasPendingChanges).toBe(false);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Hunt preference changed, but could not be saved on this device." }),
    );
  }),
);
