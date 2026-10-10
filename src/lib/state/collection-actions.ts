import { Cause, Effect, Result } from "effect";
import type { NavigationError } from "#lib/navigation.ts";
import type { CollectionError } from "./collection-errors.ts";
import type { TransferError } from "./collection-transfer.ts";
import { Notifications } from "./notifications.ts";

type ActionError = CollectionError | NavigationError | TransferError;
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
    Effect.catchCause((cause) => {
      // Cancellation is control flow, not a failed action to announce.
      if (Cause.hasInterrupts(cause)) return Effect.failCause(cause);
      const error = Cause.findError(cause);
      if (Result.isSuccess(error) && !Cause.hasDies(cause)) return notifications.error(error.success.message, error.success);
      return notifications.error("Something unexpected prevented that action. Please try again.", cause);
    }),
  );
});
