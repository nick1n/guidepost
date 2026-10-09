import { it, expect } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Queue, Stream } from "effect";
import { reportAction } from "#lib/state/collection-actions.ts";
import { Notifications } from "#lib/state/notifications.ts";
import { Collection } from "#lib/state/collection.svelte.ts";
import { CollectionError } from "#lib/state/collection-errors.ts";
import { StoreError, type CollectionStore } from "#lib/state/stores.ts";
import { collectionKey, type Catalog, type CollectionSnapshot } from "#lib/types/index.ts";
import catalogJson from "../static/kdm-catalog/data.json";
import workbookMap from "../static/kdm-catalog/workbook-map.json";

const data = catalogJson as Catalog;
const core = collectionKey("core", "1.6");
const expansion = collectionKey("dragon-king", "1.6");
const dice = collectionKey("dice", "1.6");

function bundleCatalog(): Catalog {
  return {
    content: {
      model: {
        name: "Model",
        tags: [],
        editions: [
          { id: "plastic", label: "Plastic", format: "physical", standalone: false, prices: [0] },
          { id: "resin", label: "Resin", format: "physical", prices: [1250] },
        ],
      },
    },
    bundles: {
      set: { name: "Set", tags: [], price: 2000, includes: [{ item: "model", editionId: "plastic" }] },
    },
    accessories: {},
    homebrew: {},
    "included-only": {},
  };
}

function store(initial: CollectionSnapshot = {}) {
  let state = initial;
  let failLoad = false;
  let failSave: StoreError["reason"] | undefined;
  let writes = 0;
  let beforeLoad: (() => Effect.Effect<void>) | undefined;
  let waitForLoad: Effect.Effect<void> | undefined;
  let beforeSave: (() => Effect.Effect<void>) | undefined;
  let waitForSave: Effect.Effect<void> | undefined;
  const api: CollectionStore = {
    load: () =>
      Effect.gen(function* () {
        if (beforeLoad) yield* beforeLoad();
        if (waitForLoad) yield* waitForLoad;
        if (failLoad) return yield* Effect.fail(new StoreError({ operation: "load", reason: "invalid-data", cause: "bad JSON" }));
        return state;
      }),
    save: (next) =>
      Effect.gen(function* () {
        writes += 1;
        if (beforeSave) yield* beforeSave();
        if (waitForSave) yield* waitForSave;
        if (failSave) {
          const reason = failSave;
          failSave = undefined;
          return yield* Effect.fail(new StoreError({ operation: "save", reason, cause: "Simulated save failure" }));
        }
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
    failNextSave: (reason: StoreError["reason"]) => {
      failSave = reason;
    },
    replaceState: (next: CollectionSnapshot) => {
      state = next;
    },
    get writes() {
      return writes;
    },
    onLoadStarted: (effect: () => Effect.Effect<void>) => {
      beforeLoad = effect;
    },
    waitForLoad: (effect: Effect.Effect<void>) => {
      waitForLoad = effect;
    },
    onSaveStarted: (effect: () => Effect.Effect<void>) => {
      beforeSave = effect;
    },
    waitForSave: (effect: Effect.Effect<void>) => {
      waitForSave = effect;
    },
  };
}

it.effect("backup replacement validates first, saves once, and rolls back on failure", () =>
  Effect.gen(function* () {
    const collection = new Collection(bundleCatalog());
    const plastic = collectionKey("model", "plastic");
    const resin = collectionKey("model", "resin");
    const initial = { [plastic]: { owned: true, copyNumber: 5000 } };
    const f = store(initial);
    yield* collection.setStore(f.api);
    const json = yield* collection.exportBackup();
    expect(JSON.parse(json).entries).toEqual(initial);
    yield* Effect.flip(collection.restoreBackup("{}"));
    expect(f.writes).toBe(0);
    const replacement = { [resin]: { wished: true, copyNumber: 9999 } };
    const backup = JSON.stringify({ formatVersion: 1, entries: replacement });
    f.failNextSave("unavailable");
    yield* Effect.flip(collection.restoreBackup(backup));
    expect(collection.state).toEqual(initial);
    expect(collection.isSaving).toBe(false);
    yield* collection.restoreBackup(backup);
    expect(collection.state).toEqual(replacement);
    expect(f.state).toEqual(replacement);
    expect(f.writes).toBe(2);
    expect(collection.saveError).toBeUndefined();
  }),
);

it.effect("workbook preview is read-only and a validated import merges one batch", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const unrelated = collectionKey("core", "unrelated-fixture");
    const f = store({ [unrelated]: { owned: true } });
    yield* collection.setStore(f.api);
    const mapped = workbookMap.rows[0];
    const rows = [{ sheet: mapped.sheet, row: mapped.row, name: mapped.name, wished: true, copyNumber: 5000 }];
    const preview = yield* collection.previewWorkbook(rows);
    expect(f.writes).toBe(0);
    expect(collection.state).toEqual({ [unrelated]: { owned: true } });
    yield* Effect.flip(collection.importWorkbook([...rows, { ...rows[0], name: "Wrong name", row: -1 }]));
    expect(f.writes).toBe(0);
    yield* collection.importWorkbook(rows);
    expect(collection.state).toEqual({ [unrelated]: { owned: true }, ...preview });
    expect(f.writes).toBe(1);
  }),
);

