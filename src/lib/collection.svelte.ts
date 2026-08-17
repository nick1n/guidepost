import { browser } from '$app/env';

const STORAGE_KEY = 'kdm-collection-v1';

export type EntryState = {
  owned?: boolean;
  wishlisted?: boolean;
  version?: string;
  versions?: string[];
  edition?: string;
  editions?: string[];
  editionNumber?: number;
  editionNumbers?: Record<string, number>;
};

export type CollectionState = Record<string, EntryState>;

function read(): CollectionState {
  if (!browser) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CollectionState;
    return Object.fromEntries(
      Object.entries(parsed).map(([id, entry]) => {
        const next = { ...entry };
        if (!next.versions && next.version) next.versions = [next.version];
        if (!next.editions && next.edition) next.editions = [next.edition];
        if (!next.editionNumbers && next.edition && next.editionNumber != null) {
          next.editionNumbers = { [next.edition]: next.editionNumber };
        }
        return [id, next];
      }),
    );
  } catch {
    return {};
  }
}

function persist(state: CollectionState) {
  if (!browser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — keep working in memory
  }
}

class Collection {
  state = $state<CollectionState>({});
  hydrated = $state(false);

  init() {
    if (this.hydrated) return;
    this.state = read();
    this.hydrated = true;
  }

  get(id: string): EntryState {
    return this.state[id] ?? {};
  }

  toggleOwned(id: string, defaults?: { version?: string; edition?: string }) {
    const entry = this.state[id] ?? {};
    const owned = !entry.owned;
    this.state = {
      ...this.state,
      [id]: {
        ...entry,
        owned,
        wishlisted: owned ? false : entry.wishlisted,
        versions: owned
          ? defaults?.version ? [defaults.version] : entry.versions
          : undefined,
        editions: owned
          ? defaults?.edition ? [defaults.edition] : entry.editions
          : undefined,
        editionNumbers: owned ? entry.editionNumbers : undefined
      }
    };
    persist(this.state);
  }

  toggleWishlisted(id: string) {
    const entry = this.state[id] ?? {};
    this.state = {
      ...this.state,
      [id]: { ...entry, wishlisted: !entry.wishlisted },
    };
    persist(this.state);
  }

  setVersion(id: string, version: string) {
    const entry = this.state[id] ?? {};
    const versions = entry.versions ?? (entry.version ? [entry.version] : []);
    const nextVersions = versions.includes(version)
      ? versions.filter((v) => v !== version)
      : [...versions, version];
    this.state = {
      ...this.state,
      [id]: {
        ...entry,
        owned: nextVersions.length > 0 ? true : entry.owned,
        wishlisted: nextVersions.length > 0 ? false : entry.wishlisted,
        versions: nextVersions.length ? nextVersions : undefined,
      },
    };
    persist(this.state);
  }

  setEdition(id: string, edition: string) {
    const entry = this.state[id] ?? {};
    const editions = entry.editions ?? (entry.edition ? [entry.edition] : []);
    const nextEditions = editions.includes(edition)
      ? editions.filter((e) => e !== edition)
      : [...editions, edition];
    const numbers = { ...entry.editionNumbers ?? {} };
    if (!nextEditions.includes(edition)) delete numbers[edition];
    this.state = {
      ...this.state,
      [id]: {
        ...entry,
        owned: nextEditions.length > 0 ? true : entry.owned,
        editions: nextEditions.length ? nextEditions : undefined,
        editionNumbers: Object.keys(numbers).length ? numbers : undefined,
        wishlisted: nextEditions.length > 0 ? false : entry.wishlisted,
      },
    };
    persist(this.state);
  }

  setEditionNumber(id: string, edition: string, editionNumber?: number) {
    const entry = this.state[id] ?? {};
    const numbers = { ...entry.editionNumbers ?? {} };

    if (editionNumber == null) delete numbers[edition]; else numbers[edition] = editionNumber;

    this.state = {
      ...this.state,
      [id]: {
        ...entry,
        editionNumbers: Object.keys(numbers).length ? numbers : undefined,
      },
    };
    persist(this.state);
  }

  setManyOwned(ids: string[], owned: boolean) {
    const next = { ...this.state };
    for (const id of ids) {
      next[id] = {
        ...next[id] ?? {},
        owned,
        wishlisted: owned ? false : next[id]?.wishlisted
      };
    }
    this.state = next;
    persist(this.state);
  }

  reset() {
    this.state = {};
    persist(this.state);
  }
}

export const collection = new Collection();
