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

class ContentState {
  state = $state.raw<CollectionState>({});
  loadStatus = $state<LoadStatus>("pending");
  loadError = $state.raw<CollectionError | undefined>();
  userId = $state<string | undefined>();
  private store?: CollectionStore;
  private writer?: OptimisticStore;

  private setLoadStatus(status: LoadStatus = "error") {
    return () =>
      Effect.sync(() => {
        this.loadStatus = status;
      });
  }

  private recordLoadError = (error: CollectionError) =>
    Effect.sync(() => {
      this.loadError = error;
    });

  setStore(store: CollectionStore, migrateFrom?: CollectionStore) {
    return Effect.gen({ self: this }, function* () {
      this.store = store;
      this.writer = undefined;
      this.loadStatus = "pending";
      this.loadError = undefined;

      const localState = migrateFrom ? yield* migrateFrom.load().pipe(Effect.mapError(persistenceError())) : {};
      const storedState = yield* store.load().pipe(Effect.mapError(persistenceError()));
      const state = { ...storedState, ...localState };
      const itemIds = Object.keys(localState);

      if (itemIds.length) {
        yield* store.save(state).pipe(Effect.mapError(persistenceError(itemIds)));
        if (migrateFrom) yield* migrateFrom.clear().pipe(Effect.mapError(persistenceError(itemIds)));
      }

      this.state = state;
      const writer = new OptimisticStore(store, this.state, (state) => {
        if (this.writer === writer) this.state = state;
      });
      this.writer = writer;
      this.loadStatus = "ready";
    }).pipe(Effect.tapError(this.recordLoadError), Effect.tapCause(this.setLoadStatus()));
  }

  setUser(userId?: string) {
    if (this.userId === userId) return;
    this.userId = userId;
    this.store = undefined;
    this.writer = undefined;
    this.state = {};
    this.loadStatus = "pending";
    this.loadError = undefined;
  }

  refresh() {
    return Effect.gen({ self: this }, function* () {
      this.loadError = undefined;
      if (!this.store) return yield* unavailableStoreError("load");
      if (!this.writer) return yield* this.setStore(this.store);
      this.loadStatus = "pending";
      yield* this.writer.load().pipe(Effect.mapError(persistenceError()));
      this.loadStatus = "ready";
    }).pipe(Effect.tapError(this.recordLoadError), Effect.tapCause(this.setLoadStatus()));
  }

  get(id: string) {
    return this.state[id] ?? {};
  }

  private update(itemId: string, change: (entry: EntryState) => EntryState) {
    return Effect.suspend(() => this.commitMany({ [itemId]: change(this.get(itemId)) }));
  }

  private commitMany(nextState: CollectionState) {
    return Effect.suspend(() => {
      const itemIds = Object.keys(nextState);
      if (!this.store) return Effect.fail(unavailableStoreError("save", itemIds));
      if (this.loadStatus !== "ready") return Effect.fail(collectionNotReadyError("save", itemIds, this.loadStatus));

      if (!this.writer) return Effect.fail(unavailableStoreError("save", itemIds));
      return this.writer.saveMany(nextState).pipe(Effect.mapError(persistenceError(itemIds)));
    });
  }

  toggleOwned(itemId: string, defaults?: { version?: string; edition?: string }) {
    return this.update(itemId, (entry) => {
      const owned = !entry.owned;
      return {
        owned,
        ...(owned ? { wishlisted: false } : {}),
        ...(!owned ? { versions: undefined } : defaults?.version ? { versions: [defaults.version] } : {}),
        ...(!owned ? { editions: undefined } : defaults?.edition ? { editions: [defaults.edition] } : {}),
        ...(!owned ? { editionNumbers: undefined } : {}),
      };
    });
  }

  toggleWishlisted(itemId: string) {
    return this.update(itemId, (entry) => ({ wishlisted: !entry.wishlisted }));
  }

  setVersion(itemId: string, version: string) {
    return this.update(itemId, (entry) => {
      const versions = entry.versions ?? [];
      const next = versions.includes(version) ? versions.filter((value) => value !== version) : [...versions, version];
      return {
        ...(next.length ? { owned: true, wishlisted: false } : {}),
        versions: next.length ? next : undefined,
      };
    });
  }

  setEdition(itemId: string, edition: string) {
    return this.update(itemId, (entry) => {
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
  }

  setEditionNumber(itemId: string, edition: string, editionNumber?: number) {
    return this.update(itemId, (entry) => {
      const numbers = { ...(entry.editionNumbers ?? {}) };
      if (editionNumber == null) delete numbers[edition];
      else numbers[edition] = editionNumber;
      return { editionNumbers: Object.keys(numbers).length ? numbers : undefined };
    });
  }

  setManyOwned(ids: readonly string[], owned: boolean) {
    return Effect.suspend(() => {
      const nextState = Object.fromEntries(
        ids.map((itemId) => {
          return [itemId, { owned, ...(owned ? { wishlisted: false } : {}) }];
        }),
      );
      return this.commitMany(nextState);
    });
  }

  setBundleOwned(bundleId: string, ids: readonly string[], owned: boolean) {
    return this.setManyOwned([bundleId, ...ids], owned);
  }

  reset() {
    return Effect.suspend(() => {
      const store = this.store;
      const itemIds = Object.keys(this.state);
      if (!store) return Effect.fail(unavailableStoreError("clear", itemIds));
      if (this.loadStatus !== "ready") return Effect.fail(collectionNotReadyError("clear", itemIds, this.loadStatus));
      if (!this.writer) return Effect.fail(unavailableStoreError("clear", itemIds));
      return this.writer.clear().pipe(Effect.mapError(persistenceError(itemIds)));
    });
  }
}

export const collection = new ContentState();
