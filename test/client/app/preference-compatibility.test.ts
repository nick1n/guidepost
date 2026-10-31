import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, vi } from "vitest";
import { expect, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Result } from "effect";
import { Database } from "#lib/app/database.ts";
import { DexieAppStore } from "#lib/app/preferences/dexie-preference-store.ts";
import { appDefaults, decodeAppRecord, type AppStorageError } from "#lib/app/preferences/preference-store.ts";
import { DexieHuntStore } from "#lib/kdm/hunt/dexie-store.ts";
import { decodeHuntRecord, huntDefaults, type HuntStorageError } from "#lib/kdm/hunt/preference-store.ts";
import { databaseFixture } from "../fixtures/database.ts";

const database = databaseFixture();
afterEach(() => vi.restoreAllMocks());
const nonRecords = [new Date(0), new Map([["glass", false]]), new Set(["fen"]), new Uint8Array([1, 2])];
const stores = [
  { name: "app", Store: DexieAppStore, tag: "AppStorageError" },
  { name: "hunt", Store: DexieHuntStore, tag: "HuntStorageError" },
] as const;

function fixture() {
  const f = database();
  const app = f.track(new DexieAppStore(f.name));
  const hunt = f.track(new DexieHuntStore(f.name));
  return { ...f, app, hunt };
}

it.effect.each(stores)("defers $name reads and writes and retains bound methods", ({ name, Store }) =>
  Effect.gen(function* () {
    const f = database();
    const store = f.track(new Store(f.name));
    const open = vi.spyOn(Database.prototype, "open");
    const { load, save } = store;
    const loading = load();
    const saving = save({});
    expect(open).not.toHaveBeenCalled();
    yield* Effect.promise(() => f.db.open());
    expect(yield* Effect.promise(() => f.db.preferences.get(name))).toBeUndefined();
    yield* loading;
    expect(yield* Effect.promise(() => f.db.preferences.get(name))).toBeUndefined();
    yield* saving;
    expect(yield* Effect.promise(() => f.db.preferences.get(name))).toEqual(yield* load());
  }),
);

it.effect.each(stores)("maps $name open failures to feature errors and allows retry", ({ Store, tag }) =>
  Effect.gen(function* () {
    const f = database();
    const store = f.track(new Store(f.name));
    const failure = new Error("Storage unavailable");
    const open = vi.spyOn(Database.prototype, "open");
    for (const operation of ["load", "save"] as const) {
      open.mockRejectedValueOnce(failure);
      const action: Effect.Effect<unknown, AppStorageError | HuntStorageError> = operation === "load" ? store.load() : store.save({});
      expect(yield* Effect.flip(action)).toMatchObject({ _tag: tag, operation, cause: failure });
    }
    yield* store.save({});
    expect(yield* store.load()).toBeDefined();
  }),
);

it.effect.each(stores)("does not write $name preferences when interrupted during opening", ({ name, Store }) =>
  Effect.gen(function* () {
    const f = database();
    yield* Effect.promise(() => f.db.open());
    const started = yield* Deferred.make<void>();
    const opened = yield* Deferred.make<Database>();
    const store = f.track(new Store(f.name));
    vi.spyOn(Database.prototype, "open").mockImplementationOnce(() => {
      Effect.runSync(Deferred.succeed(started, undefined));
      return Dexie.Promise.resolve(Effect.runPromise(Deferred.await(opened)));
    });
    const saving = yield* Effect.forkChild(store.save({}));
    yield* Deferred.await(started);
    yield* Fiber.interrupt(saving);
    const exit = yield* Fiber.await(saving);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    yield* Deferred.succeed(opened, f.db);
    expect(yield* Effect.promise(() => f.db.preferences.get(name))).toBeUndefined();
  }),
);

