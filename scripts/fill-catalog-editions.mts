import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "effect/cli";
import { catalog, offline, refresh, runCommand, workflow } from "./catalog/cli.mts";
import { publishFiles } from "./catalog/publication.mts";
import { catalogTemp } from "./catalog/paths.mts";
import { editionComparator, organizeCatalog } from "./catalog/order.mts";
import { normalizeItem } from "./catalog/normalize.mts";
import { productUrl, ShopClient, shopProduct } from "./catalog/shop.mts";
import { normalized } from "./catalog/update.mts";
import { productEditions } from "./catalog/releases.mts";
import { validateCatalog } from "./catalog/validate.mts";
import type { Catalog, Mapping } from "./catalog/types.mts";

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
  const client = options.client ?? new ShopClient({ cache: join(temp, "shopify-products/edition-cache"), maxAgeMs: Infinity, ...options });
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
  runCommand(
    Command.make("catalog:editions", { catalog, offline, refresh }, (values) =>
      workflow(async (signal) => {
        const report = await fillEditions({ ...values, signal });
        console.log(
          `${report.reachable.length} items updated; ${report.unreachable.length} not retrieved. See temp/kdm-catalog/reports/edition-retrieval.json`,
        );
      }),
    ),
  );
}
