import { Effect, Schema } from "effect";
import { PreferenceDatabase } from "./preference-database.ts";
import { appDefaults, AppStorageError, AppValues, type AppPreferenceStore } from "./preference-store.ts";

const decode = Schema.decodeUnknownSync(AppValues);

export class DexieAppStore implements AppPreferenceStore {
  private readonly database: PreferenceDatabase;

  constructor(name = "guidepost-preferences") {
    this.database = new PreferenceDatabase(name);
  }

  private open = Effect.fn("DexieAppStore.open")({ self: this }, function (operation: AppStorageError["operation"]) {
    return Effect.tryPromise({
      try: async () => {
        if (!this.database.isOpen()) await this.database.open();
        return this.database;
      },
      catch: (cause) => new AppStorageError({ operation, cause }),
    });
  });

  load = Effect.fn("DexieAppStore.load")({ self: this }, function* () {
    const db = yield* this.open("load");
    return yield* Effect.tryPromise({
      try: async () => {
        const saved = await db.preferences.get("app");
        return saved === undefined ? { ...appDefaults } : decode(saved);
      },
      catch: (cause) => new AppStorageError({ operation: "load", cause }),
    });
  });

  save = Effect.fn("DexieAppStore.save")({ self: this }, function* (patch: Partial<AppValues>) {
    const db = yield* this.open("save");
    yield* Effect.tryPromise({
      try: () =>
        db.transaction("rw", db.preferences, async () => {
          const saved = await db.preferences.get("app");
          const current = saved === undefined ? appDefaults : decode(saved);
          await db.preferences.put(decode({ ...current, ...patch }), "app");
        }),
      catch: (cause) => new AppStorageError({ operation: "save", cause }),
    });
  });

  close() {
    this.database.close();
  }
}
