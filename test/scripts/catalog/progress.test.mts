import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Exit, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { withProgress } from "#scripts/catalog/progress.mts";

it.effect.each(["success", "failure", "interruption"] as const)("clears the fetch animation and stops updates after %s", (outcome) =>
  Effect.gen(function* () {
    const entered = yield* Deferred.make<void>();
    const finish = yield* Deferred.make<void, string>();
    const writes: string[] = [];
    const output = { isTTY: true, columns: 100, write: (text: string) => writes.push(text) };
    const work = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(finish)));
    const progress = withProgress("Fetching https://example.com/products.json", work, { output });
    expect(writes).toEqual([]);
    const fiber = yield* Effect.forkChild(progress);
    yield* Deferred.await(entered);
    expect(writes[0]).toContain("| Fetching https://example.com/products.json");
    yield* TestClock.adjust(100);
    expect(writes.at(-1)).toContain("/ Fetching https://example.com/products.json");
    if (outcome === "interruption") yield* Fiber.interrupt(fiber);
    else if (outcome === "failure") yield* Deferred.fail(finish, "unavailable");
    else yield* Deferred.succeed(finish, undefined);
    const exit = yield* Fiber.await(fiber);
    expect(Exit.isSuccess(exit)).toBe(outcome === "success");
    expect(writes.at(-1)).toBe("\r\x1b[2K");
    const count = writes.length;
    yield* TestClock.adjust(1_000);
    expect(writes).toHaveLength(count);
  }),
);

it.effect("counts down a wait and keeps animation lines within the terminal width", () =>
  Effect.gen(function* () {
    const entered = yield* Deferred.make<void>();
    const finish = yield* Deferred.make<void>();
    const writes: string[] = [];
    const output = { isTTY: true, columns: 40, write: (text: string) => writes.push(text) };
    const fiber = yield* withProgress(
      "https://example.com/a-long-product-listing",
      Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(finish))),
      { wait: 2_000, output },
    ).pipe(Effect.forkChild);
    yield* Deferred.await(entered);
    expect(writes[0]).toContain("Waiting 2s:");
    yield* TestClock.adjust(1_000);
    expect(writes.at(-1)).toContain("Waiting 1s:");
    for (const line of writes) expect(line.replace("\r\x1b[2K", "").length).toBeLessThan(40);
    yield* Deferred.succeed(finish, undefined);
    yield* Fiber.join(fiber);
  }),
);

it.effect("does not animate redirected output and preserves the result", () =>
  Effect.gen(function* () {
    const writes: string[] = [];
    const output = { isTTY: false, write: (text: string) => writes.push(text) };
    const result = yield* withProgress("Fetching", Effect.succeed(42), { output });
    expect(result).toBe(42);
    expect(writes).toEqual([]);
  }),
);
