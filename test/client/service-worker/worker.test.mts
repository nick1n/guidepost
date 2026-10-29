import { assert, expect, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Logger } from "effect";
import { vi } from "vitest";
import { CacheError, createWorker, reportWorker, runWorker, type Platform } from "../../../src/service-worker/worker.ts";

const origin = "http://localhost:5173";
const collectionPath = "/kdm/collection/";
const catalogPath = "/kdm/catalog/data.json";

function fixture(dev = false) {
  const cache = {
    match: vi.fn<Cache["match"]>().mockResolvedValue(undefined),
    put: vi.fn<Cache["put"]>().mockResolvedValue(undefined),
    add: vi.fn<Cache["add"]>().mockResolvedValue(undefined),
  };
  const platform = {
    caches: {
      open: vi.fn<Platform["caches"]["open"]>().mockResolvedValue(cache),
      keys: vi.fn<Platform["caches"]["keys"]>().mockResolvedValue(["cache-old", "cache-test"]),
      delete: vi.fn<Platform["caches"]["delete"]>().mockResolvedValue(true),
    },
    clients: {
      matchAll: vi.fn<Platform["clients"]["matchAll"]>().mockResolvedValue([]),
      claim: vi.fn<Platform["clients"]["claim"]>().mockResolvedValue(undefined),
    },
    skipWaiting: vi.fn<Platform["skipWaiting"]>().mockResolvedValue(undefined),
    fetch: vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
    origin,
  };
  const worker = createWorker(platform, {
    dev,
    cacheName: "cache-test",
    appAssets: ["/", "/shell.js", "/missing.png"],
    deferredAssets: new Set([collectionPath, catalogPath, "/test/font/"]),
    collectionPath,
    catalogPath,
  });
  return { cache, platform, worker };
}

function request(path = `${collectionPath}?cat=accessories`, mode: RequestMode = "navigate", init?: RequestInit) {
  const request = new Request(new URL(path, origin), init);
  // The browser creates navigation Requests; Node's constructor only accepts other modes.
  Object.defineProperty(request, "mode", { value: mode });
  return request;
}

it("resolves the browser promise with a non-cacheable 503 after a failed uncached navigation", async () => {
  const { worker, cache } = fixture();
  const { response, retain } = await runWorker(worker.respond(request()));
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(cache.put).not.toHaveBeenCalled();
  expect(retain).toBeUndefined();
});

it.effect("handles a cancelled catalog fetch without rejecting the response", () =>
  Effect.gen(function* () {
    const { worker, platform } = fixture();
    platform.fetch.mockRejectedValue(new DOMException("The operation was aborted", "AbortError"));
    const { response } = yield* worker.respond(request(catalogPath, "cors"));
    expect(response.status).toBe(503);
  }),
);

it.effect("returns the network response immediately and defers retention without consuming its body", () =>
  Effect.gen(function* () {
    const { worker, platform, cache } = fixture();
    const response = new Response("Collection");
    platform.fetch.mockResolvedValue(response);
    const result = yield* worker.respond(request());
    expect(result.response).toBe(response);
    expect(cache.put).not.toHaveBeenCalled();
    expect(platform.fetch.mock.calls[0][1]?.signal?.aborted).toBe(false);
    expect(yield* Effect.promise(() => result.response.text())).toBe("Collection");
    assert.isDefined(result.retain);
    yield* result.retain;
    const copy = cache.put.mock.calls[0][1];
    expect(cache.put.mock.calls[0][0]).toBe(collectionPath);
    expect(yield* Effect.promise(() => copy.text())).toBe("Collection");
  }),
);

it.effect("serves cached collection HTML for offline filter URLs", () =>
  Effect.gen(function* () {
    const { cache, platform, worker } = fixture();
    const cached = new Response("Collection");
    cache.match.mockResolvedValue(cached);
    const input = request();
    const { response, retain } = yield* worker.respond(input);
    expect(response).toBe(cached);
    expect(cache.match).toHaveBeenCalledWith(input, { ignoreSearch: true });
    expect(platform.fetch).not.toHaveBeenCalled();
    expect(retain).toBeUndefined();
  }),
);

