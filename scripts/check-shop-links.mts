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
  if (reachable && previous && (previous === "in-stock" || previous === "out-of-stock")) return;
  // A successful HEAD clears link failures without claiming to check stock.
  if (reachable) delete target.shop;
  else target.shop = "missing";
}

export async function checkShopLinks(signal: AbortSignal, options: { offline?: boolean; catalog?: string } = {}) {
  const catalogPath = options.catalog
    ? resolve(options.catalog)
    : fileURLToPath(new URL("../static/kdm-catalog/data.json", import.meta.url));
  const reportPath = join(catalogTemp(dirname(catalogPath)), "reports/shop-links.json");
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
  type Result = { status: number | null; ok: boolean };
  const listings: {
    category: string;
    itemId: string;
    editionId: string;
    edition?: string;
    url?: string;
    reachable: boolean | null;
    status: number | null;
  }[] = [];
  const results = new Map<string, Result>();
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
        if (!results.has(listing)) {
          try {
            const url = new URL(listing, "https://shop.kingdomdeath.com");
            if (results.size > 0) await sleep(35_000, undefined, { signal });
            const response = await Effect.runPromise(checkListing(url), { signal });
            results.set(listing, response);
            console.log(`${response.status} ${url}`);
          } catch (error) {
            signal.throwIfAborted();
            results.set(listing, { status: null, ok: false });
            console.warn(`Failed ${listing}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        const response = results.get(listing)!;
        recordShopLink(item, edition, response.ok);
        listings.push({
          category,
          itemId,
          editionId: edition.id,
          edition: edition.label,
          url: listing,
          reachable: response.ok,
          status: response.status,
        });
        if (response.ok) reachable++;
        else unreachable++;
      }
    }
  }
  const checkedAt = new Date().toISOString();
  catalog.shopUpdated = checkedAt.slice(0, 10);
  await publishFiles(
    [
      { path: catalogPath, json: organizeCatalog(catalog) },
      { path: reportPath, json: { checkedAt, reachable, unreachable, missing, listings } },
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
