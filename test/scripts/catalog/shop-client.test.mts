import { expect, it } from "@effect/vitest";
import { Cause, Clock, Deferred, Duration, Effect, Exit, Fiber, Logger, Queue } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ShopClient } from "#scripts/catalog/shop.mts";

const url = "https://shop.kingdomdeath.com/products/test.js";
const otherUrl = "https://shop.kingdomdeath.com/products/other.js";
const now = Date.parse("2026-10-10T00:00:00.000Z");
const cacheFile = (cache: string, key = url) => join(cache, createHash("sha256").update(key).digest("hex") + ".json");
const directory = Effect.acquireRelease(
  Effect.promise(() => mkdtemp(join(tmpdir(), "guidepost-shop-effect-"))),
  (cache) => Effect.promise(() => rm(cache, { recursive: true, force: true })),
);
const writeCache = (cache: string, value: unknown, key = url) =>
  Effect.promise(() => writeFile(cacheFile(cache, key), JSON.stringify(value)));
const missingLock = (cache: string) =>
  Effect.promise(() => readFile(join(cache, "request.lock"), "utf8").catch((error: NodeJS.ErrnoException) => error.code)).pipe(
    Effect.tap((result) => Effect.sync(() => expect(result).toBe("ENOENT"))),
  );

// Observe the actual pacing sleep before advancing time, including asynchronous filesystem work preceding it.
const observedClock = Effect.gen(function* () {
  const clock = yield* Clock.clockWith(Effect.succeed);
  const sleeps = yield* Queue.unbounded<number>();
  return {
    clock: {
      ...clock,
      sleep: (duration: Duration.Duration) => Queue.offer(sleeps, Duration.toMillis(duration)).pipe(Effect.andThen(clock.sleep(duration))),
    },
    pacing: Queue.take(sleeps).pipe(Effect.repeat({ until: (duration) => duration === 35_000 })),
    waiting: (milliseconds: number) => Queue.take(sleeps).pipe(Effect.repeat({ until: (duration) => duration === milliseconds })),
    timeout: Queue.take(sleeps).pipe(Effect.repeat({ until: (duration) => duration === 40_000 })),
  };
});

it.effect("stops on a rate-limited page without retrying or fetching the next page", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const observer = yield* observedClock;
    const urls: string[] = [];
    const pages = [1, 2].map((page) => `https://shop.kingdomdeath.com/products.json?limit=250&page=${page}`);
    const fetch: typeof globalThis.fetch = async (input) => {
      urls.push(String(input));
      return urls.length === 1 ? new Response(null, { status: 429, headers: { "Retry-After": "60" } }) : Response.json({ products: [] });
    };
    const client = new ShopClient({ cache, refresh: true });
    const get = (url: string) =>
      client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.provideService(Clock.Clock, observer.clock));
    const stopped = yield* Effect.raceFirst(
      Effect.flip(get(pages[0]).pipe(Effect.andThen(get(pages[1])))),
      observer.waiting(60_000).pipe(Effect.as(undefined)),
    );
    expect(stopped).toMatchObject({ status: 429, url: pages[0], retryAt: now + 60_000 });
    expect(urls).toEqual([pages[0]]);
    yield* TestClock.adjust(120_000);
    expect(urls).toEqual([pages[0]]);
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect("cached rate limits remain terminal without an explicit refresh", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const messages: string[] = [];
    const logger = Logger.make(({ message }) => messages.push(String(message)));
    let calls = 0;
    const fetch: typeof globalThis.fetch = async () => {
      calls++;
      return new Response(null, { status: 429 });
    };
    const client = new ShopClient({ cache });
    const get = client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.provide(Logger.layer([logger])));
    expect(yield* Effect.flip(get)).toMatchObject({ status: 429, cached: false });
    expect(yield* Effect.flip(get)).toMatchObject({ status: 429, cached: true });
    const fresh = new ShopClient({ cache }).getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));
    expect(yield* Effect.flip(fresh)).toMatchObject({ status: 429, cached: true });
    expect(calls).toBe(1);
    expect(messages.some((message) => message.includes("will retry"))).toBe(false);
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect("reports the wait and active URL, without logging cached reads as downloads", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const observer = yield* observedClock;
    const messages: string[] = [];
    const logger = Logger.make(({ message }) => messages.push(String(message)));
    const fetch: typeof globalThis.fetch = async () => {
      expect(messages.at(-1)).toContain(`Fetching ${url}`);
      return Response.json({});
    };
    yield* Effect.promise(() => writeFile(join(cache, "last-request.json"), JSON.stringify({ startedAt: now })));
    const client = new ShopClient({ cache });
    const get = client
      .getEffect(url)
      .pipe(
        Effect.provideService(FetchHttpClient.Fetch, fetch),
        Effect.provideService(Clock.Clock, observer.clock),
        Effect.provide(Logger.layer([logger])),
      );
    expect(messages).toEqual([]);
    const fiber = yield* Effect.forkChild(get);
    yield* observer.pacing;
    expect(messages).toEqual([expect.stringContaining(`Waiting 35s before fetching ${url}`)]);
    yield* TestClock.adjust(35_000);
    yield* Fiber.join(fiber);
    expect(messages).toEqual([
      expect.stringContaining(`Waiting 35s before fetching ${url}`),
      expect.stringContaining(`Fetching ${url}`),
      expect.stringContaining(`HTTP 200 ${url}`),
    ]);
    yield* get;
    yield* new ShopClient({ cache, offline: true }).getEffect(url).pipe(Effect.provide(Logger.layer([logger])));
    expect(messages).toHaveLength(3);
  }).pipe(Effect.scoped),
);

