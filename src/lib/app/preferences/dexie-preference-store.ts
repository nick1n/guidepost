import { Effect, Result } from "effect";
import { PreferenceDatabase } from "./preference-database.ts";
import { decodeAppRecord, appDefaults, AppStorageError, AppValues, type AppPreferenceStore } from "./preference-store.ts";

// Dexie transactions need synchronous validation so no unrelated async work can close them.
function decode(input: unknown) {
  const result = decodeAppRecord(input);
  if (Result.isFailure(result)) throw new AppStorageError({ operation: "save", cause: result.failure });
  return result.success;
}

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
    const saved = yield* Effect.tryPromise({
      try: () => db.preferences.get("app"),
      catch: (cause) => new AppStorageError({ operation: "load", cause }),
    });
    return saved === undefined
      ? { ...appDefaults }
      : yield* Effect.fromResult(decodeAppRecord(saved)).pipe(
          Effect.mapError((cause) => new AppStorageError({ operation: "load", cause })),
        );
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
