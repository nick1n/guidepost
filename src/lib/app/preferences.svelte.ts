import { Cause, Clock, Effect, Queue, Result } from "effect";
import type { Notice } from "./notifications.ts";
import { appDefaults, AppStorageError, type AppPreferenceStore, type AppValues, type DateFormat } from "./preference-store.ts";

const openStore = Effect.fn("AppPreferences.openStore")(function* () {
  const { DexieAppStore } = yield* Effect.tryPromise({
    try: () => import("./dexie-preference-store.ts"),
    catch: (cause) => new AppStorageError({ operation: "load", cause }),
  });
  return new DexieAppStore();
});

export class AppPreferences {
  dateFormat = $state<DateFormat>(appDefaults.dateFormat);
  glass = $state<boolean | null>(appDefaults.glass);
  ready = $state(false);
  #waiting = $state(0);
  #pending: Partial<AppValues>[] = [];
  #updates?: Queue.Queue<Partial<AppValues>>;
  #closed = false;

  constructor(
    private readonly record: (notice: Notice) => void = () => {},
    private readonly open: Effect.Effect<AppPreferenceStore, AppStorageError> = openStore(),
  ) {}

  get hasPendingChanges() {
    return this.#waiting > 0;
  }

  /** Browser initialization owns the queue and closes the store on interruption. */
  run = Effect.fn("AppPreferences.run")({ self: this }, function () {
    return Effect.scoped(
      Effect.gen({ self: this }, function* () {
        const store = yield* Effect.acquireRelease(this.open, (store) => Effect.sync(() => store.close()));
        const updates = yield* Queue.make<Partial<AppValues>>();
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            this.#updates = undefined;
            Queue.shutdownUnsafe(updates);
          }),
        );
        const saved = yield* this.report(store.load());
        // Changes made during startup take precedence over the stored snapshot.
        Object.assign(this, saved, ...this.#pending);
        this.ready = true;
        for (const patch of this.#pending) Queue.offerUnsafe(updates, patch);
        this.#pending = [];
        this.#updates = updates;
        while (true) {
          const patch = yield* Queue.take(updates);
          yield* this.report(store.save(patch));
          this.#waiting -= 1;
        }
      }),
    ).pipe(
      (session) => this.report(session),
      Effect.tap(() => Effect.sync(() => (this.ready = true))),
      Effect.ensuring(
        Effect.sync(() => {
          this.#closed = true;
          this.#waiting = 0;
        }),
      ),
    );
  });

  save(patch: Partial<AppValues>) {
    Object.assign(this, patch);
    if (this.#closed) {
      Effect.runFork(this.report(Effect.fail(new AppStorageError({ operation: "save", cause: "Storage session is closed" }))));
      return;
    }
    this.#waiting += 1;
    if (this.#updates) Queue.offerUnsafe(this.#updates, patch);
    else this.#pending.push(patch);
  }

  private report<A>(action: Effect.Effect<A, AppStorageError>) {
    return action.pipe(
      Effect.catchCause((cause) => {
        if (Cause.hasInterrupts(cause)) return Effect.failCause(cause);
        const error = Cause.findError(cause);
        return Effect.gen({ self: this }, function* () {
          const expected = Result.isSuccess(error) && !Cause.hasDies(cause);
          this.record({
            kind: "error",
            message: expected ? error.success.message : "Something unexpected prevented saving app preferences. Please try again.",
            timestamp: yield* Clock.currentTimeMillis,
          });
          yield* Effect.logError("App preferences storage failed", cause);
        });
      }),
    );
  }
}
