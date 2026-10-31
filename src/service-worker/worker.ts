import { Cause, Effect, Schema } from "effect";
import { rateCacheName } from "../lib/app/currency/model";

export class CacheError extends Schema.TaggedError<CacheError>()("WorkerCacheError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

class RequestError extends Schema.TaggedError<RequestError>()("WorkerRequestError", {
  cause: Schema.Defect(),
}) {}

class LifecycleError extends Schema.TaggedError<LifecycleError>()("WorkerLifecycleError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

type WorkerError = CacheError | RequestError | LifecycleError;
type AssetCache = Pick<Cache, "add" | "match" | "put">;

export type Platform = {
  caches: {
    open: (name: string) => Promise<AssetCache>;
    keys: () => Promise<string[]>;
    delete: (name: string) => Promise<boolean>;
  };
  clients: {
    matchAll: (options: { type: "window"; includeUncontrolled: true }) => Promise<readonly { url: string }[]>;
    claim: () => Promise<void>;
  };
  skipWaiting: () => Promise<void>;
  fetch: typeof globalThis.fetch;
  origin: string;
};

type Options = {
  dev: boolean;
  cacheName: string;
  appAssets: readonly string[];
  deferredAssets: ReadonlySet<string>;
  collectionPath: string;
  catalogPath: string;
};

type Fetched = { response: Response; retain?: Effect.Effect<void> };

// Native Cache API operations cannot be cancelled; interruption stops the workflow's subsequent operations.
const cacheOperation = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new CacheError({ operation, cause }) });

const lifecycleOperation = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new LifecycleError({ operation, cause }) });

// The browser cache is optional. Recover only its typed failures, leaving defects and interruption visible.
const optional = <A>(effect: Effect.Effect<A, CacheError>) => effect.pipe(Effect.catchTag("WorkerCacheError", () => Effect.void));

const isCachePage = Schema.is(Schema.Struct({ type: Schema.Literal("cache-page"), path: Schema.String }));

function unavailable() {
  return new Response("This resource is unavailable. Check your connection and try again.", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function createWorker(platform: Platform, options: Options) {
  const { dev, cacheName, appAssets, deferredAssets, collectionPath, catalogPath } = options;
  const open = cacheOperation("open", () => platform.caches.open(cacheName));
  const add = (cache: AssetCache, path: string) => cacheOperation("add", () => cache.add(path));
  const match = (cache: AssetCache, request: RequestInfo, ignoreSearch = false) =>
    cacheOperation("match", () => cache.match(request, { ignoreSearch }));

  const retainPage = Effect.fn("ServiceWorker.retainPage")(function* (cache: AssetCache, path: string) {
    const cached = yield* match(cache, path);
    if (!cached) yield* add(cache, path);
  });

  const install = Effect.fn("ServiceWorker.install")(function* () {
    yield* lifecycleOperation("skipWaiting", () => platform.skipWaiting());
    const cache = yield* open;
    // A missing asset must not prevent the remaining shell assets from being cached.
    yield* Effect.forEach(appAssets, (path) => optional(add(cache, path)), { concurrency: "unbounded", discard: true });
  });

  const activate = Effect.fn("ServiceWorker.activate")(function* () {
    const keys = yield* cacheOperation("keys", () => platform.caches.keys());
    yield* Effect.forEach(
      keys.filter((key) => key !== cacheName && key !== rateCacheName),
      (key) => cacheOperation("delete", () => platform.caches.delete(key)),
      { concurrency: "unbounded", discard: true },
    );
    // Direct first visits happen before this worker controls requests.
    const clients = dev
      ? []
      : yield* lifecycleOperation("matchAll", () => platform.clients.matchAll({ type: "window", includeUncontrolled: true }));
    const visitedPaths = new Set(clients.map((client) => new URL(client.url).pathname).filter((path) => deferredAssets.has(path)));
    if (visitedPaths.has(collectionPath)) visitedPaths.add(catalogPath);
    const cache = yield* open;
    yield* Effect.forEach(visitedPaths, (path) => optional(add(cache, path)), { concurrency: "unbounded", discard: true });
    yield* lifecycleOperation("claim", () => platform.clients.claim());
  });

  const cachePage = Effect.fn("ServiceWorker.cachePage")(function* (data: unknown) {
    if (dev || !isCachePage(data) || !deferredAssets.has(data.path)) return;
    yield* optional(Effect.flatMap(open, (cache) => retainPage(cache, data.path)));
  });

  // This transport forwards browser Requests unchanged, preserving modes, credentials, redirects, and streaming responses.
  // Cache.add above also stays a native Cache API adapter, rather than reconstructing downloaded responses.
  const fetchRequest = (request: Request) =>
    Effect.tryPromise({
      try: (signal) => platform.fetch(request, { signal: AbortSignal.any([request.signal, signal]) }),
      catch: (cause) => new RequestError({ cause }),
    });

  const respond = Effect.fn("ServiceWorker.respond")(function* (request: Request): Effect.fn.Return<Fetched> {
    const cache = yield* optional(open);
    // Prerendered HTML is the same for all search/filter URLs; the client restores their state.
    const cached = cache ? yield* optional(match(cache, request, request.mode === "navigate")) : undefined;
    const response = cached ?? (yield* fetchRequest(request).pipe(Effect.catchTag("WorkerRequestError", () => Effect.sync(unavailable))));
    const url = new URL(request.url);
    const retention: Effect.Effect<void>[] = [];
    if (cache && response.ok && url.origin === platform.origin && deferredAssets.has(url.pathname)) {
      // Clone before returning the original response, whose body may immediately be consumed by the browser.
      if (!cached) {
        const key = request.mode === "navigate" ? url.pathname : request;
        const copy = response.clone();
        retention.push(optional(cacheOperation("put", () => cache.put(key, copy))));
      }
      // SPA navigation fetches the catalog but not the HTML needed for an offline reload.
      if (!dev && url.pathname === catalogPath) retention.push(optional(retainPage(cache, collectionPath)));
    }
    return {
      response,
      retain: retention.length ? Effect.all(retention, { concurrency: "unbounded", discard: true }) : undefined,
    };
  });

  function handles(request: Pick<Request, "method" | "mode" | "url">) {
    // Dev HTML embeds route indices that can change while the worker remains active.
    return request.method === "GET" && !(dev && request.mode === "navigate") && new URL(request.url).origin === platform.origin;
  }

  return { install, activate, cachePage, respond, handles };
}

/** The browser owns each event's lifetime through waitUntil/respondWith, so no detached fibers are started here. */
export function runWorker<A>(effect: Effect.Effect<A, WorkerError>) {
  return Effect.runPromise(reportWorker(effect));
}

export const reportWorker = Effect.fn("ServiceWorker.report")(<A>(effect: Effect.Effect<A, WorkerError>) =>
  effect.pipe(
    Effect.tapCause((cause) => {
      if (Cause.hasInterrupts(cause)) return Effect.void;
      return Effect.logError("Service worker operation failed", cause);
    }),
  ),
);
