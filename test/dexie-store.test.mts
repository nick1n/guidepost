import "fake-indexeddb/auto";
import { IDBObjectStore } from "fake-indexeddb";
import Dexie from "dexie";
import { afterEach, vi } from "vitest";
import { it, expect } from "@effect/vitest";
import { Deferred, Effect, Fiber, Queue, Stream } from "effect";
import { DexieStore } from "#lib/state/dexie-store.ts";
import { StoreError } from "#lib/state/stores.ts";
import catalogJson from "../static/kdm-catalog/data.json";
import { collectionKey, entryId, type Catalog } from "#lib/types/index.ts";

const data = catalogJson as Catalog;

const connections: Array<{ close(): void }> = [];
const databases = new Set<string>();

afterEach(async () => {
  vi.restoreAllMocks();
  for (const connection of connections.splice(0)) connection.close();
  for (const name of databases) await Dexie.delete(name);
  databases.clear();
});

function fixture() {
  const name = `collection-test-${crypto.randomUUID()}`;
  databases.add(name);
  const make = (ownerId = "guest") =>
    DexieStore.make(ownerId, { databaseName: name }).pipe(
      Effect.tap((store) =>
        Effect.sync(() => {
          connections.push(store);
        }),
      ),
    );
  const inspect = () => {
    const db = new Dexie(name);
    connections.push(db);
    return Effect.promise(async () => {
      await db.open();
      return db;
    });
  };
  return { make, inspect };
}

const coreEdition = data.content.core.editions?.find((edition) => edition.label === "1.6");
if (!coreEdition) throw new Error("Core 1.6 edition is missing from the catalog");
const core = collectionKey("core", coreEdition.id);
const resin = collectionKey("core", "test-resin-edition-id");

it.effect("writes only changed entries and removes only entries absent from the next snapshot", () =>
  Effect.gen(function* () {
    const f = fixture();
    const store = yield* f.make();
    yield* store.load();
    yield* store.save({ [core]: { owned: true }, [resin]: { wished: true } });
    const puts: unknown[] = [];
    const deletes: unknown[] = [];
    const originalPut = IDBObjectStore.prototype.put;
    const originalDelete = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "entries") puts.push(value);
      return originalPut.call(this, value, key);
    });
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (this: IDBObjectStore, key) {
      if (this.name === "entries") deletes.push(key);
      return originalDelete.call(this, key);
    });
    yield* store.save({ [core]: { owned: true }, [resin]: { wished: true } });
    expect(puts).toEqual([]);
    expect(deletes).toEqual([]);
    yield* store.save({ [core]: { owned: true }, [resin]: { wished: true, copyNumber: 15 } });
    expect(puts).toEqual([expect.objectContaining({ id: entryId("guest", resin), state: { wished: true, copyNumber: 15 } })]);
    expect(deletes).toEqual([]);
    puts.length = 0;
    yield* store.save({ [core]: { owned: true } });
    expect(puts).toEqual([]);
    expect(deletes).toEqual([entryId("guest", resin)]);
    expect(yield* store.load()).toEqual({ [core]: { owned: true } });
    const db = yield* f.inspect();
    expect(db.table("entries").schema.indexes.map((index) => index.name)).toEqual(["ownerId"]);
  }),
);

// Dexie's observable uses real IndexedDB callbacks and timers.
it.live("observes remote revisions while accepting local saves and isolating other owners", () =>
  Effect.gen(function* () {
    const f = fixture();
    const local = yield* f.make();
    const remote = yield* f.make();
    const account = yield* f.make("account");
    yield* local.load();
    yield* remote.load();
    yield* account.load();
    const changes = yield* Queue.make<boolean>();
    const watcher = yield* Effect.forkChild(local.changes.pipe(Stream.runForEach((stale) => Queue.offer(changes, stale))));
    expect(yield* Queue.take(changes)).toBe(false);
    yield* local.save({ [core]: { owned: true } });
    expect(yield* Queue.take(changes)).toBe(false);
    yield* account.save({ [core]: { wished: true } });
    yield* local.save({ [core]: { owned: true, copyNumber: 1 } });
    expect(yield* Queue.take(changes)).toBe(false);
    yield* remote.load();
    yield* remote.save({ [core]: { owned: true, copyNumber: 2 } });
    expect(yield* Queue.take(changes)).toBe(true);
    expect((yield* Effect.flip(local.save({}))).reason).toBe("stale");
    expect(yield* local.load()).toEqual({ [core]: { owned: true, copyNumber: 2 } });
    yield* local.save({ [core]: { owned: true, copyNumber: 3 } });
    expect(yield* Queue.take(changes)).toBe(false);
    yield* Fiber.interrupt(watcher);
  }),
);

