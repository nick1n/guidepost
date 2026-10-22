import { Cause, Effect, Layer, Result } from "effect";
import { createContext } from "svelte";
import type { NavigationError } from "#lib/navigation.ts";
import type { CollectionError } from "./collection-errors.ts";
import type { TransferError } from "./collection-transfer.ts";
import type { EditionSelection } from "#lib/catalog-view.ts";
import { collectionKey } from "#lib/types/collection.ts";
import { Notifications } from "../../../app/notifications.ts";

type ActionError = CollectionError | NavigationError | TransferError;
type ActionOptions = { success?: string | false | { message: string; details?: readonly string[] } };
type NamedEdition = { item: { name: string }; edition: { label: string } };

export function editionName({ item, edition }: NamedEdition) {
  return `${item.name} (${edition.label})`;
}

export function wishMessage(target: NamedEdition, wished: boolean) {
  return `${editionName(target)} ${wished ? "added to" : "removed from"} your wishlist.`;
}

export function includedMessage(target: NamedEdition, present: boolean, restoring = false) {
  return `${editionName(target)} ${present ? (restoring ? "restored" : "marked as present") : "marked as missing"}.`;
}

export function copyNumberMessage(target: NamedEdition, copyNumber: number | undefined) {
  return `${editionName(target)} copy number ${copyNumber === undefined ? "cleared" : `set to ${copyNumber}`}.`;
}

export function ownershipMessage(targets: readonly EditionSelection[], owned: boolean) {
  const unique = new Map(targets.map((target) => [collectionKey(target.item.id, target.edition.id), target]));
  const names = [...unique.values()].map(editionName);
  if (!names.length) return false;
  const status = owned ? "owned" : "not owned";
  return names.length > 3
    ? { message: `${names.length} editions marked as ${status}.`, details: names }
    : `${names.join("; ")} marked as ${status}.`;
}

export function createCollectionActions(notifications: Layer.Layer<Notifications>) {
  return {
    run<A>(effect: Effect.Effect<A, ActionError, Notifications>, options: ActionOptions = {}) {
      return Effect.runFork(reportAction(effect, options).pipe(Effect.provide(notifications)));
    },
  };
}

export const [getCollectionActions, setCollectionActions] = createContext<ReturnType<typeof createCollectionActions>>();

export const reportAction = Effect.fn("CollectionActions.report")(function* <A>(
  effect: Effect.Effect<A, ActionError, Notifications>,
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
