import Dexie, { type Table } from "dexie";

/** Device preferences use named records, without owner-scoped collection data. */
export class PreferenceDatabase extends Dexie {
  readonly preferences: Table<unknown, string>;

  constructor(name: string) {
    super(name, { autoOpen: false });
    this.version(1).stores({ preferences: "" });
    this.preferences = this.table("preferences");
  }
}