it("defaults absent known fields while validating every present field", () => {
  expect(decodeAppRecord({})).toEqual(Result.succeed(appDefaults));
  expect(decodeAppRecord({ dateFormat: "written" })).toEqual(Result.succeed({ ...appDefaults, dateFormat: "written" }));
  expect(decodeAppRecord({ glass: false })).toEqual(Result.succeed({ ...appDefaults, glass: false }));
  expect(decodeHuntRecord({})).toEqual(Result.succeed(huntDefaults));
  for (const [key, value] of Object.entries(huntDefaults)) {
    expect(decodeHuntRecord({ [key]: value })).toEqual(Result.succeed(huntDefaults));
  }
  for (const input of [null, true, 1, "preferences", [], ["ccg"], ...nonRecords]) {
    expect(Result.isFailure(decodeAppRecord(input))).toBe(true);
    expect(Result.isFailure(decodeHuntRecord(input))).toBe(true);
  }
  for (const input of [
    { dateFormat: undefined },
    { dateFormat: "future" },
    { glass: undefined },
    { glass: "false" },
    { currency: "invalid" },
    { currency: undefined },
  ]) {
    expect(Result.isFailure(decodeAppRecord(input))).toBe(true);
  }
  for (const key of Object.keys(huntDefaults)) {
    for (const value of [undefined, null, 1, "invalid"]) {
      expect(Result.isFailure(decodeHuntRecord({ [key]: value }))).toBe(true);
    }
  }
});

it.effect("loads older records without rewriting and preserves future fields on partial saves", () =>
  Effect.gen(function* () {
    const { db, app, hunt } = fixture();
    const appRecord = { dateFormat: "day-first", future: { enabled: true } };
    const huntRecord = { option: "fen", future: ["new", "setting"] };
    yield* Effect.promise(() => db.open());
    yield* Effect.promise(() => db.preferences.put(appRecord, "app"));
    yield* Effect.promise(() => db.preferences.put(huntRecord, "hunt"));
    expect(yield* app.load()).toEqual({ ...appDefaults, ...appRecord });
    expect(yield* hunt.load()).toEqual({ ...huntDefaults, ...huntRecord });
    expect(yield* Effect.promise(() => db.preferences.get("app"))).toEqual(appRecord);
    expect(yield* Effect.promise(() => db.preferences.get("hunt"))).toEqual(huntRecord);
    yield* Effect.all([app.save({ glass: false }), hunt.save({ devilSatan: true })], { concurrency: "unbounded" });
    expect(yield* Effect.promise(() => db.preferences.get("app"))).toEqual({ ...appDefaults, ...appRecord, glass: false });
    expect(yield* Effect.promise(() => db.preferences.get("hunt"))).toEqual({ ...huntDefaults, ...huntRecord, devilSatan: true });
  }),
);

it.effect("rejects malformed present values with feature errors and leaves stored data untouched", () =>
  Effect.gen(function* () {
    const { db, app, hunt } = fixture();
    yield* Effect.promise(() => db.open());
    for (const malformed of [[], "invalid", { glass: undefined }, { dateFormat: "invalid" }, ...nonRecords]) {
      yield* Effect.promise(() => db.preferences.put(malformed, "app"));
      expect(yield* app.load().pipe(Effect.flip)).toMatchObject({ _tag: "AppStorageError", operation: "load" });
      expect(yield* app.save({ glass: true }).pipe(Effect.flip)).toMatchObject({ _tag: "AppStorageError", operation: "save" });
      expect(yield* Effect.promise(() => db.preferences.get("app"))).toEqual(malformed);
    }
    for (const malformed of [[], false, { option: undefined }, { bravadoBeta: "false" }, ...nonRecords]) {
      yield* Effect.promise(() => db.preferences.put(malformed, "hunt"));
      expect(yield* hunt.load().pipe(Effect.flip)).toMatchObject({ _tag: "HuntStorageError", operation: "load" });
      expect(yield* hunt.save({ option: "ccg" }).pipe(Effect.flip)).toMatchObject({ _tag: "HuntStorageError", operation: "save" });
      expect(yield* Effect.promise(() => db.preferences.get("hunt"))).toEqual(malformed);
    }
  }),
);
