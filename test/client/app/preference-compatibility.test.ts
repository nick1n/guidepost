import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach } from "vitest";
import { expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { DexieAppStore } from "#lib/app/preferences/dexie-preference-store.ts";
import { PreferenceDatabase } from "#lib/app/preferences/preference-database.ts";
import { appDefaults, decodeAppRecord } from "#lib/app/preferences/preference-store.ts";
import { DexieHuntStore } from "#lib/kdm/hunt/dexie-store.ts";
import { decodeHuntRecord, huntDefaults } from "#lib/kdm/hunt/preference-store.ts";

const connections: Array<{ close(): void }> = [];
const databases = new Set<string>();
const nonRecords = [new Date(0), new Map([["glass", false]]), new Set(["fen"]), new Uint8Array([1, 2])];

afterEach(async () => {
  for (const connection of connections.splice(0)) connection.close();
  for (const name of databases) await Dexie.delete(name);
  databases.clear();
});

function fixture() {
  const name = `preference-compatibility-${crypto.randomUUID()}`;
  databases.add(name);
  const db = new PreferenceDatabase(name);
  const app = new DexieAppStore(name);
  const hunt = new DexieHuntStore(name);
  connections.push(db, app, hunt);
  return { db, app, hunt };
}

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
  for (const input of [{ dateFormat: undefined }, { dateFormat: "future" }, { glass: undefined }, { glass: "false" }]) {
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
