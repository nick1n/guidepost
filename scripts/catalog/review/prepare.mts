import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Schema } from "effect";
import { refreshNews, keepUrl, postFingerprints, type RefreshOptions } from "../../news/scrape-shop-links.mts";
import { readSnapshot } from "../snapshot.mts";
import { ShopClient, ShopError, productUrl } from "../shop.mts";
import { catalogChanges, planUpdate, productExclusion } from "../update.mts";
import { organizeCatalog } from "../order.mts";
import { validateCatalog } from "../validate.mts";
import { publishFiles } from "../publication.mts";
import { availabilityFromUrls } from "../availability.mts";
import { catalogData } from "../paths.mts";
import { reviewPath, type Review } from "./apply.mts";
import { CatalogInputError, hash } from "./schema.mts";
import { captureInputs, digest, readOptional } from "../inputs.mts";
import { itemDifferences, listingDetails, resolutionDetails, type Difference, type Listing } from "./details.mts";
import type { Evidence } from "../types.mts";

const importsSchema = Schema.Record(Schema.String, hash);

type Options = {
  catalog?: string;
  news?: string;
  cache?: string;
  newsCache?: string;
  fetch?: boolean;
  refreshPosts?: boolean;
  signal?: AbortSignal;
  client?: Pick<ShopClient, "get" | "product">;
  downloader?: RefreshOptions["downloader"];
};

/** Prepare a monthly review without changing the catalog or acknowledging news imports. */
export async function prepareUpdate(options: Options = {}) {
  options.signal?.throwIfAborted();
  const root = options.catalog ?? "static/kdm/catalog";
  const { catalog: before, mappings, master, sources, baselines } = await captureInputs(root);
  const importsPath = join(catalogData(root), "news-imports.json");
  const importsText = await readOptional(importsPath);
  let imported: Record<string, string>;
  try {
    imported = Schema.decodeUnknownSync(importsSchema)(JSON.parse(importsText ?? "{}"));
  } catch (cause) {
    throw new CatalogInputError({
      message: `Invalid news import ledger at ${importsPath}; restore valid JSON with lowercase 64-character SHA256 hashes before rerunning catalog:update.`,
      cause,
    });
  }
  const newsFolder = options.news ?? "scripts/news";
  const news = await refreshNews({
    output: newsFolder,
    cache: options.newsCache,
    fetch: options.fetch,
    refreshPosts: options.refreshPosts,
    signal: options.signal,
    downloader: options.downloader,
  });
  const newsPath = join(newsFolder, "shop-links.json");
  const newsText = await readFile(newsPath, "utf8");
  const posts = postFingerprints(news);
  const pending = new Set(Object.keys(posts).filter((url) => imported[url] !== posts[url]));
  const client =
    options.client ?? new ShopClient({ cache: options.cache, refresh: options.fetch, offline: !options.fetch, signal: options.signal });
  const snapshot = await readSnapshot({ catalog: sources.catalog.path, offline: !options.fetch, signal: options.signal, client });
  const evidence = new Map<string, Evidence>();
  const excluded: { handle: string; reason: string }[] = [];
  for (const product of snapshot.products) {
    const reason = productExclusion(product.handle, product.title, mappings[product.handle]);
    if (reason) excluded.push({ handle: product.handle, reason });
    else evidence.set(product.handle, { url: productUrl("/products/" + product.handle), checkedAt: snapshot.checkedAt, data: product });
  }
  const unavailable: { handle: string; reason: string }[] = [];
  const seen = new Set(snapshot.products.map((product) => product.handle));
  for (const link of news.links) {
    if (!pending.has(link.postUrl) || !keepUrl(link.shopUrl)) continue;
    options.signal?.throwIfAborted();
    const url = productUrl(link.shopUrl);
    const handle = new URL(url).pathname.split("/").at(-1)!;
    if (seen.has(handle)) continue;
    seen.add(handle);
    const reason = productExclusion(handle, link.itemName, mappings[handle]);
    if (reason) {
      excluded.push({ handle, reason });
      continue;
    }
    try {
      const source = await client.product(url);
      evidence.set(source.data.handle, source);
    } catch (error) {
      if (!(error instanceof ShopError) || ![404, 410].includes(error.status)) throw error;
      unavailable.push({ handle, reason: `HTTP ${error.status}; resolve this missing announcement listing before applying` });
    }
  }
  const plan = planUpdate(before, [...evidence.values()], mappings, news.links, master.tags);
  const preview = plan.catalog;
  const availability = availabilityFromUrls(preview, snapshot.products, snapshot.checkedAt.slice(0, 10));
  organizeCatalog(preview);
  const validation = await validateCatalog(preview, sources.schema.path);
  const changes = catalogChanges(before, preview);
  const changedItems = new Set(changes.map(({ category, itemId }) => `${category}/${itemId}`));
  const listings = new Map<string, Listing[]>();
  for (const source of plan.sources) {
    const key = `${source.category}/${source.itemId}`;
    if (!changedItems.has(key)) continue;
    const listing = evidence.get(source.handle);
    if (listing) listings.set(key, [...(listings.get(key) ?? []), listingDetails(listing, source.confidence)]);
  }
  const review = {
    preparedAt: new Date().toISOString(),
    date: "monthly",
    baselineHash: sources.catalog.hash,
    schemaHash: sources.schema.hash,
    newsHash: digest(newsText),
    tagsHash: digest(master.text),
    tagSchemaHash: digest(master.schemaText),
    mappingsHash: sources.mappings.hash,
    changes: changes.map(({ category, itemId, before, after }) => ({
      category,
      itemId,
      differences: itemDifferences(before, after),
      after,
      listings: listings.get(`${category}/${itemId}`) ?? [],
    })),
    unresolved: [...plan.unresolved, ...unavailable].map((issue) => {
      const listing = evidence.get(issue.handle);
      return {
        ...issue,
        ...(listing ? { listing: listingDetails(listing) } : {}),
        resolution: resolutionDetails(issue, before, mappings, sources.mappings.path),
      };
    }),
    excluded: excluded.length + plan.excluded.length,
    warnings: plan.warnings,
    validation,
    monthly: {
      posts: Object.fromEntries([...pending].map((url) => [url, posts[url]!])),
      availability: { ...availability, unmatched: availability.unmatched.length },
      importsHash: importsText === undefined ? null : digest(importsText),
      checkedAt: snapshot.checkedAt,
    },
  } satisfies Review;
  const target = reviewPath(root);
  await publishFiles([...snapshot.files, { path: target, json: review }], {
    signal: options.signal,
    baselines: [
      ...baselines,
      { path: newsPath, text: newsText, message: "News changed during preparation; rerun catalog:update." },
      { path: importsPath, text: importsText, message: "Import history changed during preparation; rerun catalog:update." },
      ...snapshot.baselines,
    ],
  });
  return { review, path: target, announcements: pending.size };
}

