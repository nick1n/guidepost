import { catalogTemp } from "./paths.mts";
import { createHash } from "node:crypto";
import { access, mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Cache, Clock, Effect, Exit, Schema, Semaphore } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { decodeShopCache, decodeShopProduct, ShopResponse } from "./shop-schema.mts";
import type { Edition, Item, Mapping } from "./types.mts";

export async function loadMappings(root: string, path?: string): Promise<Record<string, Mapping>> {
  const text = await readFile(path ?? join(catalogTemp(root), "shopify-products/kdm-shop-mappings.json"), "utf8").catch(
    (error: unknown) => {
      if (!path && error instanceof Error && "code" in error && error.code === "ENOENT") return "{}";
      throw error;
    },
  );
  return JSON.parse(text);
}

export class ShopError extends Schema.TaggedError<ShopError>()("ShopError", {
  message: Schema.String,
  status: Schema.Number,
  url: Schema.String,
  cached: Schema.Boolean,
}) {
  constructor(status: number, url: string, cached = false) {
    super({
      status,
      url,
      cached,
      message: `Shop HTTP ${status}: ${url}.${cached ? " Cached response." : " No automatic retry was sent."}`,
    });
  }
}

export class ShopRequestError extends Schema.TaggedError<ShopRequestError>()("ShopRequestError", {
  message: Schema.String,
  url: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

export function shopLinkUrl(value: string, base = "https://shop.kingdomdeath.com") {
  let url = new URL(value, base);
  if (url.hostname !== "shop.kingdomdeath.com" || !["https:", "http:"].includes(url.protocol))
    throw new Error("Expected a Kingdom Death shop URL");
  // A few newsletter hrefs concatenate two shop addresses or contain spaces
  // before the handle. Repair those path typos without following query URLs.
  if (url.pathname.startsWith("/products/")) {
    const embedded = url.pathname.match(/https?:\/\/shop\.kingdomdeath\.com\/products\/[^/]+$/i);
    if (embedded) {
      const repaired = new URL(embedded[0]);
      repaired.search = url.search;
      repaired.hash = url.hash;
      url = repaired;
    }
  }
  url.pathname = url.pathname.replace(/^(?:\/products\/+){2,}/i, "/products/").replace(/(\/products\/)(?:%20)+/i, "$1");
  url.protocol = "https:";
  return url;
}

// Shared handles apply to every edition; external links remain URLs.
export function catalogListing(item: Item, edition?: Edition) {
  const handle = item.handle ?? edition?.handle;
  return handle ? "https://shop.kingdomdeath.com/products/" + handle : (edition?.url ?? item.url);
}

export function productUrl(value: string) {
  const url = shopLinkUrl(value);
  const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:collections\/[^/]+\/)?products\/([^/]+)\/?$/i);
  if (!match) throw new Error("Expected a shop product listing");
  return "https://shop.kingdomdeath.com/products/" + match[1]!.replace(/\.(?:json|js)$/i, "");
}

export const shopProduct = decodeShopProduct;

const cacheFile = (cache: string, url: string) => join(cache, createHash("sha256").update(url).digest("hex") + ".json");
const gates = new Map<string, { semaphore: Semaphore.Semaphore; users: number }>();

// Clients using the same directory share a permit; idle gates retain no resources.
function serialized<A, E, R>(cache: string, effect: Effect.Effect<A, E, R>) {
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      let gate = gates.get(cache);
      if (!gate) {
        gate = { semaphore: Semaphore.makeUnsafe(1), users: 0 };
        gates.set(cache, gate);
      }
      gate.users++;
      return gate;
    }),
    (gate) => gate.semaphore.withPermit(effect),
    (gate) =>
      Effect.sync(() => {
        if (--gate.users === 0) gates.delete(cache);
      }),
  );
}

function missing(cause: unknown) {
  return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
}

// Non-cancelable filesystem work must settle before a lock or permit is released.
function file<A>(url: string, message: string, operation: () => Promise<A>) {
  return Effect.tryPromise({ try: operation, catch: (cause) => new ShopRequestError({ url, message, cause }) }).pipe(
    Effect.uninterruptible,
  );
}

const requestState = Schema.Struct({
  startedAt: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)),
});

type Options = { cache?: string; delay?: number; refresh?: boolean; signal?: AbortSignal; offline?: boolean; maxAgeMs?: number };
type CachedResponse = { response: ShopResponse; timeToLive: number };

