import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "effect/cli";
import { catalog, offline, fetch, offlineMode, runCommand, workflow } from "../cli.mts";
import { publishFiles } from "../publication.mts";
import { availabilityFromUrls } from "../availability.mts";
import { organizeCatalog } from "../order.mts";
import { catalogTemp } from "../paths.mts";
import { readSnapshot, type SnapshotOptions } from "../snapshot.mts";
import { validateCatalog } from "../validate.mts";
import type { Catalog } from "../types.mts";
import { captureWorkbookInputs } from "../inputs.mts";

export async function refreshAvailability(options: SnapshotOptions = {}) {
  options.signal?.throwIfAborted();
  const path = resolve(options.catalog ?? "static/kdm/catalog/data.json");
  const original = await readFile(path, "utf8");
  const schemaPath = join(dirname(path), "data.schema.json");
  const schemaText = await readFile(schemaPath, "utf8");
  const workbookInputs = await captureWorkbookInputs(dirname(path));
  const catalog: Catalog = JSON.parse(original);
  const previousShopUpdated = catalog.shopUpdated;
  const offline = options.offline !== false;
  const { products, checkedAt, files, baselines, pages, folder } = await readSnapshot(options);
  const result = availabilityFromUrls(catalog, products, checkedAt.slice(0, 10));
  const organizedCatalog = organizeCatalog(catalog);
  await validateCatalog(organizedCatalog, schemaPath);
  const reportPath = join(catalogTemp(dirname(path)), "reports/availability-refresh.json");
  await publishFiles(
    [
      ...files,
      ...(result.changed || result.shopChanged || result.tagsChanged || catalog.shopUpdated !== previousShopUpdated
        ? [{ path, json: organizedCatalog }]
        : []),
      {
        path: reportPath,
        json: {
          checkedAt,
          offline,
          pages,
          products: products.length,
          ...result,
        },
      },
    ],
    {
      baselines: [
        { path, text: original, message: "Catalog changed during refresh; rerun to preserve those edits." },
        { path: schemaPath, text: schemaText, message: "Schema changed during refresh; rerun to preserve those edits." },
        ...baselines,
        ...workbookInputs,
      ],
      signal: options.signal,
    },
  );
  return { ...result, pages, products: products.length, catalog: path, folder };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommand(
    Command.make("catalog:availability", { catalog, offline, fetch }, (values) =>
      workflow(async (signal) => {
        const result = await refreshAvailability({ ...values, offline: offlineMode(values), signal });
        console.log(`${result.products} products across ${result.pages} pages saved in ${result.folder}`);
        console.log(`${result.available} available editions; ${result.changed} availability changes. Catalog: ${result.catalog}`);
        console.log(`${result.unmatched.length} editions could not be matched by URL and variant; details: availability-refresh.json`);
      }),
    ),
  );
}
