import { it, expect } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Layer } from "effect";
import { NavigationError } from "../src/lib/navigation.ts";
import { CollectionError } from "../src/lib/state/collection-errors.ts";
import { reportAction } from "../src/lib/state/collection-actions.ts";
import { Notifications } from "../src/lib/state/notifications.ts";

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

for (const error of [
  new CollectionError({ message: "Collection failed", operation: "save", itemIds: ["core"], cause: "quota" }),
  new NavigationError({ message: "Navigation failed", cause: "network" }),
]) {
  it.effect(`reports ${error._tag} without a success notification`, () =>
    Effect.gen(function* () {
      const f = notifications();
      yield* reportAction(Effect.fail(error)).pipe(Effect.provide(f.layer));
      expect(f.messages).toEqual([{ kind: "error", message: error.message, cause: error.cause }]);
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
