import { Cause, Effect } from "effect";
import type { NavigationError } from "#lib/navigation.ts";
import type { CollectionError } from "./collection-errors.ts";
import { Notifications } from "./notifications.ts";

type ActionError = CollectionError | NavigationError;
type ActionOptions = { success?: string | false };

export const collectionActions = {
  run<A>(effect: Effect.Effect<A, ActionError, Notifications>, options: ActionOptions = {}) {
    return Effect.runFork(reportAction(effect, options).pipe(Effect.provide(Notifications.layer)));
  },
};

export const reportAction = Effect.fn("CollectionActions.report")(function* <A>(
  effect: Effect.Effect<A, ActionError, Notifications>,
  options: ActionOptions = {},
) {
  const notifications = yield* Notifications;
  const { success = "Collection saved." } = options;
  return yield* effect.pipe(
    Effect.tap(() => (success === false ? Effect.void : notifications.success(success))),
    Effect.catch((error) => notifications.error(error.message, error.cause)),
    Effect.catchCause((cause) => {
      // Cancellation is control flow, not a failed action to announce.
      if (Cause.hasInterrupts(cause)) return Effect.failCause(cause);
      return notifications.error("Something unexpected prevented that action. Please try again.", cause);
    }),
  );
});
