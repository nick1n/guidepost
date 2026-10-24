import { Cause, Effect, Result, Schema, Stream } from "effect";
import { createContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import { CollectionError } from "./collection-errors.ts";
import { StoreError, type CollectionStore } from "./collection-store.ts";
import { OptimisticStore } from "./optimistic-store.ts";
import { decodeBackup, encodeBackup, previewWorkbookRows, exportWorkbookRows } from "./collection-transfer.ts";
import type { Catalog, CollectionPatch, CollectionSnapshot, Currency, EntryState } from "#lib/types/index.ts";
import { collectionKey, copyNumberMaximum, CopyNumberSchema, parseCollectionKey } from "#lib/types/collection.ts";
import { reviewIndex, reviewEditions, reviewPrice, type EditionSelection } from "#lib/catalog-view.ts";

type LoadStatus = "pending" | "ready" | "error";

function persistenceError(itemIds: readonly string[] = []) {
  return (error: StoreError) => {
    let message = "We couldn't save that change. Please try again.";
    if (error.reason === "stale") {
      message = "Your collection changed in another tab. Refresh your collection before editing again.";
    } else if (error.operation === "load") {
      message =
        error.reason === "invalid-data"
          ? "Your saved collection data is invalid and could not be loaded."
          : "We couldn't access your saved collection. Please try again.";
    }
    return new CollectionError({ message, operation: error.operation, itemIds, cause: error });
  };
}

function unavailableStoreError(operation: CollectionError["operation"], itemIds: readonly string[] = []) {
  return new CollectionError({
    message: "Collection storage is unavailable. Reload the page and try again.",
    operation,
    itemIds,
    cause: "Collection store is not initialized",
  });
}

function collectionNotReadyError(operation: CollectionError["operation"], itemIds: readonly string[], loadStatus: LoadStatus) {
  return new CollectionError({
    message:
      loadStatus === "error"
        ? "Your collection could not be loaded. Try loading it again before making changes."
        : "Your collection is still loading. Please try again in a moment.",
    operation,
    itemIds,
    cause: "Collection store is " + loadStatus,
  });
}

function ownershipPatch(owned: boolean): EntryState {
  return owned ? { owned: true, wished: false, missing: false } : { owned: false, missing: false };
}

function decodeKey(key: string) {
  return Effect.fromResult(parseCollectionKey(key)).pipe(
    Effect.mapError(
      (cause) =>
        new CollectionError({
          operation: "save",
          itemIds: [key],
          message: "Collection entry has an invalid key.",
          cause,
        }),
    ),
  );
}

export class Collection {
  state = $state.raw<CollectionSnapshot>({});
  loadStatus = $state<LoadStatus>("pending");
  loadError = $state.raw<CollectionError | undefined>();
  saveError = $state.raw<CollectionError | undefined>();
  needsRefresh = $state(false);
  pendingSaves = $state(0);
  private readonly pendingEdits = new SvelteSet<{ flush: () => void }>();
  readonly isSaving = $derived(this.pendingSaves > 0);
  readonly hasPendingChanges = $derived(this.pendingEdits.size > 0 || this.isSaving);
  readonly owned = $derived.by(() =>
    this.catalog.entries.flatMap((item) =>
      reviewEditions(item)
        .filter((edition) => this.getEdition(item.id, edition.id).owned)
        .map((edition) => ({ item, edition })),
    ),
  );
  readonly ownedCount = $derived(this.owned.filter(({ item, edition }) => item.category !== "bundles" && !edition.includedOnly).length);
  readonly wishlistCount = $derived(
    this.catalog.entries.reduce(
      (total, item) => total + reviewEditions(item).filter((edition) => this.getEdition(item.id, edition.id).wished).length,
      0,
    ),
  );
  readonly totals = $derived.by(() => {
    const totals: Partial<Record<Currency, number>> = {};
    for (const { item, edition } of this.owned) {
      if (edition.includedOnly) continue;
      const currency = item.currency ?? "USD";
      totals[currency] = (totals[currency] ?? 0) + (reviewPrice(item, edition) ?? 0);
    }
    return totals;
  });
  readonly coverage = $derived(this.catalog.coverage(this.state));
  private catalogData: Catalog = $state.raw({ content: {}, "included-only": {}, accessories: {}, bundles: {}, homebrew: {} });
  private readonly catalogIndex = $derived(reviewIndex(this.catalogData));
  private userId?: string;
  private store?: CollectionStore;
  private writer?: OptimisticStore;
  private generation = 0;
  private changeVersion = 0;
  private observationFailed = false;

  constructor(catalogData?: Catalog) {
    if (catalogData) this.catalogData = catalogData;
  }

  get catalog() {
    // Build the shared catalog index only when a collection view or command needs it.
    return this.catalogIndex;
  }

  setCatalog(catalogData: Catalog) {
    this.catalogData = catalogData;
  }

  get canWrite() {
    return this.loadStatus === "ready" && !this.needsRefresh;
  }

  get hasStore() {
    return this.store !== undefined;
  }

  get canObserve() {
    // Keep an existing subscription active while a refresh reads the next snapshot.
    return this.loadStatus !== "error" && this.writer !== undefined && !this.observationFailed;
  }

  private isCurrent(generation: number) {
    return this.generation === generation;
  }

  registerPendingEdit(flush: () => void) {
    const edit = { flush };
    this.pendingEdits.add(edit);
    return () => this.pendingEdits.delete(edit);
  }

  flushPendingEdits() {
    // A flush may unregister itself or register another edit; visit only the captured batch.
    for (const edit of [...this.pendingEdits]) {
      if (this.pendingEdits.has(edit)) edit.flush();
    }
  }

  forSession<A, E>(effect: Effect.Effect<A, E>) {
    // Capture now, before a UI debounce delays execution, and reject superseded work before it can write.
    const generation = this.generation;
    return Effect.suspend(() => (this.isCurrent(generation) ? this.guardGeneration(effect, generation) : Effect.interrupt));
  }

  private guardGeneration<A, E>(effect: Effect.Effect<A, E>, generation = this.generation) {
    // Superseded results and failures must not reach the action boundary.
    return effect.pipe(
      Effect.tap(() => (this.isCurrent(generation) ? Effect.void : Effect.interrupt)),
      Effect.catchCause((cause) => (this.isCurrent(generation) ? Effect.failCause(cause) : Effect.interrupt)),
    );
  }

  private finishLoad(effect: Effect.Effect<void, CollectionError>, generation: number) {
    return effect.pipe(
      (effect) => this.guardGeneration(effect, generation),
      Effect.tapError((error) =>
        Effect.sync(() => {
          this.loadError = error;
        }),
      ),
      Effect.tapCause(() =>
        Effect.sync(() => {
          if (this.isCurrent(generation)) this.loadStatus = "error";
        }),
      ),
    );
  }

  setStore = Effect.fn("Collection.setStore")({ self: this }, function* (store: CollectionStore) {
    const generation = ++this.generation;
    this.pendingEdits.clear();
    this.store = store;
    this.writer = undefined;
    this.loadStatus = "pending";
    this.loadError = undefined;
    this.saveError = undefined;
    this.needsRefresh = false;
    return yield* Effect.gen({ self: this }, function* () {
      const state = yield* store.load().pipe(Effect.mapError(persistenceError()));
      if (!this.isCurrent(generation)) return yield* Effect.interrupt;
      this.state = state;
      const writer = new OptimisticStore(store, state, (next) => {
        if (this.writer === writer) this.state = next;
      });
      this.writer = writer;
      this.observationFailed = false;
      this.loadStatus = "ready";
    }).pipe((effect) => this.finishLoad(effect, generation));
  });

  setUser(userId?: string) {
    if (this.userId === userId) return;
    this.generation += 1;
    this.pendingEdits.clear();
    this.userId = userId;
    this.store = undefined;
    this.writer = undefined;
    this.state = {};
    this.loadStatus = "pending";
    this.loadError = undefined;
    this.saveError = undefined;
    this.needsRefresh = false;
  }

  observeChanges = Effect.fn("Collection.observeChanges")({ self: this }, function* () {
    const store = this.store;
    if (!store?.changes) return;
    yield* store.changes.pipe(
      Stream.runForEach((stale) =>
        Effect.sync(() => {
          if (stale && this.store === store) {
            this.changeVersion += 1;
            this.needsRefresh = true;
          }
        }),
      ),
      Effect.mapError(persistenceError()),
      Effect.catchCause((cause) => {
        if (this.store !== store) return Effect.interrupt;
        if (Cause.hasInterrupts(cause)) return Effect.failCause(cause);
        const error = Cause.findError(cause);
        return Effect.sync(() => {
          this.loadError =
            Result.isSuccess(error) && !Cause.hasDies(cause)
              ? error.success
              : new CollectionError({
                  operation: "load",
                  itemIds: [],
                  message: "Collection monitoring failed. Try loading your collection again.",
                  cause,
                });
          this.loadStatus = "error";
          this.observationFailed = true;
        }).pipe(Effect.andThen(Effect.failCause(cause)));
      }),
    );
  });

  refresh = Effect.fn("Collection.refresh")({ self: this }, function* () {
    if (this.store && !this.writer) return yield* this.setStore(this.store);
    const generation = ++this.generation;
    const changeVersion = this.changeVersion;
    this.pendingEdits.clear();
    this.loadError = undefined;
    return yield* Effect.gen({ self: this }, function* () {
      if (!this.store || !this.writer) return yield* unavailableStoreError("load");
      this.loadStatus = "pending";
      yield* this.writer.load().pipe(Effect.mapError(persistenceError()));
      if (this.isCurrent(generation)) {
        this.observationFailed = false;
        this.loadStatus = "ready";
        this.saveError = undefined;
        // A change reported during loading may be newer than the fetched snapshot.
        this.needsRefresh = this.changeVersion !== changeVersion;
      }
    }).pipe((effect) => this.finishLoad(effect, generation));
  });

  get(key: string): EntryState {
    return this.state[key] ?? {};
  }

  getEdition(contentId: string, editionId: string) {
    return this.get(collectionKey(contentId, editionId));
  }

  private reportSave<A>(effect: Effect.Effect<A, StoreError>, keys: readonly string[]) {
    const generation = this.generation;
    return Effect.acquireUseRelease(
      Effect.sync(() => {
        this.pendingSaves += 1;
      }),
      () =>
        effect.pipe(
          Effect.mapError(persistenceError(keys)),
          (effect) => this.guardGeneration(effect, generation),
          Effect.tapError((error) =>
            Effect.sync(() => {
              if (!this.isCurrent(generation)) return;
              this.saveError = error;
              if (error.cause instanceof StoreError && error.cause.reason === "stale") this.needsRefresh = true;
            }),
          ),
          Effect.tap(() =>
            Effect.sync(() => {
              if (this.isCurrent(generation)) this.saveError = undefined;
            }),
          ),
        ),
      () =>
        Effect.sync(() => {
          this.pendingSaves -= 1;
        }),
    );
  }

  private commitMany = Effect.fn("Collection.commitMany")({ self: this }, function* (patch: CollectionPatch) {
    const keys = Object.keys(patch);
    if (!keys.length) return false;
    for (const key of keys) yield* decodeKey(key);
    const writer = yield* this.requireWriter("save", keys);
    return yield* this.reportSave(writer.saveMany(patch), keys);
  });

  private requireWriter(operation: "save" | "clear", keys: readonly string[]) {
    return Effect.suspend(() => {
      if (!this.store || !this.writer) {
        return Effect.fail(this.store ? collectionNotReadyError(operation, keys, this.loadStatus) : unavailableStoreError(operation, keys));
      }
      if (this.loadStatus !== "ready") return Effect.fail(collectionNotReadyError(operation, keys, this.loadStatus));
      if (this.needsRefresh)
        return Effect.fail(persistenceError(keys)(new StoreError({ operation, reason: "stale", cause: "Refresh required" })));
      return Effect.succeed(this.writer);
    });
  }

  setOwned = Effect.fn("Collection.setOwned")({ self: this }, function (key: string, owned: boolean) {
    return this.setManyOwned([key], owned);
  });

  toggleOwned = Effect.fn("Collection.toggleOwned")({ self: this }, function (key: string, owned?: boolean) {
    return this.setOwned(key, owned ?? !this.get(key).owned);
  });

  toggleIncludedOwned = Effect.fn("Collection.toggleIncludedOwned")({ self: this }, function* (key: string, owned?: boolean) {
    const entry = this.get(key);
    const [itemId, editionId] = yield* decodeKey(key);
    const shouldOwn = owned ?? !this.coverage.edition(itemId, editionId).covered;
    const restored = { ...this.state, [key]: { ...entry, owned: false, missing: false } };
    const supplied = this.catalog.coverage(restored).edition(itemId, editionId).covered;
    if (!shouldOwn) {
      return yield* this.commitMany({ [key]: { owned: false, missing: supplied } });
    }
    return yield* supplied ? this.setMissing(key, false) : this.setOwned(key, true);
  });

  toggleWish = Effect.fn("Collection.toggleWish")({ self: this }, function (key: string) {
    const entry = this.get(key);
    return this.commitMany({ [key]: { wished: !entry.owned && !entry.wished } });
  });

  setCopyNumber = Effect.fn("Collection.setCopyNumber")({ self: this }, function* (key: string, copyNumber: number | undefined) {
    if (copyNumber !== undefined) {
      yield* Schema.decodeUnknownEffect(CopyNumberSchema)(copyNumber).pipe(
        Effect.mapError(
          (cause) =>
            new CollectionError({
              operation: "save",
              itemIds: [key],
              message: `Copy numbers must be whole numbers from 1 to ${copyNumberMaximum}.`,
              cause,
            }),
        ),
      );
      const [contentId, editionId] = yield* decodeKey(key);
      const runSize = this.catalog.byId.get(contentId)?.editions?.find((edition) => edition.id === editionId)?.runSize;
      if (runSize !== undefined && copyNumber > runSize)
        return yield* new CollectionError({
          operation: "save",
          itemIds: [key],
          message: `Copy number must not exceed this edition's run of ${runSize}.`,
          cause: copyNumber,
        });
    }
    return yield* this.commitMany({ [key]: { copyNumber } });
  });

  setManyOwned = Effect.fn("Collection.setManyOwned")({ self: this }, function* (keys: readonly string[], owned: boolean) {
    const patch: CollectionPatch = Object.fromEntries(keys.map((key) => [key, ownershipPatch(owned)]));
    for (const key of keys) {
      const [itemId, editionId] = yield* decodeKey(key);
      const bundle = this.catalog.byId.get(itemId)?.category === "bundles";
      if (!owned && !bundle) continue;
      for (const child of this.catalog.includedEditions(itemId, editionId)) {
        const childKey = collectionKey(child.item.id, child.edition.id);
        if (bundle) patch[childKey] = ownershipPatch(owned);
        else if (this.get(childKey).missing) patch[childKey] = { ...patch[childKey], missing: false };
      }
    }
    return yield* this.commitMany(patch);
  });

  setEditionsOwned = Effect.fn("Collection.setEditionsOwned")(
    { self: this },
    function (targets: readonly EditionSelection[], owned: boolean) {
      return this.setManyOwned(this.catalog.ownershipKeys(targets), owned);
    },
  );

  setMissing = Effect.fn("Collection.setMissing")({ self: this }, function (key: string, missing: boolean) {
    return this.commitMany({ [key]: { missing } });
  });

  exportBackup = Effect.fn("Collection.exportBackup")({ self: this }, function* () {
    const generation = this.generation;
    const writer = yield* this.requireWriter("save", []);
    return yield* this.guardGeneration(
      writer.snapshot().pipe(Effect.flatMap((snapshot) => encodeBackup(snapshot, this.catalogData))),
      generation,
    );
  });

  restoreBackup = Effect.fn("Collection.restoreBackup")({ self: this }, function* (json: string) {
    const snapshot = yield* this.guardGeneration(decodeBackup(json, this.catalogData));
    const keys = Object.keys(snapshot);
    const writer = yield* this.requireWriter("save", keys);
    return yield* this.reportSave(writer.replace(snapshot), keys);
  });

  previewWorkbook = Effect.fn("Collection.previewWorkbook")({ self: this }, function* (rows: unknown) {
    const entries = yield* this.guardGeneration(previewWorkbookRows(rows, this.catalogData));
    const patch: CollectionPatch = {};
    for (const [key, entry] of Object.entries(entries)) {
      patch[key] = {
        ...(entry.owned === undefined ? {} : ownershipPatch(entry.owned)),
        ...entry,
      };
    }
    for (const [key, entry] of Object.entries(patch)) {
      if (entry.owned ?? this.get(key).owned) patch[key] = { ...entry, wished: false };
    }
    return patch;
  });

  importWorkbook = Effect.fn("Collection.importWorkbook")({ self: this }, function* (rows: unknown) {
    const entries = yield* this.previewWorkbook(rows);
    return yield* this.commitMany(entries);
  });

  exportWorkbook = Effect.fn("Collection.exportWorkbook")({ self: this }, function* () {
    const generation = this.generation;
    const writer = yield* this.requireWriter("save", []);
    return yield* this.guardGeneration(
      writer.snapshot().pipe(Effect.flatMap((snapshot) => exportWorkbookRows(snapshot, this.catalogData))),
      generation,
    );
  });

  reset = Effect.fn("Collection.reset")({ self: this }, function* () {
    const keys = Object.keys(this.state);
    const writer = yield* this.requireWriter("clear", keys);
    return yield* this.reportSave(writer.clear(), keys);
  });
}

export const [getCollection, setCollection] = createContext<Collection>();
