import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { catalogCache } from "./paths.mts";
import { readOptional } from "./inputs.mts";
import { ShopClient, shopProduct } from "./shop.mts";
import type { Product } from "./types.mts";

export interface SnapshotOptions {
  catalog?: string;
  offline?: boolean;
  signal?: AbortSignal;
  client?: Pick<ShopClient, "get">;
}

/** Read exactly two shop pages without publishing caches or changing the catalog. */
export async function readSnapshot(options: SnapshotOptions = {}) {
  options.signal?.throwIfAborted();
  const path = resolve(options.catalog ?? "static/kdm/catalog/data.json");
  const offline = options.offline !== false;
  const folder = join(catalogCache(dirname(path)), "shopify-products");
  const client = options.client ?? new ShopClient({ refresh: true, signal: options.signal });
  const files: { path: string; json: unknown }[] = [];
  const baselines: { path: string; text: string | undefined; message: string }[] = [];
  const products: Product[] = [];
  const cacheTimes: number[] = [];
  for (const page of [1, 2]) {
    options.signal?.throwIfAborted();
    const cachePath = join(folder, `products-page-${page}.json`);
    const text = await readOptional(cachePath);
    baselines.push({ path: cachePath, text, message: "Saved shop snapshot changed during refresh; rerun to preserve those edits." });
  }
  for (const [index, baseline] of baselines.entries()) {
    const page = index + 1;
    const { path: cachePath, text } = baseline;
    options.signal?.throwIfAborted();
    if (offline && text === undefined) throw new Error(`No saved shop page ${page}; run pnpm catalog:availability --fetch to download it.`);
    const raw = offline
      ? JSON.parse(text ?? "")
      : (await client.get(`https://shop.kingdomdeath.com/products.json?limit=250&page=${page}`)).data;
    if (!raw || typeof raw !== "object" || !Array.isArray((raw as { products?: unknown }).products))
      throw new Error(`Invalid products page ${page}; catalog availability was not changed.`);
    if (offline) cacheTimes.push((await stat(cachePath)).mtimeMs);
    const response = raw as { products: unknown[] };
    const normalized = response.products.map((value) => shopProduct(value, "json"));
    if (
      normalized.some((product) => !product.variants.length || product.variants.some((variant) => typeof variant.available !== "boolean"))
    )
      throw new Error(`Missing variant availability on page ${page}; catalog availability was not changed.`);
    if (!offline) files.push({ path: cachePath, json: response });
    products.push(...normalized);
    if (response.products.length > 250 || (page === 2 && response.products.length === 250))
      throw new Error("Shop snapshot exceeds two pages; catalog availability was not changed.");
  }
  if (!products.length) throw new Error("Shop returned no products; catalog availability was not changed.");
  const checkedAt = new Date(offline ? Math.min(...cacheTimes) : Date.now()).toISOString();
  return { products, checkedAt, files, baselines, pages: 2, folder };
}
