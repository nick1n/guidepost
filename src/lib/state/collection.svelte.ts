import { Data, Effect } from "effect";
import type { CollectionStore, StoreError } from "./stores";
import type { CollectionState, EntryState } from "#lib/types/index.ts";

type LoadStatus = "pending" | "ready" | "error";

export class CollectionError extends Data.TaggedError("CollectionError")<{
  readonly message: string;
  readonly operation: "load" | "save" | "clear";
  readonly itemIds: readonly string[];
  readonly cause: unknown;
}> {}

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
  userId = $state<string | undefined>();
  private store?: CollectionStore;

  private restoreState(previous: CollectionState) {
    return () =>
      Effect.sync(() => {
        this.state = previous;
      });
  }

  private setLoadStatus(status: LoadStatus = "error") {
    return () =>
      Effect.sync(() => {
        this.loadStatus = status;
      });
  }

  setStore(store: CollectionStore, migrateFrom?: CollectionStore) {
    const self = this;
    return Effect.gen(function* () {
      self.store = store;
      self.loadStatus = "pending";

      const localState = migrateFrom ? yield* migrateFrom.load().pipe(Effect.mapError(persistenceError())) : {};
      const storedState = yield* store.load().pipe(Effect.mapError(persistenceError()));
      const itemIds = Object.keys(localState);

      if (itemIds.length) {
        yield* store.saveMany(localState).pipe(Effect.mapError(persistenceError(itemIds)));
        if (migrateFrom) yield* migrateFrom.clear().pipe(Effect.mapError(persistenceError(itemIds)));
      }

      self.state = { ...storedState, ...localState };
      self.loadStatus = "ready";
    }).pipe(Effect.tapCause(self.setLoadStatus()));
  }

  setUser(userId?: string) {
    if (this.userId === userId) return;
    this.userId = userId;
    this.store = undefined;
    this.state = {};
    this.loadStatus = "pending";
  }

  refresh() {
    const self = this;
    return Effect.gen(function* () {
      if (!self.store) return yield* unavailableStoreError("load");
      self.loadStatus = "pending";
      const state = yield* self.store.load().pipe(Effect.mapError(persistenceError()), Effect.tapCause(self.setLoadStatus()));
      self.state = state;
      self.loadStatus = "ready";
    });
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

      const store = this.store;
      const previous = this.state;
      this.state = { ...this.state, ...nextState };

      return store.saveMany(nextState).pipe(Effect.mapError(persistenceError(itemIds)), Effect.tapError(this.restoreState(previous)));
    });
  }

  toggleOwned(itemId: string, defaults?: { version?: string; edition?: string }) {
    return this.update(itemId, (entry) => {
      const owned = !entry.owned;
      return {
        ...entry,
        owned,
        wishlisted: owned ? false : entry.wishlisted,
        versions: owned ? (defaults?.version ? [defaults.version] : entry.versions) : undefined,
        editions: owned ? (defaults?.edition ? [defaults.edition] : entry.editions) : undefined,
        editionNumbers: owned ? entry.editionNumbers : undefined,
      };
    });
  }

  toggleWishlisted(itemId: string) {
    return this.update(itemId, (entry) => ({ ...entry, wishlisted: !entry.wishlisted }));
  }

  setVersion(itemId: string, version: string) {
    return this.update(itemId, (entry) => {
      const versions = entry.versions ?? [];
      const next = versions.includes(version) ? versions.filter((value) => value !== version) : [...versions, version];
      return {
        ...entry,
        owned: next.length ? true : entry.owned,
        wishlisted: next.length ? false : entry.wishlisted,
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
        ...entry,
        owned: next.length ? true : entry.owned,
        wishlisted: next.length ? false : entry.wishlisted,
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
      return { ...entry, editionNumbers: Object.keys(numbers).length ? numbers : undefined };
    });
  }

  setManyOwned(ids: readonly string[], owned: boolean) {
    return Effect.suspend(() => {
      const nextState = Object.fromEntries(
        ids.map((itemId) => {
          const entry = this.get(itemId);
          return [itemId, { ...entry, owned, wishlisted: owned ? false : entry.wishlisted }];
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
      const previous = this.state;
      const itemIds = Object.keys(previous);
      if (!store) return Effect.fail(unavailableStoreError("clear", itemIds));
      if (this.loadStatus !== "ready") return Effect.fail(collectionNotReadyError("clear", itemIds, this.loadStatus));
      this.state = {};

      return store.clear().pipe(Effect.mapError(persistenceError(itemIds)), Effect.tapError(this.restoreState(previous)));
    });
  }
}

export const collection = new ContentState();
