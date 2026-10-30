import { Cause, Effect, Fiber, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { loadCatalog, type CatalogLoadError } from "./catalog-loader.ts";
import type { Collection } from "./state/collection.svelte.ts";

type LoadState = { status: "idle" | "pending" } | { status: "failed"; error?: CatalogLoadError };

/** One mounted collection route's catalog request, independent of saved collection startup. */
export class CatalogSession {
  private state = $state.raw<LoadState>({ status: "idle" });
  private disposed = false;
  private attempt?: Fiber.Fiber<unknown, unknown>;
  private readonly collection: Collection;

  constructor(collection: Collection) {
    this.collection = collection;
  }

  get pending() {
    return this.state.status === "pending";
  }

  get failed() {
    return this.state.status === "failed";
  }

  get error() {
    return this.state.status === "failed" ? this.state.error : undefined;
  }

  load = Effect.fn("CatalogSession.load")({ self: this }, function* (url: string) {
    if (this.disposed) return yield* Effect.interrupt;
    if (this.pending || this.collection.hasCatalog) return;
    yield* Effect.acquireUseRelease(
      Effect.withFiber((fiber) =>
        Effect.sync(() => {
          this.attempt = fiber;
          this.state = { status: "pending" };
        }),
      ),
      () =>
        loadCatalog(url).pipe(
          Effect.provide(FetchHttpClient.layer),
          Effect.flatMap((catalog) =>
            Effect.suspend(() => {
              if (this.disposed) return Effect.interrupt;
              if (!this.collection.hasCatalog) this.collection.setCatalog(catalog);
              return Effect.void;
            }),
          ),
          Effect.catchCause((cause) => {
            if (this.disposed) return Effect.interrupt;
            if (Cause.hasInterrupts(cause)) return Effect.failCause(cause);
            if (Cause.hasDies(cause)) {
              this.state = { status: "failed" };
              return Effect.failCause(cause);
            }
            const error = Cause.findError(cause);
            this.state = { status: "failed", error: Result.isSuccess(error) ? error.success : undefined };
            return Effect.failCause(cause);
          }),
        ),
      () =>
        Effect.sync(() => {
          this.attempt = undefined;
          if (this.pending) this.state = { status: "idle" };
        }),
    );
  });

  dispose = Effect.fn("CatalogSession.dispose")({ self: this }, function* () {
    this.disposed = true;
    this.state = { status: "idle" };
    if (this.attempt) yield* Fiber.interrupt(this.attempt);
  });
}
