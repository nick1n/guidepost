import type { InstaQLEntity } from "@instantdb/svelte";
import type { AppSchema } from "../../instant.schema";
import type { CollectionState, EntryState } from "./types";
import { db } from "./instant";

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

export type StateEntity = InstaQLEntity<AppSchema, "contentStates">;

export class InstantStore implements ContentStateStore {
  private readonly entityIds: Record<string, string> = {};
  private state: CollectionState = {};

  constructor(private readonly userId: string) {}

  load() {
    return this.state;
  }

  setRows(rows: StateEntity[]) {
    for (const row of rows) this.entityIds[row.itemId] = row.id;
    this.state = Object.fromEntries(rows.map((row) => [row.itemId, fromEntity(row)]));
  }

  async save(itemId: string, state: EntryState) {
    this.state[itemId] = state;
    await db.transact(this.transaction(itemId, state));
  }

  async saveMany(states: CollectionState) {
    this.state = { ...this.state, ...states };
    const transactions = Object.entries(states).map(([itemId, state]) => this.transaction(itemId, state));
    if (transactions.length) await db.transact(transactions);
  }

  async clear() {
    const transactions = Object.values(this.entityIds).map((entityId) => db.tx.contentStates[entityId].delete());
    if (transactions.length) await db.transact(transactions);
    for (const itemId of Object.keys(this.entityIds)) delete this.entityIds[itemId];
    this.state = {};
  }

  private transaction(itemId: string, state: EntryState) {
    const entityId = this.entityIds[itemId] ?? crypto.randomUUID();
    this.entityIds[itemId] = entityId;
    return db.tx.contentStates[entityId].update({
      userId: this.userId,
      itemId,
      owned: state.owned,
      wishlisted: state.wishlisted,
      versions: encode(state.versions),
      editions: encode(state.editions),
      editionNumbers: encode(state.editionNumbers),
    });
  }
}

const encode = (value: unknown) => (value == null ? undefined : JSON.stringify(value));
const decode = <T>(value?: string) => (value ? (JSON.parse(value) as T) : undefined);

function fromEntity(row: StateEntity): EntryState {
  return {
    owned: row.owned,
    wishlisted: row.wishlisted,
    versions: decode<string[]>(row.versions),
    editions: decode<string[]>(row.editions),
    editionNumbers: decode<Record<string, number>>(row.editionNumbers),
  };
}
