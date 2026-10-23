import { createContext } from "svelte";
import { Cause, Clock, Effect, Queue, Result } from "effect";
import type { Notice } from "#lib/app/notifications.ts";
import { huntDefaults, HuntStorageError, type HuntOption, type HuntPreferenceStore, type HuntValues } from "./preference-store.ts";

const openStore = Effect.fn("HuntPreferences.openStore")(function* () {
  const { DexieHuntStore } = yield* Effect.tryPromise({
    try: () => import("./dexie-store.ts"),
    catch: (cause) => new HuntStorageError({ operation: "load", cause }),
  });
  return new DexieHuntStore();
});

export class HuntPreferences {
  ready = $state(false);
  option = $state<HuntOption>(huntDefaults.option);
  bravadoBeta = $state(huntDefaults.bravadoBeta);
  devilSatan = $state(huntDefaults.devilSatan);
  gregalopeCE = $state(huntDefaults.gregalopeCE);
  #waiting = $state(0);
  #pending: Partial<HuntValues>[] = [];
  #updates?: Queue.Queue<Partial<HuntValues>>;
  #closed = false;

  constructor(
    private readonly record: (notice: Notice) => void = () => {},
    private readonly open: Effect.Effect<HuntPreferenceStore, HuntStorageError> = openStore(),
  ) {}

  get hasPendingChanges() {
    return this.#waiting > 0;
  }

  /** The root layout owns this browser-only session and interrupts it on unmount. */
  run = Effect.fn("HuntPreferences.run")({ self: this }, function () {
    return Effect.scoped(
      Effect.gen({ self: this }, function* () {
        const store = yield* Effect.acquireRelease(this.open, (store) => Effect.sync(() => store.close()));
        const updates = yield* Queue.make<Partial<HuntValues>>();
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            this.#updates = undefined;
            Queue.shutdownUnsafe(updates);
          }),
        );
        const saved = yield* this.report(store.load());
        // Edits made during startup take precedence over the older stored snapshot.
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

  setOption(value: string) {
    if (value !== "fen" && value !== "kekasi" && value !== "ccg") return;
    this.save({ option: value });
  }

  setBravadoBeta(value: boolean) {
    this.save({ bravadoBeta: value });
  }

  setDevilSatan(value: boolean) {
    this.save({ devilSatan: value });
  }

  setGregalopeCE(value: boolean) {
    this.save({ gregalopeCE: value });
  }

  private save(patch: Partial<HuntValues>) {
    Object.assign(this, patch);
    if (this.#closed) {
      Effect.runFork(this.report(Effect.fail(new HuntStorageError({ operation: "save", cause: "Storage session is closed" }))));
      return;
    }
    this.#waiting += 1;
    if (this.#updates) Queue.offerUnsafe(this.#updates, patch);
    else this.#pending.push(patch);
  }

  private report<A>(action: Effect.Effect<A, HuntStorageError>) {
    return action.pipe(
      Effect.catchCause((cause) => {
        if (Cause.hasInterrupts(cause)) return Effect.failCause(cause);
        const error = Cause.findError(cause);
        return Effect.gen({ self: this }, function* () {
          const expected = Result.isSuccess(error) && !Cause.hasDies(cause);
          this.record({
            kind: "error",
            message: expected ? error.success.message : "Something unexpected prevented saving hunt preferences. Please try again.",
            timestamp: yield* Clock.currentTimeMillis,
          });
          yield* Effect.logError("Hunt preferences storage failed", cause);
        });
      }),
    );
  }
}

export const [getHuntPreferences, setHuntPreferences] = createContext<HuntPreferences>();