export class ShopClient {
  readonly requests: { url: string; startedAt: string; status?: number }[] = [];
  private readonly directory: string;
  private readonly responses: Cache.Cache<string, CachedResponse, ShopError | ShopRequestError>;

  private readonly options: Options;

  constructor(options: Options = {}) {
    this.options = options;
    if (options.delay !== undefined && (!Number.isFinite(options.delay) || options.delay < 35))
      throw new Error("Shop requests require at least 35 seconds between starts");
    if (options.maxAgeMs !== undefined && (Number.isNaN(options.maxAgeMs) || options.maxAgeMs < 0))
      throw new Error("Shop cache age must be nonnegative");
    this.directory = resolve(options.cache ?? ".cache/kdm-shop");
    this.responses = Effect.runSync(
      Cache.makeWith(this.lookup, {
        capacity: 256,
        timeToLive: (exit) => (Exit.isSuccess(exit) ? exit.value.timeToLive : 0),
      }),
    );
  }

  private cached = Effect.fn("ShopClient.cached")(
    function* (this: ShopClient, url: string) {
      if (this.options.refresh) return;
      const text = yield* file(url, "Could not read the shop cache", () => readFile(cacheFile(this.directory, url), "utf8")).pipe(
        Effect.catchIf(
          (error) => missing(error.cause),
          () => Effect.succeed(undefined),
        ),
      );
      if (text === undefined) return;
      const saved = yield* Effect.try({
        try: () => decodeShopCache(JSON.parse(text)),
        catch: (cause) => new ShopRequestError({ url, message: "Invalid cached shop response", cause }),
      });
      if (saved.url !== url) return yield* new ShopRequestError({ url, message: "Cached shop response URL does not match its request" });
      const now = yield* Clock.currentTimeMillis;
      if (!this.options.offline && now - Date.parse(saved.checkedAt) > (this.options.maxAgeMs ?? 86_400_000)) return;
      if ("status" in saved) return yield* new ShopError(saved.status, url, true);
      return saved;
    }.bind(this),
  );

