import { Effect } from "effect";
import { PreferenceDatabase } from "#lib/app/preferences/preference-database.ts";
import { decodeHuntRecord, huntDefaults, HuntStorageError, HuntValues, type HuntPreferenceStore } from "./preference-store.ts";

const decode = decodeHuntRecord;

/** Device preferences are separate from owner-scoped collection snapshots. */
export class DexieHuntStore implements HuntPreferenceStore {
  private readonly database: PreferenceDatabase;

  constructor(name = "guidepost-preferences") {
    this.database = new PreferenceDatabase(name);
  }

  private open = Effect.fn("DexieHuntStore.open")({ self: this }, function (operation: HuntStorageError["operation"]) {
    return Effect.tryPromise({
      try: async () => {
        if (!this.database.isOpen()) await this.database.open();
        return this.database;
      },
      catch: (cause) => new HuntStorageError({ operation, cause }),
    });
  });

  load = Effect.fn("DexieHuntStore.load")({ self: this }, function* () {
    const db = yield* this.open("load");
    return yield* Effect.tryPromise({
      try: async () => {
        const saved = await db.preferences.get("hunt");
        return saved === undefined ? { ...huntDefaults } : decode(saved);
      },
      catch: (cause) => new HuntStorageError({ operation: "load", cause }),
    });
  });

  save = Effect.fn("DexieHuntStore.save")({ self: this }, function* (patch: Partial<HuntValues>) {
    const db = yield* this.open("save");
    yield* Effect.tryPromise({
      try: () =>
        db.transaction("rw", db.preferences, async () => {
          const saved = await db.preferences.get("hunt");
          const current = saved === undefined ? huntDefaults : decode(saved);
          // Merge only changed fields so another tab's unrelated preferences survive.
          await db.preferences.put(decode({ ...current, ...patch }), "hunt");
        }),
      catch: (cause) => new HuntStorageError({ operation: "save", cause }),
    });
  });

  close() {
    this.database.close();
  }
}