it.effect.each(["120", new Date(now + 120_000).toUTCString(), "10"])(
  "stops on 429 and retains the reported cooldown (%s) for explicit future runs",
  (retryAfter) =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      const cache = yield* directory;
      const cooldown = retryAfter === "10" ? 10_000 : 120_000;
      const wait = Math.max(35_000, cooldown);
      const observer = yield* observedClock;
      let calls = 0;
      const fetch: typeof globalThis.fetch = async () => {
        calls++;
        return calls === 1 ? new Response(null, { status: 429, headers: { "Retry-After": retryAfter } }) : Response.json({});
      };
      const client = new ShopClient({ cache, refresh: true });
      const stopped = yield* Effect.flip(client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)));
      expect(stopped).toMatchObject({ status: 429, retryAt: now + cooldown });
      expect(stopped.message).toContain("Stopped without retrying");
      expect(JSON.parse(yield* Effect.promise(() => readFile(join(cache, "last-request.json"), "utf8")))).toEqual({
        startedAt: now,
        retryAt: now + cooldown,
      });
      const cached = yield* Effect.flip(new ShopClient({ cache, offline: true }).getEffect(url));
      expect(cached).toMatchObject({ status: 429, cached: true, retryAt: now + cooldown });
      expect(calls).toBe(1);
      yield* missingLock(cache);
      const messages: string[] = [];
      const logger = Logger.make(({ message }) => messages.push(String(message)));
      const next = yield* new ShopClient({ cache, refresh: true })
        .getEffect(url)
        .pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetch),
          Effect.provideService(Clock.Clock, observer.clock),
          Effect.provide(Logger.layer([logger])),
          Effect.forkChild,
        );
      yield* observer.waiting(wait);
      yield* TestClock.adjust(wait - 1);
      expect(calls).toBe(1);
      yield* TestClock.adjust(1);
      yield* Fiber.join(next);
      expect(calls).toBe(2);
      expect(messages[0]).toContain(`Waiting ${wait / 1000}s before fetching ${url}`);
      yield* missingLock(cache);
    }).pipe(Effect.scoped),
);