  private download = Effect.fn("ShopClient.download")(
    function* (this: ShopClient, url: string) {
      yield* file(url, "Could not create the shop cache", () => mkdir(this.directory, { recursive: true }));
      const lockPath = join(this.directory, "request.lock");
      return yield* Effect.scoped(
        Effect.gen({ self: this }, function* () {
          const lock = yield* Effect.acquireRelease(
            file(url, "Could not acquire the shop request lock", () => open(lockPath, "wx")).pipe(
              Effect.mapError((error) =>
                error.cause instanceof Error && "code" in error.cause && error.cause.code === "EEXIST"
                  ? new ShopRequestError({
                      url,
                      message: "Another shop updater holds " + lockPath + "; wait for it to finish before retrying.",
                      cause: error.cause,
                    })
                  : error,
              ),
            ),
            (lock) =>
              file(url, "Could not close the shop request lock", () => lock.close()).pipe(
                Effect.ensuring(file(url, "Could not remove the shop request lock", () => unlink(lockPath)).pipe(Effect.orDie)),
                Effect.orDie,
              ),
          );
          const acquiredAt = yield* Clock.currentTimeMillis;
          yield* file(url, "Could not record the shop request lock", () =>
            lock.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date(acquiredAt).toISOString() }) + "\n"),
          );
          const statePath = join(this.directory, "last-request.json");
          const stateText = yield* file(url, "Could not read shop request timing", () => readFile(statePath, "utf8")).pipe(
            Effect.catchIf(
              (error) => missing(error.cause),
              () => Effect.succeed(undefined),
            ),
          );
          if (stateText !== undefined) {
            const state = yield* Effect.try({
              try: () => Schema.decodeUnknownSync(requestState)(JSON.parse(stateText)),
              catch: (cause) => new ShopRequestError({ url, message: "Invalid shop request timing", cause }),
            });
            const now = yield* Clock.currentTimeMillis;
            yield* Effect.sleep(Math.max(0, state.startedAt + (this.options.delay ?? 35) * 1000 - now));
          }
          const startedAt = yield* Clock.currentTimeMillis;
          yield* file(url, "Could not record shop request timing", () => writeFile(statePath, JSON.stringify({ startedAt }) + "\n"));
          const request: { url: string; startedAt: string; status?: number } = { url, startedAt: new Date(startedAt).toISOString() };
          this.requests.push(request);
          return yield* Effect.gen({ self: this }, function* () {
            const response = yield* HttpClient.get(url, {
              headers: { "User-Agent": "Guidepost-Catalog-Updater/1.0", Accept: "application/json" },
            });
            request.status = response.status;
            const checkedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
            if (response.status < 200 || response.status >= 300) {
              yield* file(url, "Could not save the shop failure response", () =>
                writeFile(cacheFile(this.directory, url), JSON.stringify({ url, checkedAt, status: response.status }) + "\n"),
              );
              return yield* new ShopError(response.status, url);
            }
            const data = yield* response.json;
            const result = yield* Schema.decodeUnknownEffect(ShopResponse)({ url, checkedAt, data });
            yield* file(url, "Could not save the shop response", () =>
              writeFile(cacheFile(this.directory, url), JSON.stringify(result, null, 2) + "\n"),
            );
            return result;
          }).pipe(
            Effect.timeout("40 seconds"),
            Effect.mapError((cause) =>
              cause instanceof ShopError || cause instanceof ShopRequestError
                ? cause
                : new ShopRequestError({ url, message: "Shop request failed: " + url, cause }),
            ),
            Effect.provide(FetchHttpClient.layer),
            Effect.provideService(FetchHttpClient.RequestInit, { redirect: "error" }),
          );
        }),
      );
    }.bind(this),
  );

  private lookup = Effect.fn("ShopClient.lookup")(
    function* (this: ShopClient, url: string) {
      let response = yield* this.cached(url);
      if (!response) {
        if (this.options.offline) return yield* new ShopRequestError({ url, message: "No cached shop response: " + url });
        response = yield* serialized(
          this.directory,
          Effect.gen({ self: this }, function* () {
            return (yield* this.cached(url)) ?? (yield* this.download(url));
          }),
        );
      }
      const now = yield* Clock.currentTimeMillis;
      const timeToLive = this.options.refresh
        ? 0
        : this.options.offline
          ? Infinity
          : Math.max(0, (this.options.maxAgeMs ?? 86_400_000) - (now - Date.parse(response.checkedAt)));
      return { response, timeToLive };
    }.bind(this),
  );

  getEffect = Effect.fn("ShopClient.get")(
    function* (this: ShopClient, url: string) {
      yield* Effect.try({
        try: () => {
          const parsed = new URL(url);
          if (parsed.protocol !== "https:" || parsed.hostname !== "shop.kingdomdeath.com" || parsed.username || parsed.password)
            throw new Error("ShopClient only reads the HTTPS Kingdom Death shop");
        },
        catch: (cause) => new ShopRequestError({ url, message: "ShopClient only reads the HTTPS Kingdom Death shop", cause }),
      });
      const lookup = Cache.get(this.responses, url).pipe(Effect.map((entry) => entry.response));
      const signal = this.options.signal;
      if (!signal) return yield* lookup;
      const interrupted = Effect.callback<never>((resume) => {
        if (signal.aborted) {
          resume(Effect.interrupt);
          return;
        }
        const abort = () => resume(Effect.interrupt);
        signal.addEventListener("abort", abort, { once: true });
        return Effect.sync(() => signal.removeEventListener("abort", abort));
      });
      if (signal.aborted) return yield* Effect.interrupt;
      return yield* Effect.raceFirst(lookup, interrupted);
    }.bind(this),
  );

  get(url: string): Promise<{ url: string; checkedAt: string; data: unknown }> {
    return Effect.runPromise(this.getEffect(url));
  }

  productEffect = Effect.fn("ShopClient.product")(
    function* (this: ShopClient, url: string) {
      const listing = yield* Effect.try({
        try: () => productUrl(url),
        catch: (cause) => new ShopRequestError({ url, message: "Invalid shop product URL", cause }),
      });
      let format: "json" | "ajax" = "ajax";
      if (this.options.offline && !this.options.refresh) {
        const exists = yield* file(url, "Could not locate the cached shop product", () =>
          access(cacheFile(this.directory, listing + ".js")),
        ).pipe(
          Effect.as(true),
          Effect.catchIf(
            (error) => missing(error.cause),
            () => Effect.succeed(false),
          ),
        );
        if (!exists) format = "json";
      }
      const response = yield* this.getEffect(listing + (format === "json" ? ".json" : ".js"));
      const data = yield* Effect.try({
        try: () => shopProduct(response.data, format),
        catch: (cause) => new ShopRequestError({ url: response.url, message: "Invalid shop product response", cause }),
      });
      return { ...response, data };
    }.bind(this),
  );

  product(url: string) {
    return Effect.runPromise(this.productEffect(url));
  }
}