it("leaves development navigations, non-GET requests, and cross-origin requests to the browser", () => {
  const { worker, platform } = fixture(true);
  expect(worker.handles(request())).toBe(false);
  expect(worker.handles(request("/", "cors", { method: "POST" }))).toBe(false);
  expect(worker.handles(request(catalogPath, "cors"))).toBe(true);
  expect(fixture().worker.handles(request())).toBe(true);
  expect(fixture().worker.handles(request("https://external.test/image.png", "cors"))).toBe(false);
  expect(platform.fetch).not.toHaveBeenCalled();
});

it.effect("keeps search parameters significant for data cache reads and writes", () =>
  Effect.gen(function* () {
    const { cache, worker, platform } = fixture();
    platform.fetch.mockResolvedValue(Response.json({ content: {} }));
    const input = request(`${catalogPath}?version=2`, "cors");
    const result = yield* worker.respond(input);
    assert.isDefined(result.retain);
    yield* result.retain;
    expect(cache.match).toHaveBeenCalledWith(input, { ignoreSearch: false });
    expect(cache.put).toHaveBeenCalledWith(input, expect.any(Response));
  }),
);

it.effect("falls back to the network when browser cache access is unavailable", () =>
  Effect.gen(function* () {
    for (const operation of ["open", "match"] as const) {
      const { cache, platform, worker } = fixture();
      const response = new Response("Online");
      platform.fetch.mockResolvedValue(response);
      if (operation === "open") platform.caches.open.mockRejectedValue(new Error("Cache unavailable"));
      else cache.match.mockRejectedValue(new Error("Cache unavailable"));
      const result = yield* worker.respond(request());
      expect(result.response).toBe(response);
      if (result.retain) yield* result.retain;
    }
  }),
);

it.effect("preserves HTTP errors and excludes failures, external resources, and shell files from deferred retention", () =>
  Effect.gen(function* () {
    for (const [path, status] of [
      [collectionPath, 404],
      [collectionPath, 503],
      ["https://external.test/image.png", 200],
      ["/shell.js", 200],
    ] as const) {
      const { platform, worker } = fixture();
      const response = new Response("Result", { status });
      platform.fetch.mockResolvedValue(response);
      const result = yield* worker.respond(request(path, "cors"));
      expect(result.response).toBe(response);
      expect(result.retain).toBeUndefined();
    }
  }),
);

it.effect("retains the catalog and collection HTML after a catalog request", () =>
  Effect.gen(function* () {
    const { platform, worker, cache } = fixture();
    platform.fetch.mockResolvedValue(Response.json({ content: {} }));
    const result = yield* worker.respond(request(catalogPath, "cors"));
    assert.isDefined(result.retain);
    yield* result.retain;
    expect(cache.put).toHaveBeenCalledOnce();
    expect(cache.add).toHaveBeenCalledWith(collectionPath);
  }),
);

it.effect("does not re-download cached collection HTML or retain it during development catalog fetches", () =>
  Effect.gen(function* () {
    for (const dev of [false, true]) {
      const { platform, worker, cache } = fixture(dev);
      platform.fetch.mockResolvedValue(Response.json({ content: {} }));
      cache.match.mockImplementation(async (input) => (input === collectionPath ? new Response("Cached") : undefined));
      const result = yield* worker.respond(request(catalogPath, "cors"));
      assert.isDefined(result.retain);
      yield* result.retain;
      expect(cache.add).not.toHaveBeenCalled();
      expect(cache.match.mock.calls.some(([input]) => input === collectionPath)).toBe(!dev);
    }
  }),
);

it.effect("cache write failures do not turn a successful response into a failure", () =>
  Effect.gen(function* () {
    const { platform, cache, worker } = fixture();
    platform.fetch.mockResolvedValue(Response.json({ content: {} }));
    cache.put.mockRejectedValue(new Error("Quota exceeded"));
    cache.add.mockRejectedValue(new Error("Offline"));
    const result = yield* worker.respond(request(catalogPath, "cors"));
    assert.isDefined(result.retain);
    yield* result.retain;
    expect(result.response.status).toBe(200);
  }),
);