it.effect("persists edition ownership, wishlist, and copy numbers across connections", () =>
  Effect.gen(function* () {
    const f = fixture();
    const first = yield* f.make();
    expect(yield* first.load()).toEqual({});
    const state = { [core]: { owned: true, wished: false, copyNumber: 5000 }, [resin]: { wished: true, copyNumber: 9999 } };
    const { save } = first;
    yield* save(state);
    first.close();
    const reopened = yield* f.make();
    expect(yield* reopened.load()).toEqual(state);
    yield* reopened.save({ [resin]: { owned: true } });
    expect(yield* reopened.load()).toEqual({ [resin]: { owned: true } });
    yield* reopened.clear();
    expect(yield* reopened.load()).toEqual({});
  }),
);

it.effect("keeps persisted ownership attached to an edition ID after its label changes", () =>
  Effect.gen(function* () {
    const f = fixture();
    const store = yield* f.make();
    const edition = { ...coreEdition };
    const key = collectionKey("core", edition.id);
    yield* store.load();
    yield* store.save({ [key]: { owned: true } });
    edition.label = "Second edition";
    const reopened = yield* f.make();
    expect(collectionKey("core", edition.id)).toBe(key);
    expect(yield* reopened.load()).toEqual({ [key]: { owned: true } });
  }),
);

it.effect("isolates owners and retains stable entry identities when selections change", () =>
  Effect.gen(function* () {
    const f = fixture();
    const guest = yield* f.make();
    const account = yield* f.make("account");
    yield* guest.load();
    yield* account.load();
    yield* guest.save({ [core]: { owned: true } });
    yield* account.save({ [core]: { wished: true } });
    const db = yield* f.inspect();
    const firstIds = yield* Effect.promise(() => db.table("entries").toCollection().primaryKeys());
    expect(firstIds.sort()).toEqual([entryId("guest", core), entryId("account", core)].sort());
    expect(yield* Effect.promise(() => db.table("entries").get(entryId("guest", core)))).toMatchObject({
      contentId: "core",
      editionId: coreEdition.id,
    });
    yield* guest.save({ [core]: { owned: false, copyNumber: 15 } });
    expect(yield* Effect.promise(() => db.table("entries").toCollection().primaryKeys())).toEqual(firstIds);
    yield* guest.clear();
    expect(yield* account.load()).toEqual({ [core]: { wished: true } });
  }),
);

it.effect("rejects stale saves and clears from another connection until a fresh load", () =>
  Effect.gen(function* () {
    const f = fixture();
    const first = yield* f.make();
    const second = yield* f.make();
    yield* first.load();
    yield* second.load();
    yield* first.save({ [core]: { owned: true } });
    for (const action of [second.save({ [resin]: { wished: true } }), second.clear()]) {
      const error = yield* Effect.flip(action);
      expect(error).toBeInstanceOf(StoreError);
      expect(error.reason).toBe("stale");
    }
    expect(yield* second.load()).toEqual({ [core]: { owned: true } });
    yield* second.save({ [core]: { owned: true }, [resin]: { wished: true } });
    expect(yield* first.load()).toEqual({ [core]: { owned: true }, [resin]: { wished: true } });
  }),
);

it.effect("initializes one metadata row when concurrent connections first load", () =>
  Effect.gen(function* () {
    const f = fixture();
    const first = yield* f.make();
    const second = yield* f.make();
    expect(yield* Effect.all([first.load(), second.load()], { concurrency: "unbounded" })).toEqual([{}, {}]);
    const db = yield* f.inspect();
    expect(yield* Effect.promise(() => db.table("metadata").toArray())).toEqual([
      expect.objectContaining({ ownerId: "guest", schemaVersion: 1, revision: expect.any(String) }),
    ]);
  }),
);

it.effect("preserves entries if metadata is missing when the store loads", () =>
  Effect.gen(function* () {
    const f = fixture();
    const first = yield* f.make();
    yield* first.load();
    yield* first.save({ [core]: { owned: false, copyNumber: 15 } });
    const db = yield* f.inspect();
    yield* Effect.promise(() => db.table("metadata").delete("guest"));
    const reopened = yield* f.make();
    expect(yield* reopened.load()).toEqual({ [core]: { owned: false, copyNumber: 15 } });
    expect(yield* Effect.promise(() => db.table("metadata").get("guest"))).toMatchObject({ ownerId: "guest", schemaVersion: 1 });
  }),
);