function changedFields(differences: Difference[]) {
  const fields = new Set<string>();
  const labels: Record<string, string> = {
    price: "prices",
    prices: "prices",
    priceMinimum: "prices",
    priceEstimated: "prices",
    handle: "links",
    url: "links",
    urls: "links",
    releaseDate: "release dates",
    releaseWindow: "release dates",
    available: "availability",
    shop: "stock",
    label: "edition labels",
  };
  for (const { field, change } of differences) {
    if (field === "editions.order") fields.add("edition order");
    else if (field.startsWith("editions[") && field.endsWith("]")) {
      fields.add(change === "added" ? "editions added" : "editions removed");
    } else {
      const key = field.replace(/^editions\[[^\]]+\]\./, "");
      fields.add(labels[key] ?? key.replace(/[A-Z]/g, (letter) => " " + letter.toLowerCase()));
    }
  }
  const names = [...fields];
  return names.slice(0, 3).join(", ") + (names.length > 3 ? `, +${names.length - 3} more` : "");
}

export function summarizeReview(review: Review) {
  const changes = `${review.changes.length} catalog ${review.changes.length === 1 ? "change" : "changes"}`;
  const decisions = review.unresolved.length === 1 ? "1 product needs a decision" : `${review.unresolved.length} products need decisions`;
  const lines = [`${changes}; ${decisions}.`];
  if (review.monthly?.availability) {
    const { changed, shopChanged } = review.monthly.availability;
    lines.push(`${changed} availability changes; ${shopChanged} stock changes from the captured snapshot (${review.monthly.checkedAt}).`);
  }
  for (const change of review.changes) {
    const added = change.differences.some(({ field, change }) => field === "item" && change === "added");
    const detail = added ? "" : changedFields(change.differences);
    lines.push(`  ${added ? "Add" : "Update"}: ${change.after.name} (${change.itemId})${detail ? ": " + detail : ""}`);
  }
  for (const { handle, reason } of review.unresolved) {
    lines.push(`  Resolve: ${handle}: ${reason}`);
  }
  const warnings = [...new Set(review.warnings)];
  if (warnings.length) {
    lines.push(`Warnings (${warnings.length}):`);
    for (const warning of warnings.slice(0, 3)) lines.push(`  - ${warning}`);
    if (warnings.length > 3) lines.push(`  ${warnings.length - 3} more in the review file.`);
  }
  return lines.join("\n");
}
