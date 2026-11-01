import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Cause, Effect, Option, Schema } from "effect";
import { Command, Flag } from "effect/cli";
import { CatalogInputError } from "./review/schema.mts";
import { ShopError, ShopRequestError } from "./shop.mts";

export const optionalString = (name: string) => Flag.String(name).pipe(Flag.optional, Flag.map(Option.getOrUndefined));
export const offline = Flag.Boolean("offline").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Use saved evidence without internet access (the default)."),
);
export const fetch = Flag.Boolean("fetch").pipe(Flag.withDefault(false), Flag.withDescription("Download fresh data and update the cache."));
export const catalog = optionalString("catalog");

export function offlineMode(values: { fetch: boolean; offline: boolean }) {
  if (values.fetch && values.offline) throw new Error("Choose either --fetch or --offline.");
  return !values.fetch;
}

export class CommandError extends Schema.TaggedError<CommandError>()("CatalogCommandError", {
  cause: Schema.Defect(),
}) {}

// Promise workflows own publication and checkpoint cleanup. Interruption aborts
// their signal, then waits for settlement before the runtime can exit.
export const workflow = Effect.fn("CatalogCLI.workflow")(<A,>(run: (signal: AbortSignal) => Promise<A>) =>
  Effect.callback<A, CommandError>((resume, signal) => {
    const pending = Promise.resolve().then(() => run(signal));
    pending.then(
      (value) => resume(Effect.succeed(value)),
      (cause) => resume(Effect.fail(new CommandError({ cause }))),
    );
    return Effect.promise(() =>
      pending.then(
        () => undefined,
        () => undefined,
      ),
    );
  }),
);

export function runCommand<Name extends string, Input, ContextInput>(command: Command.Command<Name, Input, ContextInput, CommandError>) {
  command.pipe(
    Command.run({ version: "0.1.0" }),
    Effect.catchCause((cause) => {
      const reason = cause.reasons[0];
      if (cause.reasons.length !== 1 || !reason || !Cause.isFailReason(reason)) return Effect.failCause(cause);
      const error = reason.error;
      if (
        !(error instanceof CommandError) ||
        !(error.cause instanceof CatalogInputError || error.cause instanceof ShopError || error.cause instanceof ShopRequestError)
      )
        return Effect.failCause(cause);
      const message = error.cause.message;
      return Effect.sync(() => {
        console.error(message);
        process.exitCode = 1;
      });
    }),
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
  );
}
