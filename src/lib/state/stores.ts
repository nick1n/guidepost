import type { CollectionState, EntryState } from "#lib/types/index.ts";

export interface ContentStateStore {
  load(): CollectionState;
  save(itemId: string, state: EntryState): Promise<void>;
  saveMany(states: CollectionState): Promise<void>;
  clear(): Promise<void>;
}

export class LocalGuestStore implements ContentStateStore {
  private readonly key: string;
  private state: CollectionState;

  constructor(userId: string) {
    this.key = `kdm-content-state:${userId}`;
    this.state = this.read();
  }

  load() {
    return this.state;
  }

  async save(itemId: string, state: EntryState) {
    this.state[itemId] = state;
    this.write();
  }

  async saveMany(states: CollectionState) {
    this.state = { ...this.state, ...states };
    this.write();
  }

  async clear() {
    this.state = {};
    if (typeof localStorage !== "undefined") localStorage.removeItem(this.key);
  }

  private read(): CollectionState {
    if (typeof localStorage === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? "{}") as CollectionState;
    } catch {
      return {};
    }
  }

  private write() {
    if (typeof localStorage !== "undefined") localStorage.setItem(this.key, JSON.stringify(this.state));
  }
}
