import { Effect } from "effect";
import type { CollectionPersistenceError } from "./collection.svelte.ts";

type CollectionActionError = Pick<CollectionPersistenceError, "message" | "cause"> & Partial<Pick<CollectionPersistenceError, "operation">>;

function reportUnexpected(cause: unknown) {
  console.error("Unexpected collection action failure", cause);
}

class CollectionActions {
  error = $state.raw<CollectionActionError | undefined>();

  run<A>(effect: Effect.Effect<A, CollectionPersistenceError>) {
    this.error = undefined;
    Effect.runFork(
      effect.pipe(
        Effect.catch((error) =>
          Effect.sync(() => {
            this.error = error;
          }),
        ),
        Effect.catchCause((cause) =>
          Effect.sync(() => {
            reportUnexpected(cause);
            this.error = {
              message: "Something unexpected prevented that collection change. Please try again.",
              cause,
            };
          }),
        ),
      ),
    );
  }

  dismiss() {
    this.error = undefined;
  }
}

export const collectionActions = new CollectionActions();
