import { Cause, Clock, Effect, Queue, Result } from "effect";
import type { Notice } from "../notifications/notifications.ts";

type StorageError = { readonly message: string };
type Store<T, E> = {
  load(): Effect.Effect<T, E>;
  save(patch: Partial<T>): Effect.Effect<void, E>;
  close(): void;
};
type Options<T, E> = {
  defaults: T;
  open: Effect.Effect<Store<T, E>, E>;
  record: (notice: Notice) => void;
  name: string;
  closedError: () => E;
};

/** Device settings stay usable after failures; only explicit edits schedule writes. */
export class PreferenceSession<T extends object, E extends StorageError> {
  #values: T;
  #ready = $state(false);
  #waiting = $state(0);
  #loadError = $state<string>();
  #saveError = $state<string>();
  #failedFields = new Set<string>();
  #pending: Partial<T>[] = [];
  #updates?: Queue.Queue<Partial<T>>;
  #started = false;
  #closed = false;

  constructor(private readonly options: Options<T, E>) {
    this.#values = $state.raw({ ...options.defaults });
  }

  get values(): Readonly<T> {
    return this.#values;
  }

  get ready() {
    return this.#ready;
  }

  get hasPendingChanges() {
    return this.#waiting > 0;
  }

  get loadError() {
    return this.#loadError;
  }

  get saveError() {
    return this.#saveError;
  }

  /** One owner starts this session and interrupts it on unmount. */
  run = Effect.fn("PreferenceSession.run")({ self: this }, function* () {
    if (this.#started) return yield* Effect.die(new Error("Preference session has already started"));
    this.#started = true;
    yield* Effect.scoped(
      Effect.gen({ self: this }, function* () {
        const opened = yield* this.attempt(
          Effect.acquireRelease(this.options.open, (store) => Effect.sync(() => store.close())),
          "load",
        );
        if (!opened.success) {
          this.#ready = true;
          return;
        }
        const store = opened.value;
        const updates = yield* Queue.make<Partial<T>>();
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            this.#updates = undefined;
            Queue.shutdownUnsafe(updates);
          }),
        );
        const saved = yield* this.attempt(
          Effect.suspend(() => store.load()),
          "load",
        );
        // Startup edits take precedence over the older saved snapshot.
        this.#values = Object.assign({}, saved.success ? saved.value : this.#values, ...this.#pending);
        this.#ready = true;
        for (const patch of this.#pending) Queue.offerUnsafe(updates, patch);
        this.#pending = [];
        this.#updates = updates;
        while (true) {
          const patch = yield* Queue.take(updates);
          const saved = yield* this.attempt(
            Effect.suspend(() => store.save(patch)),
            "save",
          );
          for (const field of Object.keys(patch)) {
            if (saved.success) this.#failedFields.delete(field);
            else this.#failedFields.add(field);
          }
          if (this.#failedFields.size === 0) this.#saveError = undefined;
          this.#waiting -= 1;
        }
      }),
    ).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          this.#closed = true;
          this.#pending = [];
          this.#waiting = 0;
        }),
      ),
    );
  });

  save(values: Partial<T>) {
    // Queue a snapshot so later caller mutations cannot alter an accepted edit.
    const patch = { ...values };
    if (Object.keys(patch).length === 0) return;
    this.#values = { ...this.#values, ...patch };
    if (this.#closed) {
      Effect.runFork(this.attempt(Effect.fail(this.options.closedError()), "save"));
      return;
    }
    this.#waiting += 1;
    if (this.#updates) Queue.offerUnsafe(this.#updates, patch);
    else this.#pending.push(patch);
  }

  private attempt<A, R>(action: Effect.Effect<A, E, R>, operation: "load" | "save") {
    return action.pipe(
      Effect.map((value) => ({ success: true as const, value })),
      Effect.catchCause((cause) => {
        if (Cause.hasInterrupts(cause)) return Effect.failCause(cause);
        const error = Cause.findError(cause);
        return Effect.gen({ self: this }, function* () {
          const expected = Result.isSuccess(error) && !Cause.hasDies(cause);
          const message = expected
            ? error.success.message
            : `Something unexpected prevented ${operation === "load" ? "loading" : "saving"} ${this.options.name}. Please try again.`;
          if (operation === "load") this.#loadError = message;
          else this.#saveError = message;
          this.options.record({ kind: "error", message, timestamp: yield* Clock.currentTimeMillis });
          yield* Effect.logError(`${this.options.name} storage failed`, cause);
          return { success: false as const };
        });
      }),
    );
  }
}
