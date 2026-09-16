import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import type { BundleItem, ContentItem, DiceItem, KingdomDeathCatalog } from "../src/lib/types/gen/kdm-data.d.ts";

const catalogPath = fileURLToPath(new URL("../src/lib/kdm-data.json", import.meta.url));
const catalog: KingdomDeathCatalog = JSON.parse(await readFile(catalogPath, "utf8"));
const results = new Map<string, boolean>();
let reachable = 0;
let unreachable = 0;
let missing = 0;

// ko-fi.com currently returns 403 errors...
for (const category of ["content", "dice", "bundles" /*, "homebrew"*/] as const) {
  for (const item of Object.values<ContentItem | DiceItem | BundleItem>(catalog[category])) {
    if (!item.url) {
      item.shopReachable = null;
      missing++;
      continue;
    }

    if (!results.has(item.url)) {
      try {
        const url = item.url.startsWith("http") ? new URL(item.url) : new URL(item.url, "https://shop.kingdomdeath.com");
        if (results.size > 0) await sleep(1_000);
        const response = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(10_000),
        });
        results.set(item.url, response.ok);
        console.log(`${response.status} ${url}`);
      } catch (error) {
        results.set(item.url, false);
        console.warn(`Failed ${item.url}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    item.shopReachable = results.get(item.url);
    if (item.shopReachable) reachable++;
    else unreachable++;
  }
}

const output = await format(JSON.stringify(catalog), {
  ...(await resolveConfig(catalogPath)),
  filepath: catalogPath,
});
await writeFile(catalogPath, output);
console.log(`Updated catalog: ${reachable} reachable, ${unreachable} unreachable, ${missing} without URLs.`);