it.effect.each([undefined, "invalid", "-1", "0", "99999999999999999999", new Date(now - 1_000).toUTCString()])(
  "stops without retrying for a missing, invalid or expired Retry-After (%s)",
  (retryAfter) =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      const cache = yield* directory;
      let calls = 0;
      const fetch: typeof globalThis.fetch = async () => {
        calls++;
        return calls === 1
          ? new Response(null, { status: 429, headers: retryAfter === undefined ? {} : { "Retry-After": retryAfter } })
          : Response.json({ recovered: true });
      };
      const client = new ShopClient({ cache });
      const stopped = yield* Effect.flip(client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)));
      expect(stopped).toMatchObject({ status: 429 });
      expect(JSON.parse(yield* Effect.promise(() => readFile(join(cache, "last-request.json"), "utf8")))).toEqual({ startedAt: now });
      expect(calls).toBe(1);
      yield* TestClock.adjust(120_000);
      expect(calls).toBe(1);
      yield* missingLock(cache);
    }).pipe(Effect.scoped),
);

it.effect("validates disk envelopes and their URL without contacting the shop", () =>
  Effect.gen(function* () {
    const cache = yield* directory;
    let calls = 0;
    const fetch: typeof globalThis.fetch = async () => {
      calls++;
      return Response.json({});
    };
    const client = new ShopClient({ cache, offline: true });
    for (const value of [
      { url, checkedAt: "invalid", data: {} },
      { url: otherUrl, checkedAt: new Date(now).toISOString(), data: {} },
      { url, checkedAt: new Date(now).toISOString() },
    ]) {
      yield* writeCache(cache, value);
      const result = yield* Effect.exit(client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)));
      expect(Exit.isFailure(result)).toBe(true);
    }
    expect(calls).toBe(0);
    expect(client.requests).toEqual([]);
  }).pipe(Effect.scoped),
);

it.effect("loads an old offline legacy product JSON and converts dollars to cents", () =>
  Effect.gen(function* () {
    const cache = yield* directory;
    const legacyUrl = url.replace(/\.js$/, ".json");
    yield* writeCache(
      cache,
      {
        url: legacyUrl,
        checkedAt: "2020-01-01T00:00:00.000Z",
        data: {
          product: {
            id: 1,
            title: "Test",
            handle: "test",
            variants: [{ id: 2, title: "Default", requires_shipping: true, price: "12.50" }],
          },
        },
      },
      legacyUrl,
    );
    const client = new ShopClient({ cache, offline: true, maxAgeMs: 0 });
    const product = yield* client.productEffect(url.replace(/\.js$/, ""));
    expect(product.url).toBe(legacyUrl);
    expect(product.data.variants[0].price).toBe(1250);
    expect(client.requests).toEqual([]);
  }).pipe(Effect.scoped),
);

