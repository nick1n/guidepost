import { it, expect } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Logger, Result } from "effect";
import { TestClock } from "effect/testing";
import { NavigationError } from "#lib/navigation.ts";
import { CollectionError } from "#lib/state/collection-errors.ts";
import {
  copyNumberMessage,
  createCollectionActions,
  editionName,
  includedMessage,
  ownershipMessage,
  reportAction,
  wishMessage,
} from "#lib/state/collection-actions.ts";
import type { EditionSelection } from "#lib/catalog-view.ts";
import { Notifications, type Notice } from "#lib/state/notifications.ts";
import { TransferError } from "#lib/state/collection-transfer.ts";

function notifications() {
  const messages: { kind: "success" | "error"; message: string; details?: readonly string[]; cause?: unknown }[] = [];
  const layer = Layer.succeed(Notifications, {
    success: (message, details) =>
      Effect.sync(() => {
        messages.push({ kind: "success", message, ...(details && { details }) });
      }),
    error: (message, cause) =>
      Effect.sync(() => {
        messages.push({ kind: "error", message, cause });
      }),
  });
  return { messages, layer };
}

function selection(
  id: string,
  name: string,
  editionId = "original",
  label: EditionSelection["edition"]["label"] = "Original",
): EditionSelection {
  return {
    item: { id, name, tags: [], category: "content" },
    edition: { id: editionId, label, format: "physical" },
  };
}

it("names editions using only an item name and edition label", () => {
  expect(editionName({ item: { name: "Kingdom Death: Monster" }, edition: { label: "1.6" } })).toBe("Kingdom Death: Monster (1.6)");
  expect(editionName(selection("model", "Model", "encore", "Encore"))).toBe("Model (Encore)");
});

it("names editions added to and removed from the wishlist", () => {
  const target = selection("model", "Model", "encore", "Encore");
  expect(wishMessage(target, true)).toBe("Model (Encore) added to your wishlist.");
  expect(wishMessage(target, false)).toBe("Model (Encore) removed from your wishlist.");
});

it("names included editions marked present, missing, or restored", () => {
  const target = selection("model", "Model", "encore", "Encore");
  expect(includedMessage(target, true)).toBe("Model (Encore) marked as present.");
  expect(includedMessage(target, false)).toBe("Model (Encore) marked as missing.");
  expect(includedMessage(target, true, true)).toBe("Model (Encore) restored.");
  expect(includedMessage(target, false, true)).toBe("Model (Encore) marked as missing.");
});

it("names editions when setting or clearing their copy number", () => {
  const target = selection("model", "Model", "encore", "Encore");
  expect(copyNumberMessage(target, 1)).toBe("Model (Encore) copy number set to 1.");
  expect(copyNumberMessage(target, 9999)).toBe("Model (Encore) copy number set to 9999.");
  expect(copyNumberMessage(target, undefined)).toBe("Model (Encore) copy number cleared.");
});

it("empty ownership actions have no success message", () => {
  expect(ownershipMessage([], true)).toBe(false);
  expect(ownershipMessage([], false)).toBe(false);
});

for (const owned of [false, true]) {
  const status = owned ? "owned" : "not owned";
  it(`names a single edition marked as ${status}`, () => {
    expect(ownershipMessage([selection("core", "Core")], owned)).toBe(`Core (Original) marked as ${status}.`);
  });

  it(`names up to three unique editions marked as ${status}`, () => {
    const first = selection("core", "Core");
    expect(ownershipMessage([first, { ...first }, selection("king", "Dragon King"), selection("lion", "Lion Knight")], owned)).toBe(
      `Core (Original); Dragon King (Original); Lion Knight (Original) marked as ${status}.`,
    );
  });

  it(`summarizes bulk editions marked as ${status} while retaining their names`, () => {
    const first = selection("core", "Core");
    const targets = [first, selection("king", "Dragon King"), selection("lion", "Lion Knight"), selection("sun", "Sunstalker")];
    expect(ownershipMessage([...targets, { ...first }], owned)).toEqual({
      message: `4 editions marked as ${status}.`,
      details: ["Core (Original)", "Dragon King (Original)", "Lion Knight (Original)", "Sunstalker (Original)"],
    });
  });
}