it.effect("defers lifecycle and cache operations until their effects run", () =>
  Effect.gen(function* () {
    const { platform, cache, worker } = fixture();
    const install = worker.install();
    const activate = worker.activate();
    const cachePage = worker.cachePage({ type: "cache-page", path: collectionPath });
    const respond = worker.respond(request());
    expect(platform.skipWaiting).not.toHaveBeenCalled();
    expect(platform.caches.open).not.toHaveBeenCalled();
    expect(platform.caches.keys).not.toHaveBeenCalled();
    expect(platform.fetch).not.toHaveBeenCalled();
    yield* install;
    yield* activate;
    yield* cachePage;
    yield* respond;
    expect(platform.skipWaiting).toHaveBeenCalledOnce();
    expect(platform.clients.claim).toHaveBeenCalledOnce();
    expect(cache.add).toHaveBeenCalledWith(collectionPath);
    expect(platform.fetch).toHaveBeenCalledOnce();
  }),
);

it.effect("precaches shell assets individually so one missing asset cannot reject installation", () =>
  Effect.gen(function* () {
    const { platform, cache, worker } = fixture();
    cache.add.mockImplementation(async (path) => {
      if (path === "/missing.png") throw new Error("Not found");
    });
    yield* worker.install();
    expect(platform.skipWaiting).toHaveBeenCalledOnce();
    expect(cache.add.mock.calls.map(([path]) => path).sort()).toEqual(["/", "/missing.png", "/shell.js"]);
  }),
);

it.effect("removes old caches and retains visited deferred pages plus their catalog before claiming clients", () =>
  Effect.gen(function* () {
    const { platform, cache, worker } = fixture();
    platform.clients.matchAll.mockResolvedValue([
      { url: `${origin}${collectionPath}?cat=accessories` },
      { url: `${origin}/` },
      { url: `${origin}/test/font/` },
    ]);
    cache.add.mockRejectedValue(new Error("Offline"));
    yield* worker.activate();
    expect(platform.caches.delete.mock.calls).toEqual([["cache-old"]]);
    expect(platform.clients.matchAll).toHaveBeenCalledWith({ type: "window", includeUncontrolled: true });
    expect(cache.add.mock.calls.map(([path]) => path).sort()).toEqual([catalogPath, collectionPath, "/test/font/"].sort());
    expect(platform.clients.claim).toHaveBeenCalledOnce();
  }),
);

it.effect("does not retain visited development pages during activation", () =>
  Effect.gen(function* () {
    const { platform, cache, worker } = fixture(true);
    yield* worker.activate();
    expect(platform.clients.matchAll).not.toHaveBeenCalled();
    expect(cache.add).not.toHaveBeenCalled();
    expect(platform.clients.claim).toHaveBeenCalledOnce();
  }),
);

it.effect("keeps lifecycle failures typed and does not claim clients after failed cache cleanup", () =>
  Effect.gen(function* () {
    const { platform, worker } = fixture();
    const cause = new Error("Storage unavailable");
    platform.caches.delete.mockRejectedValue(cause);
    expect(yield* worker.activate().pipe(Effect.flip)).toMatchObject({ _tag: "WorkerCacheError", operation: "delete", cause });
    expect(platform.clients.claim).not.toHaveBeenCalled();
    platform.skipWaiting.mockRejectedValue(cause);
    expect(yield* worker.install().pipe(Effect.flip)).toMatchObject({ _tag: "WorkerLifecycleError", operation: "skipWaiting", cause });
  }),
);