it.effect("sends fixed headers and refuses redirects, then preserves disk HTTP negative caching without retry", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const requests: RequestInit[] = [];
    const fetch: typeof globalThis.fetch = async (input, init) => {
      expect(String(input)).toBe(url);
      requests.push(init ?? {});
      return new Response("Unavailable", { status: 503 });
    };
    const client = new ShopClient({ cache });
    const get = client.getEffect;
    const first = yield* Effect.flip(get(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)));
    expect(first).toMatchObject({ status: 503, url, cached: false });
    const second = yield* Effect.flip(get(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)));
    expect(second).toMatchObject({ status: 503, url, cached: true });
    const fresh = new ShopClient({ cache });
    const persisted = yield* Effect.flip(fresh.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)));
    expect(persisted).toMatchObject({ status: 503, url, cached: true });
    expect(requests).toHaveLength(1);
    expect(requests[0].redirect).toBe("error");
    const headers = new Headers(requests[0].headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("user-agent")).toContain("Chrome/155.0.0.0");
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect("paces separate clients sharing a directory and persists their start timestamps", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const observer = yield* observedClock;
    const fetch: typeof globalThis.fetch = async () => Response.json({ ok: true });
    const first = new ShopClient({ cache });
    const second = new ShopClient({ cache });
    yield* first.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));
    const fiber = yield* second
      .getEffect(otherUrl)
      .pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.provideService(Clock.Clock, observer.clock), Effect.forkChild);
    yield* observer.pacing;
    yield* TestClock.adjust(34_999);
    expect(second.requests).toHaveLength(0);
    yield* TestClock.adjust(1);
    yield* Fiber.join(fiber);
    expect(Date.parse(second.requests[0].startedAt) - Date.parse(first.requests[0].startedAt)).toBe(35_000);
    const state = yield* Effect.promise(() => readFile(join(cache, "last-request.json"), "utf8"));
    expect(JSON.parse(state)).toEqual({ startedAt: now + 35_000 });
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect("expires memory at the remaining disk age instead of renewing the success TTL", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    yield* writeCache(cache, { url, checkedAt: new Date(now - 900).toISOString(), data: { source: "disk" } });
    let calls = 0;
    const fetch: typeof globalThis.fetch = async () => {
      calls++;
      return Response.json({ source: "network" });
    };
    const client = new ShopClient({ cache, maxAgeMs: 1_000 });
    const get = () => client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));
    expect((yield* get()).data).toEqual({ source: "disk" });
    yield* TestClock.adjust(99);
    expect((yield* get()).data).toEqual({ source: "disk" });
    yield* TestClock.adjust(2);
    expect((yield* get()).data).toEqual({ source: "network" });
    expect(calls).toBe(1);
  }).pipe(Effect.scoped),
);

it.effect("refresh bypasses settled memory and disk but deduplicates concurrent lookups", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    yield* writeCache(cache, { url, checkedAt: new Date(now).toISOString(), data: "disk" });
    const entered = yield* Deferred.make<void>();
    const release = yield* Deferred.make<Response>();
    const observer = yield* observedClock;
    let calls = 0;
    const fetch: typeof globalThis.fetch = () => {
      calls++;
      if (calls > 1) return Promise.resolve(Response.json("second"));
      Effect.runSync(Deferred.succeed(entered, undefined));
      return Effect.runPromise(Deferred.await(release));
    };
    const client = new ShopClient({ cache, refresh: true });
    const get = () => client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));
    const first = yield* Effect.forkChild(get());
    yield* Deferred.await(entered);
    const concurrent = yield* Effect.forkChild(get());
    yield* Effect.yieldNow;
    yield* Deferred.succeed(release, Response.json("first"));
    expect((yield* Fiber.join(first)).data).toBe("first");
    expect((yield* Fiber.join(concurrent)).data).toBe("first");
    expect(calls).toBe(1);
    const next = yield* get().pipe(Effect.provideService(Clock.Clock, observer.clock), Effect.forkChild);
    yield* observer.pacing;
    yield* TestClock.adjust(35_000);
    expect((yield* Fiber.join(next)).data).toBe("second");
    expect(calls).toBe(2);
  }).pipe(Effect.scoped),
);

