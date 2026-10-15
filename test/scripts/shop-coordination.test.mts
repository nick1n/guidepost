import { expect, it } from "@effect/vitest";
import { Cause, Clock, Deferred, Duration, Effect, Exit, Fiber, Queue } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ShopClient, withShopRequest } from "#scripts/catalog/shop.mts";

const url = "https://shop.kingdomdeath.com/products/coordinated.js";
const now = Date.parse("2026-10-10T00:00:00.000Z");
const directory = Effect.acquireRelease(
  Effect.promise(() => mkdtemp(join(tmpdir(), "guidepost-shop-coordination-"))),
  (cache) => Effect.promise(() => rm(cache, { recursive: true, force: true })),
);
const state = (cache: string) => Effect.promise(() => readFile(join(cache, "last-request.json"), "utf8"));
const missingLock = (cache: string) =>
  Effect.promise(() => readFile(join(cache, "request.lock"), "utf8").catch((error: NodeJS.ErrnoException) => error.code)).pipe(
    Effect.tap((result) => Effect.sync(() => expect(result).toBe("ENOENT"))),
  );

// Filesystem work must reach the pacing sleep before virtual time advances.
const observedClock = Effect.gen(function* () {
  const clock = yield* Clock.clockWith(Effect.succeed);
  const sleeps = yield* Queue.unbounded<number>();
  return {
    clock: {
      ...clock,
      sleep: (duration: Duration.Duration) => Queue.offer(sleeps, Duration.toMillis(duration)).pipe(Effect.andThen(clock.sleep(duration))),
    },
    pacing: Queue.take(sleeps).pipe(Effect.repeat({ until: (duration) => duration === 35_000 })),
  };
});

it.effect.each(["gate", "client"] as const)("coordinates the shared gate and client when %s starts first", (firstKind) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const entered = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const observer = yield* observedClock;
    const starts: string[] = [];
    const gate = (held: boolean) =>
      withShopRequest(
        url,
        (startedAt) =>
          Effect.gen(function* () {
            starts.push("gate");
            expect(startedAt).toBe(firstKind === "gate" ? now : now + 35_000);
            if (held) {
              yield* Deferred.succeed(entered, undefined);
              yield* Deferred.await(release);
            }
          }),
        { cache },
      );
    const client = (held: boolean) => {
      const fetch: typeof globalThis.fetch = () => {
        starts.push("client");
        if (!held) return Promise.resolve(Response.json({}));
        Effect.runSync(Deferred.succeed(entered, undefined));
        return Effect.runPromise(Deferred.await(release).pipe(Effect.as(Response.json({}))));
      };
      return new ShopClient({ cache }).getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.asVoid);
    };
    const first = yield* Effect.forkChild(firstKind === "gate" ? gate(true) : client(true));
    yield* Deferred.await(entered);
    const second = yield* (firstKind === "gate" ? client(false) : gate(false)).pipe(
      Effect.provideService(Clock.Clock, observer.clock),
      Effect.forkChild,
    );
    yield* Effect.yieldNow;
    expect(starts).toHaveLength(1);
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(first);
    yield* observer.pacing;
    yield* TestClock.adjust(34_999);
    expect(starts).toHaveLength(1);
    yield* TestClock.adjust(1);
    yield* Fiber.join(second);
    expect(starts).toHaveLength(2);
    expect(JSON.parse(yield* state(cache))).toEqual({ startedAt: now + 35_000 });
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect.each(["failure", "interruption"] as const)("releases the shared lock after %s while retaining pacing evidence", (outcome) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const entered = yield* Deferred.make<void>();
    const observer = yield* observedClock;
    const request = withShopRequest(
      url,
      () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(outcome === "failure" ? Effect.fail("request failed") : Effect.never)),
      { cache },
    );
    const fiber = yield* Effect.forkChild(request);
    yield* Deferred.await(entered);
    if (outcome === "interruption") yield* Fiber.interrupt(fiber);
    const exit = yield* Fiber.await(fiber);
    expect(Exit.isFailure(exit)).toBe(true);
    if (outcome === "interruption") expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    yield* missingLock(cache);
    expect(JSON.parse(yield* state(cache))).toEqual({ startedAt: now });
    let called = false;
    const next = yield* withShopRequest(
      url,
      () =>
        Effect.sync(() => {
          called = true;
        }),
      { cache },
    ).pipe(Effect.provideService(Clock.Clock, observer.clock), Effect.forkChild);
    yield* observer.pacing;
    expect(called).toBe(false);
    yield* TestClock.adjust(35_000);
    yield* Fiber.join(next);
    expect(called).toBe(true);
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect("refuses a held filesystem lock before invoking the request or changing timing evidence", () =>
  Effect.gen(function* () {
    const cache = yield* directory;
    yield* Effect.promise(() => writeFile(join(cache, "request.lock"), "another process"));
    yield* Effect.promise(() => writeFile(join(cache, "last-request.json"), JSON.stringify({ startedAt: now })));
    let called = false;
    const error = yield* Effect.flip(
      withShopRequest(
        url,
        () =>
          Effect.sync(() => {
            called = true;
          }),
        { cache },
      ),
    );
    expect(error).toMatchObject({ _tag: "ShopRequestError", url });
    expect(error.message).toContain("Another shop updater holds");
    expect(called).toBe(false);
    expect(JSON.parse(yield* state(cache))).toEqual({ startedAt: now });
    expect(yield* Effect.promise(() => readFile(join(cache, "request.lock"), "utf8"))).toBe("another process");
  }).pipe(Effect.scoped),
);
