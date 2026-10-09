import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { publishFiles } from "./catalog/publication.mts";
import { catalogTemp } from "./catalog/paths.mts";
import { editionComparator, organizeCatalog } from "./catalog/order.mts";
import { editionId } from "./catalog/identity.mts";
import { normalizeItem } from "./catalog/normalize.mts";
import { productUrl, ShopClient, shopProduct } from "./catalog/shop.mts";
import { normalized, variantLabel } from "./catalog/update.mts";
import { validateCatalog } from "./catalog/validate.mts";
import type { Catalog, Edition, Item, Mapping, Product } from "./catalog/types.mts";

export function productEditions(item: Item, product: Product) {
  if (!product.variants.length) throw new Error("Product has no variants");
  const text = product.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const material = /photoresin/i.test(text)
    ? "Photoresin"
    : /\bPVC\b/i.test(text)
      ? "PVC"
      : /hard plastic|plastic miniature/i.test(text)
        ? "Plastic"
        : /\bresin\b/i.test(text)
          ? "Resin"
          : undefined;
  const fallback = material ?? "Box";
  const editions = new Map<string, Edition>();
  const selectors: Record<string, string> = {};
  for (const variant of product.variants) {
    const release = variantLabel(variant, fallback);
    // Warehouse variants select shipping locations, not separate releases.
    const label =
      release === fallback &&
      !/default title|warehouse|united states|united kingdom|australia|canada|\b(?:US|UK|EU|USA|HQ)\b/i.test(variant.title)
        ? variant.title.trim() || fallback
        : release;
    selectors[String(variant.id)] = label;
    const edition = editions.get(label) ?? {
      id: editionId(label, [...editions.values()]),
      label: label,
      ...(item.releaseDate ? { releaseDate: item.releaseDate } : {}),
    };
    const prices = [
      variant.price,
      ...(variant.compare_at_price !== null && variant.compare_at_price > variant.price ? [variant.compare_at_price] : []),
    ];
    edition.prices = [...new Set([...(edition.prices ?? []), ...prices])].sort((a, b) => a - b);
    if (variant.available === true) edition.available = true;
    if (material && label !== "Sim" && material !== label && !/^Deathgrey|^Deathpink/.test(label)) edition.materials = [material];
    if (label === "First Run") {
      const run = text.match(/first run.{0,160}?(?:limited to|limit(?:ed)?(?: edition)? of)\s*([\d,]+)/i);
      if (run) edition.runSize = Number(run[1]!.replaceAll(",", ""));
    }
    editions.set(label, edition);
  }
  return { editions: [...editions.values()], selectors };
}

export async function fillEditions(
  options: { catalog?: string; offline?: boolean; refresh?: boolean; signal?: AbortSignal; client?: Pick<ShopClient, "get"> } = {},
) {
  options.signal?.throwIfAborted();
  const path = resolve(options.catalog ?? "static/kdm-catalog/data.json");
  const original = await readFile(path, "utf8");
  const catalog: Catalog = JSON.parse(original);
  const root = dirname(path);
  const temp = catalogTemp(root);
  const mappingsPath = join(temp, "shopify-products/kdm-shop-mappings.json");
  const mappingText = await readFile(mappingsPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  const mappings: Record<string, Mapping> = JSON.parse(mappingText ?? "{}");
  const schemaPath = join(root, "data.schema.json");
  const schemaText = await readFile(schemaPath, "utf8");
  const news: { links: { itemName: string; shopUrl: string; date: string }[] } = JSON.parse(
    await readFile(resolve(root, "../../exports/kingdom-death-news/news-shop-links.json"), "utf8"),
  );
  const client =
    options.client ?? new ShopClient({ cache: join(temp, "shopify-products/edition-cache"), delay: 33, maxAgeMs: Infinity, ...options });
  const targets = Object.entries(catalog.content).filter(([, item]) => !item.editions?.length);
  const report = {
    startedAt: new Date().toISOString(),
    complete: false,
    requested: targets.length,
    applied: false,
    reachable: [] as { itemId: string; url: string; editions: string[] }[],
    unreachable: [] as { itemId: string; name: string; url?: string; reason: string }[],
  };
  const reportPath = join(temp, "reports/edition-retrieval.json");
  for (const [itemId, item] of targets) {
    options.signal?.throwIfAborted();
    let url: string | undefined;
    try {
      const names = [item.name, ...(item.aliases ?? [])].map(normalized);
      const listing =
        (item.handle ? "/products/" + item.handle : item.url) ??
        news.links
          .filter((row) => names.includes(normalized(row.itemName)) && !/preorder/i.test(row.shopUrl))
          .sort((a, b) => b.date.localeCompare(a.date))[0]?.shopUrl;
      if (!listing) throw new Error("No known non-preorder product URL");
      url = productUrl(listing) + ".js";
      const response = await client.get(url);
      const product = shopProduct(response.data, "ajax");
      if (product.handle !== productUrl(listing).split("/").at(-1)) throw new Error("Response handle does not match listing");
      const result = productEditions(item, product);
      item.editions = result.editions.sort(editionComparator(item, itemId));
      item.handle = product.handle;
      delete item.url;
      delete item.releaseDate;
      delete item.price;
      delete item.priceMinimum;
      normalizeItem(item);
      mappings[product.handle] = { ...mappings[product.handle], category: "content", itemId, variantEditions: result.selectors };
      report.reachable.push({ itemId, url, editions: item.editions.map((e) => e.label) });
      console.log(`${report.reachable.length + report.unreachable.length}/${targets.length}: ${itemId}, ${item.editions.length} editions`);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      report.unreachable.push({
        itemId,
        name: item.name,
        ...(url ? { url } : {}),
        reason: error instanceof Error ? error.message : String(error),
      });
      console.log(`${report.reachable.length + report.unreachable.length}/${targets.length}: ${itemId}, not retrieved`);
    }
    await publishFiles([{ path: reportPath, json: report }], { signal: options.signal });
  }
  organizeCatalog(catalog);
  await validateCatalog(catalog, schemaPath);
  const reportText = await readFile(reportPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  report.complete = true;
  report.applied = true;
  await publishFiles(
    [
      { path: mappingsPath, json: mappings },
      { path, json: catalog },
      { path: reportPath, json: report },
    ],
    {
      baselines: [
        { path, text: original, message: "Catalog changed during retrieval. Cached responses are saved; rerun to preserve your edits." },
        {
          path: mappingsPath,
          text: mappingText,
          message: "Mappings changed during retrieval. Cached responses are saved; rerun to preserve your edits.",
        },
        { path: schemaPath, text: schemaText, message: "Schema changed during retrieval; rerun to validate against the current schema." },
        { path: reportPath, text: reportText, message: "Retrieval report changed during publication; rerun to preserve its updates." },
      ],
      signal: options.signal,
    },
  );
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { catalog: { type: "string" }, offline: { type: "boolean" }, refresh: { type: "boolean" } } });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  try {
    const report = await fillEditions({ ...values, signal: controller.signal });
    console.log(
      `${report.reachable.length} items updated; ${report.unreachable.length} not retrieved. See temp/kdm-catalog/reports/edition-retrieval.json`,
    );
  } finally {
    process.off("SIGINT", cancel);
  }
}
