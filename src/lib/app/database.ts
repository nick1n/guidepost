import Dexie, { type Table } from "dexie";
import { Schema } from "effect";
import { EntryStateSchema } from "#lib/types/index.ts";

export const EntryRow = Schema.Struct({
  id: Schema.String,
  ownerId: Schema.String,
  contentId: Schema.NonEmptyString,
  editionId: Schema.NonEmptyString,
  state: EntryStateSchema,
});
export interface EntryRow extends Schema.Schema.Type<typeof EntryRow> {}

export const Metadata = Schema.Struct({
  ownerId: Schema.String,
  schemaVersion: Schema.Literal(1),
  revision: Schema.String,
});
export interface Metadata extends Schema.Schema.Type<typeof Metadata> {}

/** Shared storage schema; adapters own their connections and transaction boundaries. */
export class Database extends Dexie {
  readonly entries: Table<EntryRow, string>;
  readonly metadata: Table<Metadata, string>;
  readonly preferences: Table<unknown, string>;

  constructor(name = "guidepost") {
    super(name, { autoOpen: false });
    this.version(1).stores({ entries: "id, ownerId", metadata: "ownerId", preferences: "" });
    this.entries = this.table("entries");
    this.metadata = this.table("metadata");
    this.preferences = this.table("preferences");
  }
}
