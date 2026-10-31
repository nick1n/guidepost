import { Effect, Result, type Schema } from "effect";
import { Database } from "../database.ts";

type Options<T, E> = {
  key: string;
  defaults: T;
  decode: (input: unknown) => Result.Result<T, Schema.SchemaError>;
  error: (operation: "load" | "save", cause: unknown) => E;
};

/** Named preference records with transactional field patches and feature-owned errors. */
export class DexieStore<T extends object, E> {
  private readonly database: Database;

  constructor(
    private readonly options: Options<T, E>,
    name?: string,
  ) {
    this.database = new Database(name);
  }

  private open = Effect.fn("Preferences.open")({ self: this }, function (operation: "load" | "save") {
    return Effect.tryPromise({
      try: async () => {
        if (!this.database.isOpen()) await this.database.open();
        return this.database;
      },
      catch: (cause) => this.options.error(operation, cause),
    });
  });

  load = Effect.fn("Preferences.load")({ self: this }, function* () {
    const db = yield* this.open("load");
    const saved = yield* Effect.tryPromise({
      try: () => db.preferences.get(this.options.key),
      catch: (cause) => this.options.error("load", cause),
    });
    return saved === undefined
      ? { ...this.options.defaults }
      : yield* Effect.fromResult(this.options.decode(saved)).pipe(Effect.mapError((cause) => this.options.error("load", cause)));
  });

  save = Effect.fn("Preferences.save")({ self: this }, function* (patch: Partial<T>) {
    const db = yield* this.open("save");
    yield* Effect.tryPromise({
      try: () =>
        db.transaction("rw", db.preferences, async () => {
          const saved = await db.preferences.get(this.options.key);
          const current = saved === undefined ? this.options.defaults : this.decode(saved);
          // Merge only changed fields so another tab's unrelated preferences survive.
          await db.preferences.put(this.decode({ ...current, ...patch }), this.options.key);
        }),
      catch: (cause) => this.options.error("save", cause),
    });
  });

  // Validation stays synchronous so unrelated async work cannot close the Dexie transaction.
  private decode(input: unknown) {
    const result = this.options.decode(input);
    if (Result.isFailure(result)) throw this.options.error("save", result.failure);
    return result.success;
  }

  close() {
    this.database.close();
  }
}
