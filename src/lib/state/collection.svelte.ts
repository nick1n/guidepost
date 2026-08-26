import type { ContentStateStore } from "./stores";
import type { CollectionState, EntryState } from "#lib/types/index.ts";

class ContentState {
  state = $state<CollectionState>({});
  hydrated = $state(false);
  userId = $state<string | undefined>();
  private store?: ContentStateStore;

  async setStore(store: ContentStateStore, migrateFrom?: ContentStateStore) {
    if (this.store === store) return;
    const localState = migrateFrom?.load() ?? {};
    this.store = store;
    this.state = { ...store.load(), ...localState };
    this.hydrated = true;
    if (Object.keys(localState).length) {
      await store.saveMany(localState);
      await migrateFrom?.clear();
    }
  }

  setUser(userId?: string) {
    if (this.userId === userId) return;
    this.userId = userId;
    this.state = {};
    this.hydrated = false;
  }

  refresh() {
    if (!this.store) return;
    this.state = this.store.load();
    this.hydrated = true;
  }

  get(id: string) {
    return this.state[id] ?? {};
  }

  private update(itemId: string, change: (entry: EntryState) => EntryState) {
    return this.commit(itemId, change(this.get(itemId)));
  }

  private async commit(itemId: string, next: EntryState) {
    if (!this.store) return;
    const previous = this.state;
    this.state = { ...this.state, [itemId]: next };
    try {
      await this.store.save(itemId, next);
    } catch (error) {
      this.state = previous;
      throw error;
    }
  }

  private async commitMany(nextState: Record<string, EntryState>) {
    if (!this.store) return;
    const previous = this.state;
    this.state = { ...this.state, ...nextState };
    try {
      await this.store.saveMany(nextState);
    } catch (error) {
      this.state = previous;
      throw error;
    }
  }

  async toggleOwned(itemId: string, defaults?: { version?: string; edition?: string }) {
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

  async toggleWishlisted(itemId: string) {
    return this.update(itemId, (entry) => ({ ...entry, wishlisted: !entry.wishlisted }));
  }

  async setVersion(itemId: string, version: string) {
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

  async setEdition(itemId: string, edition: string) {
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

  async setEditionNumber(itemId: string, edition: string, editionNumber?: number) {
    return this.update(itemId, (entry) => {
      const numbers = { ...(entry.editionNumbers ?? {}) };
      if (editionNumber == null) delete numbers[edition];
      else numbers[edition] = editionNumber;
      return { ...entry, editionNumbers: Object.keys(numbers).length ? numbers : undefined };
    });
  }

  async setManyOwned(ids: string[], owned: boolean) {
    const nextState = Object.fromEntries(
      ids.map((itemId) => {
        const entry = this.get(itemId);
        return [itemId, { ...entry, owned, wishlisted: owned ? false : entry.wishlisted }];
      }),
    );
    await this.commitMany(nextState);
  }

  async reset() {
    const previous = this.state;
    this.state = {};
    try {
      await this.store?.clear();
    } catch (error) {
      this.state = previous;
      throw error;
    }
  }
}

export const collection = new ContentState();