it.effect("validates cache-page messages, retains only deferred pages, and skips an existing cached page", () =>
  Effect.gen(function* () {
    const { cache, platform, worker } = fixture();
    for (const data of [
      null,
      {},
      { type: "other", path: collectionPath },
      { type: "cache-page", path: 1 },
      { type: "cache-page", path: "/" },
    ]) {
      yield* worker.cachePage(data);
    }
    expect(platform.caches.open).not.toHaveBeenCalled();
    yield* worker.cachePage({ type: "cache-page", path: collectionPath });
    expect(cache.add.mock.calls).toEqual([[collectionPath]]);
    cache.match.mockResolvedValue(new Response("Cached"));
    yield* worker.cachePage({ type: "cache-page", path: collectionPath });
    expect(cache.add).toHaveBeenCalledOnce();
    const development = fixture(true);
    yield* development.worker.cachePage({ type: "cache-page", path: collectionPath });
    expect(development.platform.caches.open).not.toHaveBeenCalled();
  }),
);

it.effect("tolerates cache-page storage failures", () =>
  Effect.gen(function* () {
    const { worker, platform } = fixture();
    platform.caches.open.mockRejectedValue(new Error("Cache unavailable"));
    yield* worker.cachePage({ type: "cache-page", path: collectionPath });
  }),
);

it.effect("interrupting activation stops sequencing before client claim", () =>
  Effect.gen(function* () {
    const { worker, platform } = fixture();
    const started = yield* Deferred.make<void>();
    const release = yield* Deferred.make<boolean>();
    platform.caches.delete.mockImplementation(() =>
      Effect.runPromise(Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release)))),
    );
    const fiber = yield* worker.activate().pipe(Effect.forkScoped);
    yield* Deferred.await(started);
    yield* Fiber.interrupt(fiber);
    yield* Deferred.succeed(release, true);
    expect(platform.clients.claim).not.toHaveBeenCalled();
    expect(platform.caches.open).not.toHaveBeenCalled();
  }),
);

it.effect("interrupting a request aborts the transport and does not turn interruption into a fallback response", () =>
  Effect.gen(function* () {
    const { worker, platform, cache } = fixture();
    const started = yield* Deferred.make<AbortSignal>();
    platform.fetch.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          assert.isOk(signal);
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          Effect.runSync(Deferred.succeed(started, signal));
        }),
    );
    const fiber = yield* worker.respond(request()).pipe(Effect.forkScoped);
    const signal = yield* Deferred.await(started);
    yield* Fiber.interrupt(fiber);
    const exit = yield* Fiber.await(fiber);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(cache.put).not.toHaveBeenCalled();
  }),
);

it.effect("keeps the browser's cancellation signal connected to the forwarded request", () =>
  Effect.gen(function* () {
    const { worker, platform } = fixture();
    platform.fetch.mockResolvedValue(new Response("Online"));
    const controller = new AbortController();
    const input = request("/shell.js", "cors", { signal: controller.signal, credentials: "include", redirect: "manual" });
    yield* worker.respond(input);
    expect(platform.fetch.mock.calls[0][0]).toBe(input);
    const signal = platform.fetch.mock.calls[0][1]?.signal;
    assert.isOk(signal);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  }),
);

it.effect("reports a full defect cause and leaves it failed", () =>
  Effect.gen(function* () {
    const messages: Logger.Options<unknown>[] = [];
    const defect = new Error("Unexpected bug");
    const exit = yield* reportWorker(Effect.die(defect)).pipe(
      Effect.provide(Logger.layer([Logger.make((entry) => messages.push(entry))])),
      Effect.exit,
    );
    expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toEqual(["Service worker operation failed"]);
    expect(Cause.hasDies(messages[0].cause)).toBe(true);
    expect(messages[0].cause).toEqual(Exit.isFailure(exit) ? exit.cause : undefined);
  }),
);

it.effect("keeps mixed interruption causes interrupted and produces no failure log", () =>
  Effect.gen(function* () {
    const messages: unknown[] = [];
    const cause = Cause.combine(Cause.interrupt(), Cause.fail(new CacheError({ operation: "put", cause: "Quota" })));
    const exit = yield* reportWorker(Effect.failCause(cause)).pipe(
      Effect.provide(Logger.layer([Logger.make(({ message }) => messages.push(message))])),
      Effect.exit,
    );
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(messages).toEqual([]);
  }),
);
