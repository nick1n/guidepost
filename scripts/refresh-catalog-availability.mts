import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { format, resolveConfig } from "prettier";
import { availabilityFromUrls } from "./catalog/availability.mts";
import { catalogTemp } from "./catalog/paths.mts";
import { ShopClient, shopProduct } from "./catalog/shop.mts";
import type { Catalog, Product } from "./catalog/types.mts";

async function save(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const text = await format(JSON.stringify(value), { ...(await resolveConfig(path)), parser: "json" });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, text);
  await rename(temporary, path);
}

export async function refreshAvailability(
  options: { catalog?: string; offline?: boolean; signal?: AbortSignal; client?: Pick<ShopClient, "get"> } = {},
) {
  const path = resolve(options.catalog ?? "exports/kdm-catalog/kdm-data.json");
  const original = await readFile(path, "utf8");
  const catalog: Catalog = JSON.parse(original);
  const folder = join(catalogTemp(dirname(path)), "shopify-products");
  const client = options.client ?? new ShopClient({ refresh: true, signal: options.signal });
  const pages: { products: unknown[] }[] = [];
  const products: Product[] = [];
  for (let page = 1; ; page++) {
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
  // Downloads can take minutes. Refuse to overwrite edits made while fetching.
  if ((await readFile(path, "utf8")) !== original) throw new Error("Catalog changed during refresh; rerun to preserve those edits.");
  if (!options.offline) for (const [index, page] of pages.entries()) await save(join(folder, `products-page-${index + 1}.json`), page);
  await save(join(catalogTemp(dirname(path)), "reports/availability-refresh.json"), {
    checkedAt: new Date().toISOString(),
    offline: options.offline === true,
    pages: pages.length,
    products: products.length,
    ...result,
  });
  if (result.changed) {
    if ((await readFile(path, "utf8")) !== original) throw new Error("Catalog changed during refresh; rerun to preserve those edits.");
    await save(path, catalog);
  }
  return { ...result, pages: pages.length, products: products.length, catalog: path, folder };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { catalog: { type: "string" }, offline: { type: "boolean" } } });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  let result;
  try {
    result = await refreshAvailability({ ...values, signal: controller.signal });
  } finally {
    process.off("SIGINT", cancel);
  }
  console.log(`${result.products} products across ${result.pages} pages saved in ${result.folder}`);
  console.log(`${result.available} available editions; ${result.changed} availability changes. Catalog: ${result.catalog}`);
  console.log(`${result.unmatched.length} editions could not be matched by URL and variant; details: availability-refresh.json`);
}