it.effect("collection instances stay isolated and copy numbers use both physical limits", () =>
  Effect.gen(function* () {
    const catalog = bundleCatalog();
    catalog.content.model.editions![0].runSize = 5000;
    const first = new Collection(catalog);
    const second = new Collection(catalog);
    const f = store();
    yield* first.setStore(f.api);
    yield* second.setStore(store().api);
    const key = collectionKey("model", "plastic");
    yield* first.setCopyNumber(key, 5000);
    expect(first.get(key).copyNumber).toBe(5000);
    expect(second.state).toEqual({});
    for (const value of [5001, 10000, NaN, 1.5]) yield* Effect.flip(first.setCopyNumber(key, value));
    expect(f.writes).toBe(1);
    yield* first.setCopyNumber(key, undefined);
    expect(first.get(key)).toEqual({});
    expect(first.pendingSaves).toBe(0);
  }),
);

it.effect("switching catalogs refreshes the index without changing snapshots or queued saves", () =>
  Effect.gen(function* () {
    const collection = new Collection();
    const core = collectionKey("core", "1-6");
    const initial = { [core]: { owned: false }, [expansion]: { wished: true } };
    const f = store(initial);
    const saveStarted = yield* Deferred.make<void>();
    const releaseSave = yield* Deferred.make<void>();
    f.onSaveStarted(() => Deferred.succeed(saveStarted, undefined));
    f.waitForSave(Deferred.await(releaseSave));
    yield* collection.setStore(f.api);

    expect(collection.catalog.entries).toEqual([]);
    const ownership = yield* Effect.forkChild(collection.setManyOwned([core], true), { startImmediately: true });
    yield* Deferred.await(saveStarted);
    const wishlist = yield* Effect.forkChild(collection.toggleWish(dice), { startImmediately: true });
    expect(collection.pendingSaves).toBe(2);
    const optimisticSnapshot = collection.state;
    expect(f.state).toEqual(initial);

    collection.setCatalog(data);

    expect(collection.catalog.byId.has("white-lion")).toBe(true);
    expect(collection.state).toBe(optimisticSnapshot);
    expect(collection.ownedCount).toBe(1);
    expect(collection.pendingSaves).toBe(2);
    expect(f.writes).toBe(1);
    yield* Deferred.succeed(releaseSave, undefined);
    yield* Fiber.join(ownership);
    yield* Fiber.join(wishlist);

    expect(collection.state).toEqual({
      [core]: { owned: true, wished: false },
      [expansion]: { wished: true },
      [dice]: { wished: true },
    });
    expect(f.state).toEqual(collection.state);
    expect(f.writes).toBe(2);
  }),
);

it.effect("workbook ownership uses bundle commands and cannot wish an owned edition", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const source = workbookMap.rows.find(
      (row) =>
        row.primary.category === "bundles" && collection.catalog.includedEditions(row.primary.contentId, row.primary.editionId).length,
    )!;
    const child = collection.catalog.includedEditions(source.primary.contentId, source.primary.editionId)[0];
    const childKey = collectionKey(child.item.id, child.edition.id);
    const f = store({ [childKey]: { wished: true } });
    yield* collection.setStore(f.api);
    const row = { sheet: source.sheet, row: source.row, name: source.name, owned: true };
    const preview = yield* collection.previewWorkbook([row]);
    expect(preview[childKey]).toEqual({ owned: true, wished: false });
    expect(f.writes).toBe(0);
    yield* collection.importWorkbook([row]);
    expect(collection.get(childKey)).toEqual({ owned: true, wished: false });
    expect(f.writes).toBe(1);
    yield* collection.importWorkbook([{ sheet: source.sheet, row: source.row, name: source.name, wished: true }]);
    expect(collection.getEdition(source.primary.contentId, source.primary.editionId).wished).toBe(false);
  }),
);

