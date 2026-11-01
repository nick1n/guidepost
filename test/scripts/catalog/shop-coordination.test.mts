import { expect, it } from "@effect/vitest";
import { Cause, Clock, Deferred, Duration, Effect, Exit, Fiber, Queue } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ShopClient, ShopRequestError, withShopRequest } from "#scripts/catalog/shop.mts";
import { Downloader, downloadNewsPage, newReport, refreshNews, updateReport } from "#scripts/news/scrape-shop-links.mts";
import { checkListing } from "#scripts/catalog/commands/check-shop-links.mts";

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

it.effect("news index refreshes and uncached articles share pacing while cached articles send no request", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const pages = yield* directory;
    const observer = yield* observedClock;
    const starts: number[] = [];
    const fetch: typeof globalThis.fetch = async () => {
      starts.push(Effect.runSync(observer.clock.currentTimeMillis));
      return new Response('<script id="__NEXT_DATA__">{"props":{"pageProps":{"data":{"stories":[]}}}}</script>');
    };
    const download = (...args: Parameters<typeof downloadNewsPage>) =>
      downloadNewsPage(...args).pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.provideService(Clock.Clock, observer.clock),
      );
    const controller = new AbortController();
    yield* Effect.addFinalizer(() => Effect.sync(() => controller.abort()));
    const downloader = new Downloader({ cache: pages, requestCache: cache, delay: 35, signal: controller.signal }, download);
    const index = "https://kingdomdeath.com/news";
    const get = (url: string, cached: boolean) => Effect.tryPromise(() => downloader.get(url, cached));
    yield* get(index, false);
    for (const url of [index, index + "/example"]) {
      const next = yield* Effect.forkChild(get(url, false));
      yield* observer.pacing;
      yield* TestClock.adjust(35_000);
      yield* Fiber.join(next);
    }
    yield* get(index + "/example", true);
    expect(starts).toEqual([now, now + 35_000, now + 70_000]);
    expect(downloader.requests).toBe(3);
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect("paces every redirect hop, including redirects to another host", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const observer = yield* observedClock;
    const urls: string[] = [];
    const starts: number[] = [];
    const fetch: typeof globalThis.fetch = async (input, init) => {
      urls.push(String(input));
      starts.push(Effect.runSync(observer.clock.currentTimeMillis));
      expect(init?.redirect).toBe("manual");
      if (urls.length === 1) return new Response(null, { status: 302, headers: { Location: "/second" } });
      if (urls.length === 2) return new Response(null, { status: 307, headers: { Location: "https://shop.kingdomdeath.com/final" } });
      return new Response(null, { status: 204 });
    };
    const checking = yield* checkListing(new URL("https://example.com/first"), { cache }).pipe(
      Effect.provideService(FetchHttpClient.Fetch, fetch),
      Effect.provideService(Clock.Clock, observer.clock),
      Effect.forkChild,
    );
    for (let hop = 1; hop <= 2; hop++) {
      yield* observer.pacing;
      expect(urls).toHaveLength(hop);
      yield* TestClock.adjust(34_999);
      expect(urls).toHaveLength(hop);
      yield* TestClock.adjust(1);
    }
    expect(yield* Fiber.join(checking)).toEqual({ status: 204, ok: true });
    expect(urls).toEqual(["https://example.com/first", "https://example.com/second", "https://shop.kingdomdeath.com/final"]);
    expect(starts).toEqual([now, now + 35_000, now + 70_000]);
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect.each([
  ["news", "news"],
  ["news", "shop"],
  ["news", "link"],
  ["shop", "news"],
  ["shop", "shop"],
  ["shop", "link"],
  ["link", "news"],
  ["link", "shop"],
  ["link", "link"],
] as const)("paces every request transition from %s to %s", ([firstKind, nextKind]) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const observer = yield* observedClock;
    const starts: number[] = [];
    const fetch: typeof globalThis.fetch = async () => {
      starts.push(Effect.runSync(observer.clock.currentTimeMillis));
      return Response.json({});
    };
    const request = (kind: "news" | "shop" | "link"): Effect.Effect<unknown, unknown> => {
      if (kind === "news") return downloadNewsPage("https://kingdomdeath.com/news", { cache });
      if (kind === "link") return checkListing(new URL("https://example.com/listing"), { cache });
      return new ShopClient({ cache, refresh: true }).getEffect(url);
    };
    const run = (kind: "news" | "shop" | "link") =>
      request(kind).pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.provideService(Clock.Clock, observer.clock),
        Effect.asVoid,
      );
    yield* run(firstKind);
    const next = yield* Effect.forkChild(run(nextKind));
    yield* Effect.raceFirst(observer.pacing, Fiber.join(next));
    expect(starts).toEqual([now]);
    yield* TestClock.adjust(34_999);
    expect(starts).toEqual([now]);
    yield* TestClock.adjust(1);
    yield* Fiber.join(next);
    expect(starts).toEqual([now, now + 35_000]);
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

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

it.effect("request coordination failures stop news processing and checkpoint the incomplete run", () =>
  Effect.gen(function* () {
    const output = yield* directory;
    const error = new ShopRequestError({ url: "https://kingdomdeath.com/news", message: "Could not acquire the shop request lock" });
    let calls = 0;
    const stopped = yield* Effect.flip(
      Effect.tryPromise({
        try: () =>
          refreshNews({
            output,
            cache: output,
            fetch: true,
            downloader: {
              requests: 0,
              get: async () => {
                calls++;
                throw error;
              },
            },
          }),
        catch: (cause) => cause,
      }),
    );
    expect(stopped).toBe(error);
    expect(calls).toBe(1);
    const checkpoint = JSON.parse(yield* Effect.promise(() => readFile(join(output, "shop-links.json"), "utf8")));
    expect(checkpoint.complete).toBe(false);
    expect(checkpoint.errors).toContain(error.message);
    const report = newReport();
    const failedArticle = yield* Effect.flip(
      Effect.tryPromise({
        try: () =>
          updateReport(
            report,
            {
              stories: [
                { date: "2026-11-01", title: "First", slug: "first" },
                { date: "2026-11-01", title: "Second", slug: "second" },
              ],
            },
            async () => {
              calls++;
              throw error;
            },
            async () => {},
          ),
        catch: (cause) => cause,
      }),
    );
    expect(failedArticle).toBe(error);
    expect(calls).toBe(2);
    expect(report.posts).toHaveLength(1);
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
    expect(error.message).toContain("Existing shop request lock:");
    expect(error.message).toContain("Only after confirming this lock is abandoned");
    expect(error.message).toContain("Recorded PID and acquisition time are unavailable");
    expect(called).toBe(false);
    expect(JSON.parse(yield* state(cache))).toEqual({ startedAt: now });
    expect(yield* Effect.promise(() => readFile(join(cache, "request.lock"), "utf8"))).toBe("another process");
  }).pipe(Effect.scoped),
);

it.effect("cancelling a shared gate cooldown preserves it and releases the request lock", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const timing = { startedAt: now, retryAt: now + 120_000 };
    yield* Effect.promise(() => writeFile(join(cache, "last-request.json"), JSON.stringify(timing)));
    const clock = yield* Clock.clockWith(Effect.succeed);
    const sleeping = yield* Deferred.make<void>();
    const request = withShopRequest(url, () => Effect.die("Request started during cooldown"), { cache });
    const fiber = yield* request.pipe(
      Effect.provideService(Clock.Clock, {
        ...clock,
        sleep: (duration) => {
          expect(Duration.toMillis(duration)).toBe(120_000);
          return Deferred.succeed(sleeping, undefined).pipe(Effect.andThen(clock.sleep(duration)));
        },
      }),
      Effect.forkChild,
    );
    yield* Deferred.await(sleeping);
    yield* Fiber.interrupt(fiber);
    const exit = yield* Fiber.await(fiber);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(JSON.parse(yield* state(cache))).toEqual(timing);
    yield* missingLock(cache);
    yield* TestClock.adjust(120_000);
    const startedAt = yield* withShopRequest(url, Effect.succeed, { cache });
    expect(startedAt).toBe(now + 120_000);
    expect(JSON.parse(yield* state(cache))).toEqual({ startedAt });
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);
