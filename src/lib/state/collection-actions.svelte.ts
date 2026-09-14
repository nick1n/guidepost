import { Effect } from "effect";
import type { CollectionError } from "./collection.svelte.ts";

type ActionError = Pick<CollectionError, "message" | "cause"> & Partial<Pick<CollectionError, "operation">>;

function reportUnexpected(cause: unknown) {
  console.error("Unexpected collection action failure", cause);
}

class CollectionActions {
  error = $state.raw<ActionError | undefined>();

  run<A>(effect: Effect.Effect<A, CollectionError>) {
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