it("ownership messages deduplicate by item and edition identity rather than display names", () => {
  const first = selection("first", "Model");
  expect(ownershipMessage([first, { ...first }, selection("second", "Model"), selection("first", "Model", "encore", "Encore")], true)).toBe(
    "Model (Original); Model (Original); Model (Encore) marked as owned.",
  );
});

it.effect("reports success once and preserves the result", () =>
  Effect.gen(function* () {
    const f = notifications();
    const result = yield* reportAction(Effect.succeed(42), { success: "Core (1.6) marked as owned." }).pipe(Effect.provide(f.layer));
    expect(result).toBe(42);
    expect(f.messages).toEqual([{ kind: "success", message: "Core (1.6) marked as owned." }]);
  }),
);

for (const changed of [false, true]) {
  it.effect(`a ${changed ? "changed" : "unchanged"} action ${changed ? "announces success" : "stays silent"}`, () =>
    Effect.gen(function* () {
      const f = notifications();
      const result = yield* reportAction(Effect.succeed(changed), { success: "Core saved." }).pipe(Effect.provide(f.layer));
      expect(result).toBe(changed);
      expect(f.messages).toEqual(changed ? [{ kind: "success", message: "Core saved." }] : []);
    }),
  );
}

it.effect("passes bulk success details to the notification service", () =>
  Effect.gen(function* () {
    const f = notifications();
    const details = ["Core (1.6)", "Dragon King (Original)"];
    yield* reportAction(Effect.succeed(true), { success: { message: "Editions saved.", details } }).pipe(Effect.provide(f.layer));
    expect(f.messages).toEqual([{ kind: "success", message: "Editions saved.", details }]);
  }),
);

it.effect("actions without a specific success message stay silent", () =>
  Effect.gen(function* () {
    const f = notifications();
    yield* reportAction(Effect.void).pipe(Effect.provide(f.layer));
    expect(f.messages).toEqual([]);
  }),
);

it.effect("records timestamped actions for the injected session without announcing startup or interruptions", () =>
  Effect.gen(function* () {
    const notices: Notice[] = [];
    const layer = Notifications.layerWith((notice) => notices.push(notice));
    yield* TestClock.setTime(1000);
    yield* reportAction(Effect.void, { success: false }).pipe(Effect.provide(layer));
    yield* reportAction(Effect.void, { success: { message: "Core saved.", details: ["Core (1.6)"] } }).pipe(Effect.provide(layer));
    yield* TestClock.adjust(2000);
    const error = new CollectionError({ message: "Save failed", operation: "save", itemIds: [], cause: "quota" });
    yield* reportAction(Effect.fail(error)).pipe(Effect.provide(layer));
    yield* Effect.exit(reportAction(Effect.interrupt).pipe(Effect.provide(layer)));
    expect(notices).toEqual([
      { kind: "success", message: "Core saved.", details: ["Core (1.6)"], timestamp: 1000 },
      { kind: "error", message: "Save failed", timestamp: 3000 },
    ]);
  }),
);

it.effect("action runners keep separate app notification logs", () =>
  Effect.gen(function* () {
    const first: Notice[] = [];
    const second: Notice[] = [];
    const firstActions = createCollectionActions(Notifications.layerWith((notice) => first.push(notice)));
    const secondActions = createCollectionActions(Notifications.layerWith((notice) => second.push(notice)));
    yield* Fiber.join(firstActions.run(Effect.void, { success: "First app saved." }));
    yield* Fiber.join(secondActions.run(Effect.void, { success: "Second app saved." }));
    expect(first.map((notice) => notice.message)).toEqual(["First app saved."]);
    expect(second.map((notice) => notice.message)).toEqual(["Second app saved."]);
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
      yield* reportAction(Effect.fail(error), { success: { message: "Saved.", details: ["Core (1.6)"] } }).pipe(Effect.provide(f.layer));
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
