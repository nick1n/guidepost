import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "effect/cli";
import { catalog, offline, runCommand, workflow } from "./catalog/cli.mts";
import { publishFiles } from "./catalog/publication.mts";
import { availabilityFromUrls } from "./catalog/availability.mts";
import { organizeCatalog } from "./catalog/order.mts";
import { catalogTemp } from "./catalog/paths.mts";
import { ShopClient, shopProduct } from "./catalog/shop.mts";
import type { Catalog, Product } from "./catalog/types.mts";

export async function refreshAvailability(
  options: { catalog?: string; offline?: boolean; signal?: AbortSignal; client?: Pick<ShopClient, "get"> } = {},
) {
  options.signal?.throwIfAborted();
  const path = resolve(options.catalog ?? "static/kdm-catalog/data.json");
  const original = await readFile(path, "utf8");
  const catalog: Catalog = JSON.parse(original);
  const folder = join(catalogTemp(dirname(path)), "shopify-products");
  const client = options.client ?? new ShopClient({ refresh: true, signal: options.signal });
  const pages: { products: unknown[] }[] = [];
  const products: Product[] = [];
  for (let page = 1; ; page++) {
    options.signal?.throwIfAborted();
    if (page > 100) throw new Error("Shop pagination exceeded 100 pages; catalog availability was not changed.");
    const raw = options.offline
      ? JSON.parse(await readFile(join(folder, `products-page-${page}.json`), "utf8"))
      : (await client.get(`https://shop.kingdomdeath.com/products.json?limit=250&page=${page}`)).data;
    if (!raw || typeof raw !== "object" || !Array.isArray((raw as { products?: unknown }).products))
      throw new Error(`Invalid products page ${page}; catalog availability was not changed.`);
    const response = raw as { products: unknown[] };
    const normalized = response.products.map((value) => shopProduct(value, "json"));
    if (
      normalized.some((product) => !product.variants.length || product.variants.some((variant) => typeof variant.available !== "boolean"))
    )
      throw new Error(`Missing variant availability on page ${page}; catalog availability was not changed.`);
    pages.push(response);
    products.push(...normalized);
    if (response.products.length < 250) break;
  }
  if (!products.length) throw new Error("Shop returned no products; catalog availability was not changed.");
  const result = availabilityFromUrls(catalog, products);
  const reportPath = join(catalogTemp(dirname(path)), "reports/availability-refresh.json");
  await publishFiles(
    [
      ...(options.offline ? [] : pages.map((page, index) => ({ path: join(folder, `products-page-${index + 1}.json`), json: page }))),
      ...(result.changed ? [{ path, json: organizeCatalog(catalog) }] : []),
      {
        path: reportPath,
        json: {
          checkedAt: new Date().toISOString(),
          offline: options.offline === true,
          pages: pages.length,
          products: products.length,
          ...result,
        },
      },
    ],
    {
      baselines: [{ path, text: original, message: "Catalog changed during refresh; rerun to preserve those edits." }],
      signal: options.signal,
    },
  );
  return { ...result, pages: pages.length, products: products.length, catalog: path, folder };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommand(
    Command.make("catalog:availability", { catalog, offline }, (values) =>
      workflow(async (signal) => {
        const result = await refreshAvailability({ ...values, signal });
        console.log(`${result.products} products across ${result.pages} pages saved in ${result.folder}`);
        console.log(`${result.available} available editions; ${result.changed} availability changes. Catalog: ${result.catalog}`);
        console.log(`${result.unmatched.length} editions could not be matched by URL and variant; details: availability-refresh.json`);
      }),
    ),
  );
}
