import { Effect } from "effect";
import type { ContentStateStore, ContentStateStoreError } from "./stores";
import type { CollectionState, EntryState } from "#lib/types/index.ts";

export type CollectionPersistenceError = {
  readonly _tag: "CollectionPersistenceError";
  readonly message: string;
  readonly operation: "load" | "save" | "clear";
  readonly itemIds: readonly string[];
  readonly cause: unknown;
};

function persistenceError(itemIds: readonly string[], error: ContentStateStoreError): CollectionPersistenceError {
  const message =
    error.operation === "load"
      ? error.reason === "invalid-data"
        ? "Your saved collection data is invalid and could not be loaded."
        : "We couldn't access your saved collection. Please try again."
      : "We couldn't save that change. Please try again.";

  return {
    _tag: "CollectionPersistenceError",
    message,
    operation: error.operation,
    itemIds,
    cause: error,
  };
}

function unavailableStoreError(operation: CollectionPersistenceError["operation"], itemIds: readonly string[]): CollectionPersistenceError {
  return {
    _tag: "CollectionPersistenceError",
    message: "Collection storage is unavailable. Reload the page and try again.",
    operation,
    itemIds,
    cause: "Content state store is not initialized",
  };
}

class ContentState {
  state = $state<CollectionState>({});
  loadStatus = $state<"idle" | "loading" | "ready" | "error">("idle");
  userId = $state<string | undefined>();
  private store?: ContentStateStore;

  setStore(store: ContentStateStore, migrateFrom?: ContentStateStore) {
    const self = this;
    return Effect.suspend(() => {
      self.store = store;
      self.loadStatus = "loading";

      return Effect.gen(function* () {
        const localState = migrateFrom ? yield* migrateFrom.load().pipe(Effect.mapError((error) => persistenceError([], error))) : {};
        const storedState = yield* store.load().pipe(Effect.mapError((error) => persistenceError([], error)));
        const itemIds = Object.keys(localState);

        if (itemIds.length) {
          yield* store.saveMany(localState).pipe(Effect.mapError((error) => persistenceError(itemIds, error)));
          if (migrateFrom) yield* migrateFrom.clear().pipe(Effect.mapError((error) => persistenceError(itemIds, error)));
        }

        self.state = { ...storedState, ...localState };
        self.loadStatus = "ready";
      }).pipe(
        Effect.tapCause(() =>
          Effect.sync(() => {
            self.loadStatus = "error";
          }),
        ),
      );
    });
  }

  setUser(userId?: string) {
    if (this.userId === userId) return;
    this.userId = userId;
    this.store = undefined;
    this.state = {};
    this.loadStatus = "idle";
  }

  refresh() {
    return Effect.suspend(() => {
      if (!this.store) return Effect.fail(unavailableStoreError("load", []));
      this.loadStatus = "loading";
      return this.store.load().pipe(
        Effect.mapError((error) => persistenceError([], error)),
        Effect.tap((state) =>
          Effect.sync(() => {
            this.state = state;
            this.loadStatus = "ready";
          }),
        ),
        Effect.tapCause(() =>
          Effect.sync(() => {
            this.loadStatus = "error";
          }),
        ),
      );
    });
  }

  get(id: string) {
    return this.state[id] ?? {};
  }

  private update(itemId: string, change: (entry: EntryState) => EntryState) {
    return Effect.suspend(() => this.commit(itemId, change(this.get(itemId))));
  }

  private commit(itemId: string, next: EntryState) {
    return Effect.suspend(() => {
      if (!this.store) return Effect.fail(unavailableStoreError("save", [itemId]));

      const store = this.store;
      const previous = this.state;
      this.state = { ...this.state, [itemId]: next };

      return store.save(itemId, next).pipe(
        Effect.mapError((error) => persistenceError([itemId], error)),
        Effect.tapError(() =>
          Effect.sync(() => {
            this.state = previous;
          }),
        ),
      );
    });
  }

  private commitMany(nextState: Record<string, EntryState>) {
    return Effect.suspend(() => {
      if (!this.store) return Effect.fail(unavailableStoreError("save", Object.keys(nextState)));

      const store = this.store;
      const previous = this.state;
      this.state = { ...this.state, ...nextState };

      return store.saveMany(nextState).pipe(
        Effect.mapError((error) => persistenceError(Object.keys(nextState), error)),
        Effect.tapError(() =>
          Effect.sync(() => {
            this.state = previous;
          }),
        ),
      );
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

  setManyOwned(ids: string[], owned: boolean) {
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

  setBundleOwned(bundleId: string, ids: string[], owned: boolean) {
    return this.setManyOwned([bundleId, ...ids], owned);
  }

  reset() {
    return Effect.suspend(() => {
      const store = this.store;
      const previous = this.state;
      if (!store) return Effect.fail(unavailableStoreError("clear", Object.keys(previous)));
      this.state = {};

      return store.clear().pipe(
        Effect.mapError((error) => persistenceError(Object.keys(previous), error)),
        Effect.tapError(() =>
          Effect.sync(() => {
            this.state = previous;
          }),
        ),
      );
    });
  }
}

export const collection = new ContentState();
