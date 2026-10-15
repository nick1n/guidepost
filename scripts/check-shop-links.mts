import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { Command } from "effect/cli";
import { offline, fetch, catalog as catalogFlag, offlineMode, runCommand, workflow } from "./catalog/cli.mts";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { reviewEditions, reviewShopUrl } from "#lib/catalog-view.ts";
import { publishFiles } from "./catalog/publication.mts";
import { organizeCatalog } from "./catalog/order.mts";
import { categories } from "./catalog/types.mts";
import type { Catalog, Edition, Item } from "#lib/types/index.ts";
import { catalogTemp } from "./catalog/paths.mts";

export class LinkRequestError extends Schema.TaggedError<LinkRequestError>()("LinkRequestError", { cause: Schema.Defect() }) {}
export const checkListing = Effect.fn("CatalogLinks.checkListing")((url: URL) =>
  HttpClient.head(url.href).pipe(
    Effect.map((response) => {
      const ok = response.status >= 200 && response.status < 300;
      return { status: response.status, ok };
    }),
    Effect.timeout(10_000),
    Effect.mapError((cause) => new LinkRequestError({ cause })),
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "follow" }),
  ),
);
export function recordShopLink(item: Item, edition: Edition, reachable: boolean) {
  const target = item.editions?.length ? edition : item;
  const previous = target.shop;
  if (reachable && (previous === "in-stock" || previous === "out-of-stock")) return;
  // A successful HEAD clears link failures without claiming to check stock.
  if (reachable) delete target.shop;
  else target.shop = "missing";
}

const LinkResult = Schema.Struct({ checkedAt: Schema.String, status: Schema.NullOr(Schema.Number), ok: Schema.Boolean });
const LinkCheckpoint = Schema.Struct({
  complete: Schema.Boolean,
  starts: Schema.optionalKey(Schema.Record(Schema.String, Schema.Number)),
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
  options: { offline?: boolean; catalog?: string } = {},
  dependencies: Partial<LinkDependencies> = {},
) {
  const now = dependencies.now ?? Date.now;
  const wait = dependencies.wait ?? ((milliseconds, signal) => sleep(milliseconds, undefined, { signal }));
  const check = dependencies.check ?? ((url, signal) => Effect.runPromise(checkListing(url), { signal }));
  const catalogPath = options.catalog
    ? resolve(options.catalog)
    : fileURLToPath(new URL("../static/kdm-catalog/data.json", import.meta.url));
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
  const starts = new Map<string, number>(Object.entries(checkpoint?.starts ?? {}));
  for (const [listing, result] of resumed) {
    const host = new URL(listing).hostname;
    starts.set(host, Math.max(starts.get(host) ?? 0, Date.parse(result.checkedAt)));
  }
  // Checkpoints survive cancellation and catalog publication conflicts.
  const saveCheckpoint = () =>
    publishFiles([{ path: checkpointPath, json: { complete: false, starts: Object.fromEntries(starts), results: checkpointResults } }]);
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
          const spacing = url.hostname === "shop.kingdomdeath.com" ? 35_000 : 1_000;
          const delay = (starts.get(url.hostname) ?? -Infinity) + spacing - now();
          if (delay > 0) await wait(delay, signal);
          signal.throwIfAborted();
          starts.set(url.hostname, now());
          await saveCheckpoint();
          signal.throwIfAborted();
          let response: Result;
          try {
            const result = await check(url, signal);
            response = { ...result, checkedAt: new Date(now()).toISOString() };
            console.log(`${result.status} ${url}`);
          } catch (error) {
            signal.throwIfAborted();
            response = { status: null, ok: false, checkedAt: new Date(now()).toISOString() };
            console.warn(`Failed ${listing}: ${error instanceof Error ? error.message : String(error)}`);
          }
          results.set(key, response);
          checkpointResults[key] = response;
          await saveCheckpoint();
        }
        const response = results.get(key);
        if (!response) throw new Error(`Missing link result for ${key}`);
        recordShopLink(item, edition, response.ok);
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
      { path: catalogPath, json: organizeCatalog(catalog) },
      { path: reportPath, json: { checkedAt, reachable, unreachable, missing, listings } },
      { path: checkpointPath, json: { complete: true, starts: Object.fromEntries(starts), results: checkpointResults } },
    ],
    {
      baselines: [{ path: catalogPath, text: baseline, message: "Catalog changed during link checks; rerun to preserve your edits." }],
      signal,
    },
  );
  console.log(`Checked listings: ${reachable} reachable, ${unreachable} unreachable, ${missing} without URLs. Report: ${reportPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommand(
    Command.make("check:shop-links", { offline, fetch, catalog: catalogFlag }, (values) =>
      workflow((signal) => checkShopLinks(signal, { offline: offlineMode(values), catalog: values.catalog })),
    ),
  );
}