it.effect("bundle commands save one batch and expose collection totals and edition-specific coverage", () =>
  Effect.gen(function* () {
    const collection = new Collection(bundleCatalog());
    const plastic = collectionKey("model", "plastic");
    const resin = collectionKey("model", "resin");
    const f = store({ [plastic]: { wished: true, copyNumber: 9 }, [resin]: { wished: true } });
    yield* collection.setStore(f.api);
    const item = collection.catalog.byId.get("set");
    const edition = item?.editions?.[0];
    if (!item || !edition) throw new Error("Missing bundle fixture");
    const { setEditionsOwned } = collection;
    const save = setEditionsOwned(
      [
        { item, edition },
        { item, edition },
      ],
      true,
    );
    expect(f.writes).toBe(0);
    expect(collection.wishlistCount).toBe(2);
    yield* save;
    expect(f.writes).toBe(1);
    expect(Object.keys(f.state)).toHaveLength(3);
    expect(collection.getEdition("model", "plastic")).toEqual({ owned: true, wished: false, copyNumber: 9 });
    expect(collection.ownedCount).toBe(1);
    expect(collection.wishlistCount).toBe(1);
    expect(collection.totals).toEqual({ USD: 2000 });
    expect(collection.getOwners("model", "plastic")).toEqual([
      { parentId: "set", parentEditionId: "bundle", parent: "Set", parentEdition: "Bundle", editionId: "plastic" },
    ]);
    expect(collection.getOwners("model", "resin")).toEqual([]);
    yield* collection.reset();
    expect(collection.ownedCount).toBe(0);
    expect(collection.wishlistCount).toBe(0);
    expect(collection.totals).toEqual({});
    expect(collection.getOwners("model", "plastic")).toEqual([]);
  }),
);

it.effect("failed bundle saves restore selections, totals, and coverage together", () =>
  Effect.gen(function* () {
    const collection = new Collection(bundleCatalog());
    const initial = { [collectionKey("model", "plastic")]: { wished: true, copyNumber: 9 } };
    const f = store(initial);
    yield* collection.setStore(f.api);
    const item = collection.catalog.byId.get("set");
    const edition = item?.editions?.[0];
    if (!item || !edition) throw new Error("Missing bundle fixture");
    f.failNextSave("unavailable");
    yield* Effect.flip(collection.setEditionsOwned([{ item, edition }], true));
    expect(collection.state).toEqual(initial);
    expect(f.state).toEqual(initial);
    expect(f.writes).toBe(1);
    expect(collection.ownedCount).toBe(0);
    expect(collection.wishlistCount).toBe(1);
    expect(collection.totals).toEqual({});
    expect(collection.getOwners("model", "plastic")).toEqual([]);
  }),
);

// This checks the real scheduling boundary before synchronous persistence runs.
it.live("collection commands stay lazy and update optimistically with bound methods", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    collection.setUser("lazy-test");
    const f = store();
    const { setStore, toggleOwned } = collection;
    const initialize = setStore(f.api);
    expect(collection.loadStatus).toBe("pending");
    yield* initialize;
    const action = toggleOwned(core);
    expect(collection.get(core)).toEqual({});
    const fiber = yield* Effect.forkChild(action, { startImmediately: true });
    expect(collection.get(core)).toEqual({ owned: true, wished: false });
    expect(f.state).toEqual({});
    yield* Fiber.join(fiber);
    expect(f.state).toEqual(collection.state);
  }),
);

it.effect("initializing loads a store without writing or migrating snapshots", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const f = store({ [core]: { owned: true }, [dice]: { wished: true } });
    yield* collection.setStore(f.api);
    expect(collection.state).toEqual(f.state);
    expect(f.writes).toBe(0);
  }),
);

