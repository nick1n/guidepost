import { Effect } from "effect";
import type { NavigationError } from "#lib/navigation.ts";
import type { CollectionError } from "./collection-errors.ts";
import { Notifications } from "./notifications.ts";

type ActionError = CollectionError | NavigationError;
type ActionOptions = { success?: string | false };

export const collectionActions = {
  run<A>(effect: Effect.Effect<A, ActionError, Notifications>, options: ActionOptions = {}) {
    const success = options.success ?? "Collection saved.";
    return Effect.runFork(
      effect.pipe(
        Effect.tap(() =>
          success === false ? Effect.void : Effect.flatMap(Notifications, (notifications) => notifications.success(success)),
        ),
        Effect.catch((error) =>
          Effect.gen(function* () {
            const notifications = yield* Notifications;
            yield* notifications.error(error.message, error.cause);
          }),
        ),
        Effect.catchCause((cause) =>
          Effect.gen(function* () {
            const notifications = yield* Notifications;
            yield* notifications.error("Something unexpected prevented that action. Please try again.", cause);
          }),
        ),
        Effect.provide(Notifications.layer),
      ),
    );
  },
};