it.effect("aborts entry replacement and revision changes together when metadata writes fail", () =>
  Effect.gen(function* () {
    const f = fixture();
    const store = yield* f.make();
    yield* store.load();
    const state = { [core]: { owned: true } };
    yield* store.save(state);
    const db = yield* f.inspect();
    const before = yield* Effect.promise(() => db.table("metadata").get("guest"));
    const originalPut = IDBObjectStore.prototype.put;
    const failure = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "metadata") throw new Error("Simulated quota failure");
      return originalPut.call(this, value, key);
    });
    const error = yield* Effect.flip(store.save({ [resin]: { wished: true } }));
    failure.mockRestore();
    expect(error.reason).toBe("unavailable");
    expect(yield* Effect.promise(() => db.table("metadata").get("guest"))).toEqual(before);
    const reopened = yield* f.make();
    expect(yield* reopened.load()).toEqual(state);
    yield* store.save({ [core]: { owned: false } });
  }),
);

it.effect("fails invalid snapshots before replacing persisted entries", () =>
  Effect.gen(function* () {
    const f = fixture();
    const store = yield* f.make();
    yield* store.load();
    yield* store.save({ [core]: { owned: true } });
    const error = yield* Effect.flip(store.save({ "old-item-key": { owned: false } }));
    expect(error.reason).toBe("invalid-data");
    expect(yield* store.load()).toEqual({ [core]: { owned: true } });
  }),
);

it.effect("rejects invalid copy numbers before changing rows or revision", () =>
  Effect.gen(function* () {
    const f = fixture();
    const store = yield* f.make();
    yield* store.load();
    yield* store.save({ [core]: { owned: true, copyNumber: 42 } });
    const db = yield* f.inspect();
    const before = yield* Effect.promise(() => db.table("metadata").get("guest"));
    for (const invalid of ["42", 0, 1.5, 10000, Number.NaN]) {
      const entry = { owned: false, copyNumber: 42 };
      Object.assign(entry, { copyNumber: invalid });
      const error = yield* Effect.flip(store.save({ [core]: entry }));
      expect(error.reason).toBe("invalid-data");
    }
    expect(yield* Effect.promise(() => db.table("metadata").get("guest"))).toEqual(before);
    expect(yield* store.load()).toEqual({ [core]: { owned: true, copyNumber: 42 } });
    yield* store.save({ [core]: { owned: true } });
    expect(yield* store.load()).toEqual({ [core]: { owned: true } });
  }),
);

it.effect("rejects inconsistent persisted row identities", () =>
  Effect.gen(function* () {
    const f = fixture();
    const store = yield* f.make();
    yield* store.load();
    yield* store.save({ [core]: { owned: true } });
    const db = yield* f.inspect();
    yield* Effect.promise(() => db.table("entries").update(entryId("guest", core), { editionId: "wrong-edition" }));
    expect((yield* Effect.flip(store.save({ [core]: { owned: false } }))).reason).toBe("invalid-data");
    expect((yield* Effect.flip(store.load())).reason).toBe("invalid-data");
    expect((yield* Effect.flip(store.clear())).reason).toBe("stale");
  }),
);

it.effect("rejects unsupported metadata versions on read and write", () =>
  Effect.gen(function* () {
    const f = fixture();
    const store = yield* f.make();
    yield* store.load();
    const db = yield* f.inspect();
    yield* Effect.promise(() => db.table("metadata").update("guest", { schemaVersion: 2 }));
    expect((yield* Effect.flip(store.save({}))).reason).toBe("invalid-data");
    expect((yield* Effect.flip(store.load())).reason).toBe("invalid-data");
    expect((yield* Effect.flip(store.clear())).reason).toBe("stale");
  }),
);

it.effect("settles an interrupted write and publishes its revision before a later save", () =>
  Effect.gen(function* () {
    const f = fixture();
    const store = yield* f.make();
    yield* store.load();
    const started = yield* Deferred.make<void>();
    const originalPut = IDBObjectStore.prototype.put;
    const observe = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = originalPut.call(this, value, key);
      Effect.runSync(Deferred.succeed(started, undefined));
      return request;
    });
    const write = yield* Effect.forkChild(store.save({ [core]: { owned: true } }));
    yield* Deferred.await(started);
    yield* Fiber.interrupt(write);
    observe.mockRestore();
    const reopened = yield* f.make();
    expect(yield* reopened.load()).toEqual({ [core]: { owned: true } });
    yield* store.save({ [core]: { owned: true, copyNumber: 15 } });
    expect(yield* reopened.load()).toEqual({ [core]: { owned: true, copyNumber: 15 } });
  }),
);
