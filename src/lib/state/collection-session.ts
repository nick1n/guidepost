import { Effect, Fiber, Queue, type Scope } from "effect";
import type { Collection } from "./collection.svelte.ts";
import { CollectionError } from "./collection-errors.ts";
import { reportAction } from "./collection-actions.ts";
import type { CollectionStore } from "./stores.ts";

type OpenStore = (ownerId: string) => Effect.Effect<CollectionStore, CollectionError, Scope.Scope>;

const openStore: OpenStore = Effect.fn("CollectionSession.openStore")(function* (ownerId: string) {
  const { DexieStore } = yield* Effect.tryPromise({
    try: () => import("./dexie-store.ts"),
    catch: (cause) =>
      new CollectionError({
        operation: "load",
        itemIds: [],
        message: "Collection storage could not be started. Reload the page and try again.",
        cause,
      }),
  });
  return yield* Effect.acquireRelease(DexieStore.make(ownerId), (store) => Effect.sync(() => store.close()));
});

/** One mounted app's storage and monitoring lifetime. Readiness comes from Svelte; resources belong to the scope. */
export class CollectionSession {
  private enabled = false;
  private updates?: Queue.Queue<boolean>;

  constructor(
    private readonly collection: Collection,
    private readonly open: OpenStore = openStore,
  ) {}

  monitor(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (this.updates) Queue.offerUnsafe(this.updates, enabled);
  }

  run = Effect.fn("CollectionSession.run")({ self: this }, function (ownerId: string) {
    return Effect.scoped(
      Effect.gen({ self: this }, function* () {
        this.collection.setUser(ownerId);
        const store = yield* this.open(ownerId).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              this.collection.loadError = error;
              this.collection.loadStatus = "error";
            }),
          ),
        );
        const updates = yield* Queue.make<boolean>();
        this.updates = updates;
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            this.updates = undefined;
            Queue.shutdownUnsafe(updates);
          }),
        );
        Queue.offerUnsafe(updates, this.enabled);
        // Register monitoring after storage so scoped shutdown waits for subscriptions before closing storage.
        yield* Effect.gen({ self: this }, function* () {
          let observation: Fiber.Fiber<unknown, unknown> | undefined;
          while (true) {
            const enabled = yield* Queue.take(updates);
            if (observation) yield* Fiber.interrupt(observation);
            observation = enabled
              ? yield* reportAction(this.collection.observeChanges(), { success: false }).pipe(Effect.forkScoped)
              : undefined;
          }
        }).pipe(Effect.forkScoped);
        // A failed snapshot load keeps the opened store alive for an explicit retry.
        yield* reportAction(this.collection.setStore(store), { success: false });
        yield* Effect.never;
      }),
    );
  });
}
