import { Clock, Duration, Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { Command } from "effect/cli";
import { offline, fetch, catalog as catalogFlag, optionalString, offlineMode, runCommand, workflow } from "../cli.mts";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { reviewEditions, reviewShopUrl } from "#lib/catalog-view.ts";
import { publishFiles } from "../publication.mts";
import { categories } from "../types.mts";
import type { Catalog } from "#lib/types/index.ts";
import { catalogTemp } from "../paths.mts";
import { ShopError, ShopRequestError, withShopRequest } from "../shop.mts";
import { formatLockConflict } from "../locks.mts";
import { withProgress } from "../progress.mts";

export class LinkRequestError extends Schema.TaggedError<LinkRequestError>()("LinkRequestError", { cause: Schema.Defect() }) {}
const followListing = Effect.fn("CatalogLinks.checkListing")(function* (
  url: URL,
  options: { cache?: string },
  redirects: number,
): Effect.fn.Return<{ status: number; ok: boolean }, LinkRequestError | ShopError | ShopRequestError> {
  const response = yield* withShopRequest(
    url.href,
    () =>
      Effect.logInfo(`Checking ${url.href}`).pipe(
        Effect.andThen(withProgress(`Checking ${url.href}`, HttpClient.head(url.href))),
        Effect.timeout(10_000),
        Effect.mapError((cause) => new LinkRequestError({ cause })),
        Effect.provide(FetchHttpClient.layer),
        Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
      ),
    options,
  );
  if (response.status === 429) return yield* new ShopError(429, url.href);
  const location = response.headers.location;
  if ([301, 302, 303, 307, 308].includes(response.status) && location) {
    if (redirects === 0) return yield* new LinkRequestError({ cause: new Error("Too many link redirects") });
    const next = yield* Effect.try({
      try: () => new URL(location, url),
      catch: (cause) => new LinkRequestError({ cause }),
    });
    return yield* followListing(next, options, redirects - 1);
  }
  return { status: response.status, ok: response.status >= 200 && response.status < 300 };
});

export function checkListing(url: URL, options: { cache?: string } = {}) {
  return followListing(url, options, 20);
}
const LinkResult = Schema.Struct({ checkedAt: Schema.String, status: Schema.NullOr(Schema.Number), ok: Schema.Boolean });
const LinkCheckpoint = Schema.Struct({
  complete: Schema.Boolean,
  results: Schema.Record(Schema.String, LinkResult),
});
const resumeLifetime = 24 * 60 * 60 * 1000;
type LinkDependencies = {
  now: () => number;
  wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  check: (url: URL, signal: AbortSignal) => Promise<{ status: number; ok: boolean }>;
};

export async function checkShopLinks(
  signal: AbortSignal,
  options: { offline?: boolean; catalog?: string; cache?: string } = {},
  dependencies: Partial<LinkDependencies> = {},
) {
  const now = dependencies.now ?? Date.now;
  const wait = dependencies.wait ?? ((milliseconds, signal) => sleep(milliseconds, undefined, { signal }));
  const check = dependencies.check;
  const catalogPath = options.catalog
    ? resolve(options.catalog)
    : fileURLToPath(new URL("../../../static/kdm/catalog/data.json", import.meta.url));
  const reportPath = join(catalogTemp(dirname(catalogPath)), "reports/shop-links.json");
  const checkpointPath = join(dirname(reportPath), "shop-links-checkpoint.json");
  signal.throwIfAborted();
  if (options.offline !== false) {
    const text = await readFile(reportPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") throw new Error("No saved link-check report; run pnpm check:shop-links --fetch to create one.");
      throw error;
    });
    const report = Schema.decodeUnknownSync(
      Schema.Struct({
        checkedAt: Schema.String,
        reachable: Schema.Number,
        unreachable: Schema.Number,
        missing: Schema.Number,
      }),
    )(JSON.parse(text));
    console.log(
      `Saved link check (${report.checkedAt}): ${report.reachable} reachable, ${report.unreachable} unreachable, ${report.missing} without URLs. Report: ${reportPath}`,
    );
    return;
  }
  await mkdir(dirname(reportPath), { recursive: true });
  const lockPath = join(dirname(reportPath), "shop-links.lock");
  const lock = await open(lockPath, "wx").catch(async (cause: NodeJS.ErrnoException) => {
    if (cause.code === "EEXIST") throw new Error(await formatLockConflict(lockPath, "link checker"), { cause });
    throw cause;
  });
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date(now()).toISOString() }) + "\n");
    signal.throwIfAborted();
    const baseline = await readFile(catalogPath, "utf8");
    const catalog: Catalog = JSON.parse(baseline);
    const saved = await readFile(checkpointPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    const checkpoint = (() => {
      if (!saved) return undefined;
      try {
        const decoded = Schema.decodeUnknownSync(LinkCheckpoint)(JSON.parse(saved));
        for (const [listing, result] of Object.entries(decoded.results)) {
          new URL(listing);
          if (!Number.isFinite(Date.parse(result.checkedAt))) throw new Error("Invalid checkedAt date");
        }
        return decoded;
      } catch (cause) {
        throw new Error(`Invalid link checkpoint ${checkpointPath}; remove it and rerun with --fetch.`, { cause });
      }
    })();
    const resumed = Object.entries(checkpoint?.complete === false ? checkpoint.results : {}).filter(([, result]) => {
      const age = now() - Date.parse(result.checkedAt);
      return Number.isFinite(age) && age >= 0 && age < resumeLifetime;
    });
    type Result = typeof LinkResult.Type;
    const checkpointResults: Record<string, Result> = Object.fromEntries(resumed);
    // Checkpoints survive cancellation and catalog edits that invalidate the final report.
    const saveCheckpoint = () => publishFiles([{ path: checkpointPath, json: { complete: false, results: checkpointResults } }]);
    await saveCheckpoint();
    const listings: {
      category: string;
      itemId: string;
      editionId: string;
      edition?: string;
      url?: string;
      reachable: boolean | null;
      status: number | null;
      checkedAt?: string;
    }[] = [];
    const results = new Map<string, Result>(resumed);
    let reachable = 0;
    let unreachable = 0;
    let missing = 0;
    const clock = Effect.runSync(Clock.clockWith(Effect.succeed));
    const requestClock =
      dependencies.now || dependencies.wait
        ? {
            currentTimeNanos: clock.currentTimeNanos,
            currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
            monotonicTimeNanos: clock.monotonicTimeNanos,
            monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
            currentTimeMillis: Effect.sync(now),
            currentTimeMillisUnsafe: now,
            sleep: (duration: Duration.Duration) => Effect.promise((signal) => wait(Duration.toMillis(duration), signal)),
          }
        : clock;
    for (const category of categories) {
      signal.throwIfAborted();
      for (const [itemId, item] of Object.entries(catalog[category])) {
        for (const edition of reviewEditions({ ...item, category })) {
          if (edition.includedOnly) continue;
          const listing = reviewShopUrl(item, edition);
          if (!listing) {
            listings.push({
              category,
              itemId,
              editionId: edition.id,
              edition: edition.label,
              reachable: null,
              status: null,
            });
            missing++;
            continue;
          }
          const url = new URL(listing, "https://shop.kingdomdeath.com");
          const key = url.href;
          if (!results.has(key)) {
            signal.throwIfAborted();
            const perform = async (): Promise<Result> => {
              try {
                const request = check
                  ? withShopRequest(url.href, () => Effect.promise(() => check(url, signal)), { cache: options.cache })
                  : checkListing(url, { cache: options.cache });
                const result = await Effect.runPromise(request.pipe(Effect.provideService(Clock.Clock, requestClock)), { signal });
                if (result.status === 429) throw new ShopError(429, url.href);
                console.log(`${result.status} ${url}`);
                return { ...result, checkedAt: new Date(now()).toISOString() };
              } catch (error) {
                signal.throwIfAborted();
                if (error instanceof ShopRequestError || (error instanceof ShopError && error.status === 429)) throw error;
                console.warn(`Failed ${listing}: ${error instanceof Error ? error.message : String(error)}`);
                return { status: null, ok: false, checkedAt: new Date(now()).toISOString() };
              }
            };
            const response = await perform();
            results.set(key, response);
            checkpointResults[key] = response;
            await saveCheckpoint();
          }
          const response = results.get(key);
          if (!response) throw new Error(`Missing link result for ${key}`);
          listings.push({
            category,
            itemId,
            editionId: edition.id,
            edition: edition.label,
            url: listing,
            reachable: response.ok,
            status: response.status,
            checkedAt: response.checkedAt,
          });
          if (response.ok) reachable++;
          else unreachable++;
        }
      }
    }
    const checkedAt = new Date(now()).toISOString();
    await publishFiles(
      [
        { path: reportPath, json: { checkedAt, reachable, unreachable, missing, listings } },
        { path: checkpointPath, json: { complete: true, results: checkpointResults } },
      ],
      {
        baselines: [{ path: catalogPath, text: baseline, message: "Catalog changed during link checks; rerun to preserve your edits." }],
        signal,
      },
    );
    console.log(`Checked listings: ${reachable} reachable, ${unreachable} unreachable, ${missing} without URLs. Report: ${reportPath}`);
  } finally {
    try {
      await lock.close();
    } finally {
      await unlink(lockPath);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommand(
    Command.make("check:shop-links", { offline, fetch, catalog: catalogFlag, cache: optionalString("cache") }, (values) =>
      workflow((signal) => checkShopLinks(signal, { offline: offlineMode(values), catalog: values.catalog, cache: values.cache })),
    ),
  );
}