it.effect("load failures stay typed and a retry clears the load error", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    collection.setUser("retry-test");
    const f = store({ [core]: { owned: true } });
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
        const collection = new Collection(data);
        const started = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const slow = store({ [core]: { owned: true } });
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
        const fast = store({ [dice]: { wished: true } });
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
    const collection = new Collection(data);
    const started = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const slow = store({ [core]: { owned: true } });
    slow.onLoadStarted(() => Deferred.succeed(started, undefined));
    slow.waitForLoad(Deferred.await(release));
    const fast = store({ [dice]: { wished: true } });

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

it.effect("bulk ownership writes dedupe keys, clear wishes when owning, and preserve details when unowning", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const f = store({
      [core]: { owned: true, wished: true, copyNumber: 11 },
      [expansion]: { owned: true, copyNumber: 22 },
      [dice]: { owned: true },
    });
    yield* collection.setStore(f.api);
    yield* collection.setManyOwned([core, expansion, core], false);
    expect(f.writes).toBe(1);
    expect(collection.get(core)).toEqual({ owned: false, wished: true, copyNumber: 11 });
    expect(collection.get(expansion)).toEqual({ owned: false, copyNumber: 22 });
    yield* collection.setManyOwned([core, expansion, core], true);
    expect(f.writes).toBe(2);
    expect(collection.get(core)).toEqual({ owned: true, wished: false, copyNumber: 11 });
    expect(collection.get(expansion)).toEqual({ owned: true, copyNumber: 22, wished: false });
    expect(collection.get(dice)).toEqual({ owned: true });
    expect(f.state).toEqual(collection.state);
  }),
);

it.effect("a failed save records the error and rolls back only its patch", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const initial = { [core]: { owned: false, copyNumber: 7 }, [dice]: { wished: true } };
    const f = store(initial);
    yield* collection.setStore(f.api);
    f.failNextSave("unavailable");

    const error = yield* Effect.flip(collection.toggleOwned(core));
    expect(error).toBeInstanceOf(CollectionError);
    expect(collection.saveError).toBe(error);
    expect(collection.canWrite).toBe(true);
    expect(collection.state).toEqual(initial);
    expect(f.state).toEqual(collection.state);
  }),
);

it.effect("a stale save blocks edits until refresh succeeds", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const initial = { [core]: { owned: false, copyNumber: 13 } };
    const f = store(initial);
    yield* collection.setStore(f.api);
    f.failNextSave("stale");

    const stale = yield* Effect.flip(collection.toggleOwned(core));
    expect(stale).toBeInstanceOf(CollectionError);
    expect(collection.saveError).toBe(stale);
    expect(collection.needsRefresh).toBe(true);
    expect(collection.canWrite).toBe(false);
    expect(collection.state).toEqual(initial);

    const guarded = yield* Effect.flip(collection.setCopyNumber(dice, 99));
    expect(guarded).toBeInstanceOf(CollectionError);
    expect(f.writes).toBe(1);
    expect(collection.state).toEqual(initial);

    f.failLoad(true);
    const refreshError = yield* Effect.flip(collection.refresh());
    expect(refreshError).toBeInstanceOf(CollectionError);
    expect(collection.needsRefresh).toBe(true);
    expect(collection.canWrite).toBe(false);

    const remote = { [core]: { owned: true, copyNumber: 27 }, [dice]: { wished: true } };
    f.replaceState(remote);
    f.failLoad(false);
    yield* collection.refresh();
    expect(collection.needsRefresh).toBe(false);
    expect(collection.canWrite).toBe(true);
    expect(collection.saveError).toBeUndefined();
    expect(collection.state).toEqual(remote);
    yield* collection.setCopyNumber(dice, 42);
    expect(collection.get(dice)).toEqual({ wished: true, copyNumber: 42 });
  }),
);

it.effect("change notices block edits without replacing state, survive refresh races, and release their subscription", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const f = store({ [core]: { owned: true } });
    const events = yield* Queue.make<boolean>();
    const delivered = yield* Queue.make<void>();
    const released = yield* Deferred.make<void>();
    const changes = Stream.fromQueue(events).pipe(Stream.ensuring(Deferred.succeed(released, undefined)));
    // An acknowledgement after each stream element makes these race checks deterministic.
    const watched = { ...f.api, changes: changes.pipe(Stream.tap(() => Queue.offer(delivered, undefined))) };
    yield* collection.setStore(watched);
    const active = yield* Effect.forkChild(collection.observeChanges());
    yield* Queue.offer(events, true);
    yield* Queue.take(delivered);
    yield* Effect.yieldNow;
    expect(collection.needsRefresh).toBe(true);
    expect(collection.canWrite).toBe(false);
    expect(collection.state).toEqual({ [core]: { owned: true } });
    expect(collection.saveError).toBeUndefined();
    expect((yield* Effect.flip(collection.toggleWish(dice))).operation).toBe("save");
    expect(f.writes).toBe(0);
    f.replaceState({ [dice]: { wished: true } });
    yield* collection.refresh();
    expect(collection.needsRefresh).toBe(false);
    expect(collection.state).toEqual({ [dice]: { wished: true } });
    const started = yield* Deferred.make<void>();
    const finish = yield* Deferred.make<void>();
    f.onLoadStarted(() => Deferred.succeed(started, undefined));
    f.waitForLoad(Deferred.await(finish));
    const refresh = yield* Effect.forkChild(collection.refresh());
    yield* Deferred.await(started);
    expect(collection.canObserve).toBe(true);
    yield* Queue.offer(events, true);
    yield* Queue.take(delivered);
    yield* Effect.yieldNow;
    yield* Deferred.succeed(finish, undefined);
    yield* Fiber.join(refresh);
    expect(collection.needsRefresh).toBe(true);
    yield* collection.setStore(store().api);
    yield* Queue.offer(events, true);
    yield* Queue.take(delivered);
    yield* Effect.yieldNow;
    expect(collection.needsRefresh).toBe(false);
    yield* Fiber.interrupt(active);
    yield* Deferred.await(released);
  }),
);

