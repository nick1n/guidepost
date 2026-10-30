import { Cause, Effect, Layer, Result } from "effect";
import { createContext } from "svelte";
import { Notifications } from "./notifications/notifications.ts";

type ActionError = { readonly _tag: string; readonly message: string };
type ActionOptions = { success?: string | false | { message: string; details?: readonly string[] } };

export function createActions(notifications: Layer.Layer<Notifications>) {
  return {
    run<A, E extends ActionError = ActionError>(effect: Effect.Effect<A, E, Notifications>, options: ActionOptions = {}) {
      return Effect.runFork(reportAction(effect, options).pipe(Effect.provide(notifications)));
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
export const [getActions, setActions] = createContext<Actions>();

export const reportAction = Effect.fn("Actions.report")(function* <A, E extends ActionError = ActionError>(
  effect: Effect.Effect<A, E, Notifications>,
  options: ActionOptions = {},
) {
  const notifications = yield* Notifications;
  const { success = false } = options;
  return yield* effect.pipe(
    Effect.tap((result) => {
      if (result === false || success === false) return Effect.void;
      return typeof success === "string" ? notifications.success(success) : notifications.success(success.message, success.details);
    }),
    Effect.catchCause((cause) => {
      // Cancellation is control flow, not a failed action to announce.
      if (Cause.hasInterrupts(cause)) return Effect.failCause(cause);
      const error = Cause.findError(cause);
      if (Result.isSuccess(error) && !Cause.hasDies(cause)) return notifications.error(error.success.message, error.success);
      return notifications.error("Something unexpected prevented that action. Please try again.", cause);
    }),
  );
});
