import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Option, Schema } from "effect";
import { Command, Flag } from "effect/cli";

export const optionalString = (name: string) => Flag.String(name).pipe(Flag.optional, Flag.map(Option.getOrUndefined));
export const offline = Flag.Boolean("offline").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Use saved evidence without internet access (the default)."),
);
export const online = Flag.Boolean("online").pipe(Flag.withDefault(false), Flag.withDescription("Allow internet requests."));
export const refresh = Flag.Boolean("refresh").pipe(Flag.withDefault(false));
export const catalog = optionalString("catalog");

export function offlineMode(values: { online: boolean; offline: boolean; refresh?: boolean }) {
  if (values.online && values.offline) throw new Error("Choose either --online or --offline.");
  if (values.refresh && !values.online) throw new Error("--refresh requires --online; commands use saved evidence by default.");
  return !values.online;
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
  command.pipe(Command.run({ version: "0.1.0" }), Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
