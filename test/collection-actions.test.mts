import { it, expect } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Logger, Result } from "effect";
import { NavigationError } from "#lib/navigation.ts";
import { CollectionError } from "#lib/state/collection-errors.ts";
import { reportAction } from "#lib/state/collection-actions.ts";
import { Notifications } from "#lib/state/notifications.ts";
import { TransferError } from "#lib/state/collection-transfer.ts";

function notifications() {
  const messages: { kind: "success" | "error"; message: string; cause?: unknown }[] = [];
  const layer = Layer.succeed(Notifications, {
    success: (message) =>
      Effect.sync(() => {
        messages.push({ kind: "success", message });
      }),
    error: (message, cause) =>
      Effect.sync(() => {
        messages.push({ kind: "error", message, cause });
      }),
  });
  return { messages, layer };
}

it.effect("reports success once and preserves the result", () =>
  Effect.gen(function* () {
    const f = notifications();
    const result = yield* reportAction(Effect.succeed(42)).pipe(Effect.provide(f.layer));
    expect(result).toBe(42);
    expect(f.messages).toEqual([{ kind: "success", message: "Collection saved." }]);
  }),
);

it.effect("startup can suppress success notifications", () =>
  Effect.gen(function* () {
    const f = notifications();
    yield* reportAction(Effect.void, { success: false }).pipe(Effect.provide(f.layer));
    expect(f.messages).toEqual([]);
  }),
);

it.effect("the default notification service writes structured Effect logs", () => {
  const logs: { logLevel: string; message: unknown }[] = [];
  const logger = Logger.make<unknown, void>((event) => {
    logs.push({ logLevel: event.logLevel, message: event.message });
  });

  return Effect.gen(function* () {
    const notifications = yield* Notifications;
    yield* notifications.success("Collection saved.");
    yield* notifications.error("Collection failed", { _tag: "CollectionError", operation: "save" });

    expect(logs).toEqual([
      { logLevel: "Info", message: ["Collection saved.", { action: "success" }] },
      {
        logLevel: "Error",
        message: ["Collection failed", { action: "failure", cause: { _tag: "CollectionError", operation: "save" } }],
      },
    ]);
  }).pipe(Effect.provide(Notifications.layer), Effect.provide(Logger.layer([logger])));
});

for (const error of [
  new CollectionError({ message: "Collection failed", operation: "save", itemIds: ["core"], cause: "quota" }),
  new NavigationError({ message: "Navigation failed", cause: "network" }),
  new TransferError({ message: "Import failed", operation: "import", reason: "invalid-data" }),
]) {
  it.effect(`reports ${error._tag} without a success notification`, () =>
    Effect.gen(function* () {
      const f = notifications();
      yield* reportAction(Effect.fail(error)).pipe(Effect.provide(f.layer));
      expect(f.messages).toEqual([{ kind: "error", message: error.message, cause: error }]);
    }),
  );
}

it.effect("reports unexpected defects", () =>
  Effect.gen(function* () {
    const f = notifications();
    yield* reportAction(Effect.die("unexpected")).pipe(Effect.provide(f.layer));
    expect(f.messages).toHaveLength(1);
    expect(f.messages[0].kind).toBe("error");
    expect(f.messages[0].message).toContain("Something unexpected");
  }),
);

for (const other of [Cause.interrupt(123), Cause.die("unexpected")]) {
  it.effect(`preserves a typed failure combined with ${Cause.hasInterrupts(other) ? "interruption" : "a defect"}`, () =>
    Effect.gen(function* () {
      const f = notifications();
      const error = new CollectionError({ message: "Save failed", operation: "save", itemIds: [], cause: "quota" });
      const cause = Cause.combine(Cause.fail(error), other);
      const result = yield* Effect.exit(reportAction(Effect.failCause(cause)).pipe(Effect.provide(f.layer)));
      if (Cause.hasInterrupts(other)) {
        expect(Exit.isFailure(result) && Cause.hasInterrupts(result.cause)).toBe(true);
        expect(f.messages).toEqual([]);
      } else {
        expect(f.messages).toHaveLength(1);
        expect(f.messages[0].message).toContain("Something unexpected");
        const logged = f.messages[0].cause;
        expect(Cause.isCause(logged)).toBe(true);
        if (Cause.isCause(logged)) {
          expect(Cause.findError(logged)).toEqual(Result.succeed(error));
          expect(Cause.findDefect(logged)).toEqual(Result.succeed("unexpected"));
        }
      }
    }),
  );
}

it.effect("preserves interruption without notifying and still finalizes", () =>
  Effect.gen(function* () {
    const f = notifications();
    const started = yield* Deferred.make<void>();
    const finalized = yield* Deferred.make<void>();
    const action = Deferred.succeed(started, undefined).pipe(
      Effect.andThen(Effect.never),
      Effect.ensuring(Deferred.succeed(finalized, undefined)),
    );
    const fiber = yield* Effect.forkChild(reportAction(action).pipe(Effect.provide(f.layer)));
    yield* Deferred.await(started);
    yield* Fiber.interrupt(fiber);
    const result = yield* Fiber.await(fiber);
    expect(Exit.isFailure(result) && Cause.hasInterrupts(result.cause)).toBe(true);
    expect(yield* Deferred.isDone(finalized)).toBe(true);
    expect(f.messages).toEqual([]);
  }),
);