it.effect("interrupting a paced lookup releases the lock and allows the next request", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    yield* Effect.promise(() => writeFile(join(cache, "last-request.json"), JSON.stringify({ startedAt: now })));
    const observer = yield* observedClock;
    const client = new ShopClient({ cache });
    let calls = 0;
    const fetch: typeof globalThis.fetch = async () => {
      calls++;
      return Response.json({});
    };
    const get = () =>
      client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.provideService(Clock.Clock, observer.clock));
    const first = yield* Effect.forkChild(get());
    yield* observer.pacing;
    yield* Fiber.interrupt(first);
    const exit = yield* Fiber.await(first);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(calls).toBe(0);
    yield* missingLock(cache);
    const next = yield* Effect.forkChild(get());
    yield* observer.pacing;
    yield* TestClock.adjust(35_000);
    yield* Fiber.join(next);
    expect(calls).toBe(1);
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect("cancelling one shared waiter keeps the network lookup alive for the remaining waiter", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const entered = yield* Deferred.make<void>();
    const release = yield* Deferred.make<Response>();
    let signal: AbortSignal | null | undefined;
    let calls = 0;
    const fetch: typeof globalThis.fetch = (_input, init) => {
      calls++;
      signal = init?.signal;
      Effect.runSync(Deferred.succeed(entered, undefined));
      return Effect.runPromise(Deferred.await(release));
    };
    const client = new ShopClient({ cache });
    const get = () => client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch));
    const first = yield* Effect.forkChild(get());
    yield* Deferred.await(entered);
    const second = yield* Effect.forkChild(get());
    yield* Effect.yieldNow;
    yield* Fiber.interrupt(first);
    expect(signal?.aborted).toBe(false);
    yield* Deferred.succeed(release, Response.json({ shared: true }));
    expect((yield* Fiber.join(second)).data).toEqual({ shared: true });
    expect(calls).toBe(1);
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect("cancelling the last shared waiter aborts transport and removes the lock before a subsequent request", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const entered = yield* Deferred.make<void>();
    const observer = yield* observedClock;
    let signal: AbortSignal | null | undefined;
    let calls = 0;
    const fetch: typeof globalThis.fetch = (_input, init) => {
      calls++;
      if (calls > 1) return Promise.resolve(Response.json("recovered"));
      signal = init?.signal;
      Effect.runSync(Deferred.succeed(entered, undefined));
      return new Promise(() => {});
    };
    const client = new ShopClient({ cache });
    const get = () =>
      client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.provideService(Clock.Clock, observer.clock));
    const first = yield* Effect.forkChild(get());
    yield* Deferred.await(entered);
    const second = yield* Effect.forkChild(get());
    yield* Effect.yieldNow;
    yield* Fiber.interrupt(first);
    expect(signal?.aborted).toBe(false);
    yield* Fiber.interrupt(second);
    expect(signal?.aborted).toBe(true);
    yield* missingLock(cache);
    const next = yield* Effect.forkChild(get());
    yield* observer.pacing;
    yield* TestClock.adjust(35_000);
    expect((yield* Fiber.join(next)).data).toBe("recovered");
    expect(calls).toBe(2);
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect("times out a hung request after 40 virtual seconds and releases its lock without retry", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const observer = yield* observedClock;
    const entered = yield* Deferred.make<void>();
    let calls = 0;
    let signal: AbortSignal | null | undefined;
    const fetch: typeof globalThis.fetch = (_input, init) => {
      calls++;
      signal = init?.signal;
      Effect.runSync(Deferred.succeed(entered, undefined));
      return new Promise(() => {});
    };
    const client = new ShopClient({ cache });
    const fiber = yield* client
      .getEffect(url)
      .pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.provideService(Clock.Clock, observer.clock), Effect.forkChild);
    yield* Deferred.await(entered);
    yield* observer.timeout;
    yield* TestClock.adjust(40_000);
    const exit = yield* Fiber.await(fiber);
    expect(Exit.isFailure(exit)).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(calls).toBe(1);
    yield* missingLock(cache);
  }).pipe(Effect.scoped),
);

it.effect("interrupting JSON body reading removes the request lock and does not cache an incomplete response", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const cache = yield* directory;
    const reading = yield* Deferred.make<void>();
    class PendingBody extends Response {
      override arrayBuffer(): Promise<ArrayBuffer> {
        Effect.runSync(Deferred.succeed(reading, undefined));
        return new Promise(() => {});
      }
    }
    const fetch: typeof globalThis.fetch = async () => new PendingBody();
    const client = new ShopClient({ cache });
    const fiber = yield* client.getEffect(url).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.forkChild);
    yield* Deferred.await(reading);
    yield* Fiber.interrupt(fiber);
    const exit = yield* Fiber.await(fiber);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    yield* missingLock(cache);
    const saved = yield* Effect.promise(() => readFile(cacheFile(cache), "utf8").catch((error: NodeJS.ErrnoException) => error.code));
    expect(saved).toBe("ENOENT");
  }).pipe(Effect.scoped),
);
