import { Effect, Schema } from "effect";

export class ResetError extends Schema.TaggedError<ResetError>()("ResetError", {
  message: Schema.String,
  cause: Schema.Defect(),
}) {}

const storageError = (cause: unknown) =>
  new ResetError({ message: "Could not delete all saved data. Close other Guidepost tabs and try again, or reload this page.", cause });

const deleteDatabase = Effect.fn("SavedData.deleteDatabase")(function* (name: string) {
  const request = yield* Effect.try({ try: () => indexedDB.deleteDatabase(name), catch: storageError });
  return yield* Effect.callback<void, ResetError>((resume) => {
    request.onsuccess = () => resume(Effect.void);
    request.onerror = () => resume(Effect.fail(storageError(request.error)));
    request.onblocked = () => resume(Effect.fail(storageError("Close other Guidepost tabs, then try again.")));
  }).pipe(
    // IndexedDB deletion cannot be cancelled; detach listeners whenever this waiter ends.
    Effect.ensuring(
      Effect.sync(() => {
        request.onsuccess = null;
        request.onerror = null;
        request.onblocked = null;
      }),
    ),
  );
});

/** Called only after storage sessions stop. Includes retired databases for this origin. */
export const deleteDatabases = Effect.fn("SavedData.deleteDatabases")(function* () {
  const { default: Dexie } = yield* Effect.tryPromise({ try: () => import("dexie"), catch: storageError });
  const names = yield* Effect.tryPromise({ try: () => Dexie.getDatabaseNames(), catch: storageError });
  yield* Effect.forEach(names, deleteDatabase, { concurrency: "unbounded", discard: true });
});

export const resetSavedData = Effect.fn("SavedData.reset")(function* (options: {
  prepare: Effect.Effect<void>;
  stop: Effect.Effect<void>;
  reload: Effect.Effect<void>;
}) {
  yield* options.prepare;
  yield* options.stop;
  yield* deleteDatabases();
  yield* options.reload;
});
