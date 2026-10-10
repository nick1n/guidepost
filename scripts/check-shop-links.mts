import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { Command } from "effect/cli";
import { runCommand, workflow } from "./catalog/cli.mts";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import type { Catalog, Edition } from "#lib/types/index.ts";
import { catalogTemp } from "./catalog/paths.mts";

export class LinkRequestError extends Schema.TaggedError<LinkRequestError>()("LinkRequestError", { cause: Schema.Defect() }) {}
export const checkListing = Effect.fn("CatalogLinks.checkListing")((url: URL) =>
  HttpClient.head(url.href).pipe(
    Effect.map((response) => ({ status: response.status, ok: response.status >= 200 && response.status < 300 })),
    Effect.timeout(10_000),
    Effect.mapError((cause) => new LinkRequestError({ cause })),
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "follow" }),
  ),
);
export async function checkShopLinks(signal: AbortSignal) {
  const catalogPath = fileURLToPath(new URL("../static/kdm-catalog/data.json", import.meta.url));
  const catalog: Catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const reportPath = join(catalogTemp(dirname(catalogPath)), "reports/shop-links.json");
  const listings: { category: string; itemId: string; edition?: string; url?: string; reachable: boolean | null }[] = [];
  const results = new Map<string, boolean>();
  let reachable = 0;
  let unreachable = 0;
  let missing = 0;

  // ko-fi.com currently returns 403 errors...
  for (const category of ["content", "included-only", "accessories", "bundles" /*, "homebrew"*/] as const) {
    signal.throwIfAborted();
    for (const [itemId, item] of Object.entries(catalog[category])) {
      const editions: Partial<Edition>[] = item.editions?.length ? item.editions : [{}];
      for (const edition of editions) {
        const handle = item.handle ?? edition.handle;
        const listing = handle ? `https://shop.kingdomdeath.com/products/${handle}` : (edition.url ?? item.url);
        if (!listing) {
          listings.push({ category, itemId, edition: edition.label, reachable: null });
          missing++;
          continue;
        }

        if (!results.has(listing)) {
          try {
            const url = listing.startsWith("http") ? new URL(listing) : new URL(listing, "https://shop.kingdomdeath.com");
            if (results.size > 0) await sleep(1_000, undefined, { signal });
            const response = await Effect.runPromise(checkListing(url), { signal });
            results.set(listing, response.ok);
            console.log(`${response.status} ${url}`);
          } catch (error) {
            signal.throwIfAborted();
            results.set(listing, false);
            console.warn(`Failed ${listing}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        const success = results.get(listing)!;
        listings.push({ category, itemId, edition: edition.label, url: listing, reachable: success });
        if (success) reachable++;
        else unreachable++;
      }
    }
  }

  const output = await format(JSON.stringify({ checkedAt: new Date().toISOString(), reachable, unreachable, missing, listings }), {
    ...(await resolveConfig(reportPath)),
    filepath: reportPath,
  });
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, output);
  console.log(`Checked listings: ${reachable} reachable, ${unreachable} unreachable, ${missing} without URLs. Report: ${reportPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommand(Command.make("check:shop-links", {}, () => workflow(checkShopLinks)));
}
