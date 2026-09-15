import { Effect } from "effect";
import { CollectionError } from "./collection-errors.ts";
import type { CollectionStore, StoreError } from "./stores";
import { OptimisticStore } from "./optimistic-store.ts";
import type { CollectionState, EntryState } from "#lib/types/index.ts";

type LoadStatus = "pending" | "ready" | "error";

function persistenceError(itemIds: readonly string[] = []) {
  return (error: StoreError) => {
    let message = "We couldn't save that change. Please try again.";
    if (error.operation === "load") {
      message = "We couldn't access your saved collection. Please try again.";
      if (error.reason === "invalid-data") {
        message = "Your saved collection data is invalid and could not be loaded.";
      }
    } else if (error.reason === "serialization") {
      message = "Your collection data could not be prepared for saving. The change was not saved.";
    }

    return new CollectionError({
      message,
      operation: error.operation,
      itemIds,
      cause: error,
    });
  };
}

function unavailableStoreError(operation: CollectionError["operation"], itemIds: readonly string[] = []) {
  return new CollectionError({
    message: "Collection storage is unavailable. Reload the page and try again.",
    operation,
    itemIds,
    cause: "Content state store is not initialized",
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
    cause: `Content state store is ${loadStatus}`,
  });
}

function ownershipPatch(owned: boolean, defaults?: { version?: string; edition?: string }) {
  if (!owned) {
    return {
      owned: false,
      versions: undefined,
      editions: undefined,
      editionNumbers: undefined,
    };
  }

  return {
    owned: true,
    wishlisted: false,
    ...(defaults?.version ? { versions: [defaults.version] } : {}),
    ...(defaults?.edition ? { editions: [defaults.edition] } : {}),
  };
}

export class ContentState {
  state = $state.raw<CollectionState>({});
  loadStatus = $state<LoadStatus>("pending");
  loadError = $state.raw<CollectionError | undefined>();
  userId = $state<string | undefined>();
  private store?: CollectionStore;
  private writer?: OptimisticStore;
  private generation = 0;

  private setLoadStatus(status: LoadStatus = "error") {
    return Effect.sync(() => {
      this.loadStatus = status;
    });
  }

  private recordLoadError = (error: CollectionError) =>
    Effect.sync(() => {
      this.loadError = error;
    });

  private isCurrent(generation: number) {
    return this.generation === generation;
  }

  private finishLoad<A>(effect: Effect.Effect<A, CollectionError>, generation: number) {
    return effect.pipe(
      // Superseded results must not reach the action boundary as success or failure.
      Effect.tap(() => (this.isCurrent(generation) ? Effect.void : Effect.interrupt)),
      Effect.catchCause((cause) => (this.isCurrent(generation) ? Effect.failCause(cause) : Effect.interrupt)),
      Effect.tapError(this.recordLoadError),
      Effect.tapCause(() => (this.isCurrent(generation) ? this.setLoadStatus() : Effect.void)),
    );
  }

  setStore = Effect.fn("ContentState.setStore")({ self: this }, function* (store: CollectionStore, migrateFrom?: CollectionStore) {
    const self = this;
    const generation = ++this.generation;
    this.store = store;
    this.writer = undefined;
    this.loadStatus = "pending";
    this.loadError = undefined;

    return yield* Effect.gen(function* () {
      const localState = migrateFrom ? yield* migrateFrom.load().pipe(Effect.mapError(persistenceError())) : {};
      const storedState = yield* store.load().pipe(Effect.mapError(persistenceError()));
      const state = { ...storedState, ...localState };
      const itemIds = Object.keys(localState);

      if (itemIds.length) {
        if (!self.isCurrent(generation)) return yield* Effect.interrupt;
        yield* store.save(state).pipe(Effect.mapError(persistenceError(itemIds)));
        if (migrateFrom) {
          if (!self.isCurrent(generation)) return yield* Effect.interrupt;
          yield* migrateFrom.clear().pipe(Effect.mapError(persistenceError(itemIds)));
        }
      }

      if (!self.isCurrent(generation)) return yield* Effect.interrupt;
      self.state = state;
      const writer = new OptimisticStore(store, self.state, (state) => {
        if (self.writer === writer) self.state = state;
      });
      self.writer = writer;
      self.loadStatus = "ready";
    }).pipe((effect) => self.finishLoad(effect, generation));
  });

  setUser(userId?: string) {
    if (this.userId === userId) return;
    this.generation += 1;
    this.userId = userId;
    this.store = undefined;
    this.writer = undefined;
    this.state = {};
    this.loadStatus = "pending";
    this.loadError = undefined;
  }