it.effect("an observer failure blocks editing, preserves the snapshot, and allows resubscription after refresh", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const f = store({ [core]: { owned: true } });
    const released = yield* Deferred.make<void>();
    let subscriptions = 0;
    const changes = Stream.unwrap(
      Effect.sync(() => {
        subscriptions += 1;
        return subscriptions === 1
          ? Stream.fail(new StoreError({ operation: "load", reason: "unavailable", cause: "Observer failed" }))
          : Stream.succeed(true);
      }),
    ).pipe(Stream.ensuring(Deferred.succeed(released, undefined)));
    yield* collection.setStore({ ...f.api, changes });
    const error = yield* Effect.flip(collection.observeChanges());
    expect(collection.loadError).toBe(error);
    expect(collection.loadStatus).toBe("error");
    expect(collection.canWrite).toBe(false);
    expect(collection.canObserve).toBe(false);
    expect(collection.state).toEqual(f.state);
    expect(yield* Deferred.isDone(released)).toBe(true);
    yield* Effect.flip(collection.toggleOwned(core));
    expect(f.writes).toBe(0);
    const loading = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    f.onLoadStarted(() => Deferred.succeed(loading, undefined));
    f.waitForLoad(Deferred.await(release));
    const retry = yield* Effect.forkChild(collection.refresh());
    yield* Deferred.await(loading);
    expect(collection.canObserve).toBe(false);
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(retry);
    expect(collection.loadError).toBeUndefined();
    expect(collection.canWrite).toBe(true);
    yield* collection.observeChanges();
    expect(subscriptions).toBe(2);
    expect(collection.needsRefresh).toBe(true);
  }),
);

it.effect("observer defects block edits without turning cancellation into a load failure", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const f = store({ [core]: { owned: true } });
    yield* collection.setStore({ ...f.api, changes: Stream.die("Observer defect") });
    const result = yield* Effect.exit(collection.observeChanges());
    expect(Exit.isFailure(result)).toBe(true);
    expect(collection.loadError?.cause).toSatisfy(Cause.isCause);
    expect(collection.canWrite).toBe(false);
    yield* collection.setStore({ ...f.api, changes: Stream.fromEffect(Effect.interrupt) });
    yield* Effect.exit(collection.observeChanges());
    expect(collection.loadStatus).toBe("ready");
    expect(collection.loadError).toBeUndefined();
  }),
);

for (const operation of ["import", "export"] as const) {
  it.effect(`a superseded workbook ${operation} cannot affect the next owner or report a stale failure`, () =>
    Effect.gen(function* () {
      const collection = new Collection(operation === "import" ? data : bundleCatalog());
      collection.setUser("first-owner");
      const first = store(operation === "export" ? { [collectionKey("model", "resin")]: { wished: true } } : {});
      yield* collection.setStore(first.api);
      const row = workbookMap.rows[0];
      const action =
        operation === "import"
          ? collection.importWorkbook([{ sheet: row.sheet, row: row.row, name: row.name, owned: true }])
          : collection.exportWorkbook();
      const active = yield* Effect.forkChild(Effect.exit(action), { startImmediately: true });
      collection.setUser("second-owner");
      const second = store();
      yield* collection.setStore(second.api);
      const result = yield* Fiber.join(active);
      expect(Exit.isFailure(result) && Cause.hasInterrupts(result.cause)).toBe(true);
      expect(collection.state).toEqual({});
      expect(first.writes).toBe(0);
      expect(second.writes).toBe(0);
      expect(collection.loadError).toBeUndefined();
      expect(collection.saveError).toBeUndefined();
    }),
  );
}