  refresh = Effect.fn("ContentState.refresh")({ self: this }, function* () {
    if (this.store && !this.writer) return yield* this.setStore(this.store);
    const self = this;
    const generation = ++this.generation;
    this.loadError = undefined;
    return yield* Effect.gen(function* () {
      if (!self.store) return yield* unavailableStoreError("load");
      if (!self.writer) return yield* unavailableStoreError("load");
      self.loadStatus = "pending";
      yield* self.writer.load().pipe(Effect.mapError(persistenceError()));
      if (self.isCurrent(generation)) self.loadStatus = "ready";
    }).pipe((effect) => self.finishLoad(effect, generation));
  });

  get(id: string) {
    return this.state[id] ?? {};
  }

  private update(itemId: string, change: (entry: EntryState) => EntryState) {
    return Effect.suspend(() => this.commitMany({ [itemId]: change(this.get(itemId)) }));
  }

  private commitMany = Effect.fn("ContentState.commitMany")({ self: this }, function* (nextState: CollectionState) {
    const itemIds = Object.keys(nextState);
    if (!this.store) return yield* Effect.fail(unavailableStoreError("save", itemIds));
    if (this.loadStatus !== "ready") return yield* Effect.fail(collectionNotReadyError("save", itemIds, this.loadStatus));

    if (!this.writer) return yield* Effect.fail(unavailableStoreError("save", itemIds));
    return yield* this.writer.saveMany(nextState).pipe(Effect.mapError(persistenceError(itemIds)));
  });

  toggleOwned = Effect.fn("ContentState.toggleOwned")(
    { self: this },
    function* (itemId: string, defaults?: { version?: string; edition?: string }) {
      return yield* this.update(itemId, (entry) => ownershipPatch(!entry.owned, defaults));
    },
  );

  toggleWishlisted = Effect.fn("ContentState.toggleWishlisted")({ self: this }, function* (itemId: string) {
    return yield* this.update(itemId, (entry) => ({ wishlisted: !entry.wishlisted }));
  });

  setVersion = Effect.fn("ContentState.setVersion")({ self: this }, function* (itemId: string, version: string) {
    return yield* this.update(itemId, (entry) => {
      const versions = entry.versions ?? [];
      const next = versions.includes(version) ? versions.filter((value) => value !== version) : [...versions, version];
      return {
        ...(next.length ? { owned: true, wishlisted: false } : {}),
        versions: next.length ? next : undefined,
      };
    });
  });

  setEdition = Effect.fn("ContentState.setEdition")({ self: this }, function* (itemId: string, edition: string) {
    return yield* this.update(itemId, (entry) => {
      const editions = entry.editions ?? [];
      const next = editions.includes(edition) ? editions.filter((value) => value !== edition) : [...editions, edition];
      const numbers = { ...(entry.editionNumbers ?? {}) };
      if (!next.includes(edition)) delete numbers[edition];
      return {
        ...(next.length ? { owned: true, wishlisted: false } : {}),
        editions: next.length ? next : undefined,
        editionNumbers: Object.keys(numbers).length ? numbers : undefined,
      };
    });
  });

  setEditionNumber = Effect.fn("ContentState.setEditionNumber")(
    { self: this },
    function* (itemId: string, edition: string, editionNumber?: number) {
      return yield* this.update(itemId, (entry) => {
        const numbers = { ...(entry.editionNumbers ?? {}) };
        if (editionNumber == null) delete numbers[edition];
        else numbers[edition] = editionNumber;
        return { editionNumbers: Object.keys(numbers).length ? numbers : undefined };
      });
    },
  );

  setManyOwned = Effect.fn("ContentState.setManyOwned")({ self: this }, function* (ids: readonly string[], owned: boolean) {
    const nextState = Object.fromEntries(ids.map((itemId) => [itemId, ownershipPatch(owned)]));
    return yield* this.commitMany(nextState);
  });

  setBundleOwned = Effect.fn("ContentState.setBundleOwned")(
    { self: this },
    function* (bundleId: string, ids: readonly string[], owned: boolean) {
      return yield* this.setManyOwned([bundleId, ...ids], owned);
    },
  );

  reset = Effect.fn("ContentState.reset")({ self: this }, function* () {
    const store = this.store;
    const itemIds = Object.keys(this.state);
    if (!store) return yield* Effect.fail(unavailableStoreError("clear", itemIds));
    if (this.loadStatus !== "ready") return yield* Effect.fail(collectionNotReadyError("clear", itemIds, this.loadStatus));
    if (!this.writer) return yield* Effect.fail(unavailableStoreError("clear", itemIds));
    return yield* this.writer.clear().pipe(Effect.mapError(persistenceError(itemIds)));
  });
}

export const collection = new ContentState();
