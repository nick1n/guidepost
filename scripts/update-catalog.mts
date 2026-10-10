import { catalogTemp } from "./catalog/paths.mts";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Flag } from "effect/cli";
import { optionalString, offline, refresh, runCommand, workflow } from "./catalog/cli.mts";
import { gzipSync } from "node:zlib";
import { publishFiles } from "./catalog/publication.mts";
import { keepUrl, loadReport, recoverCachedHistory, saveReport, type Report } from "./scrape-news-shop-links.mts";
import { catalogListing, productUrl, ShopClient, ShopError, shopProduct, loadMappings } from "./catalog/shop.mts";
import { planUpdate, productExclusion, releaseGaps } from "./catalog/update.mts";
import { validateCatalog } from "./catalog/validate.mts";
import { categories, type Catalog, type Evidence, type Mapping } from "./catalog/types.mts";
import { loadTags, checkTags, tagSchema, organizeTags, sortCatalogTags } from "./catalog/tags.mts";
import { organizeCatalog } from "./catalog/order.mts";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function json(path: string) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function applyReview(
  review: {
    baselineHash: string;
    schemaHash: string;
    newsHash: string;
    tagsHash?: string;
    tagSchemaHash?: string;
    changes: { category: (typeof categories)[number]; itemId: string; before: unknown; after: Catalog["content"][string] }[];
    unresolved: unknown[];
    [key: string]: unknown;
  },
  root: string,
  newsPath: string,
  options: { signal?: AbortSignal } = {},
) {
  options.signal?.throwIfAborted();
  if (review.unresolved.length) throw new Error("Resolve the unmatched or ambiguous products in the review before applying it");
  const path = join(root, "data.json");
  const original = await readFile(path, "utf8");
  if (digest(original) !== review.baselineHash) throw new Error("Catalog changed after this review was created; regenerate the review");
  const schemaPath = join(root, "data.schema.json");
  const schemaText = await readFile(schemaPath, "utf8");
  if (digest(schemaText) !== review.schemaHash) throw new Error("Schema changed after this review was created");
  const newsText = await readFile(newsPath, "utf8");
  if (digest(newsText) !== review.newsHash) throw new Error("News export changed after this review was created");
  const master = await loadTags(root);
  if (!review.tagsHash || digest(master.text) !== review.tagsHash)
    throw new Error("Master tags changed or are absent from this review; regenerate the review");
  if (digest(master.schemaText) !== review.tagSchemaHash) throw new Error("Tag schema changed after this review was created");
  const catalog: Catalog = JSON.parse(original);
  for (const change of review.changes) {
    if (JSON.stringify(catalog[change.category][change.itemId] ?? null) !== JSON.stringify(change.before))
      throw new Error("Review baseline differs for " + change.itemId);
    catalog[change.category][change.itemId] = change.after;
  }
  const mappingsPath = join(catalogTemp(root), "shopify-products/kdm-shop-mappings.json");
  const mappingText = await readFile(mappingsPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  const mappings: Record<string, Mapping> = JSON.parse(mappingText ?? "{}");
  checkTags(catalog, master.tags, mappings);
  sortCatalogTags(catalog);
  organizeCatalog(catalog);
  const validation = await validateCatalog(catalog, schemaPath);
  const orderedTags = { $schema: "./kdm-tags.schema.json", ...organizeTags(catalog, master.tags) };
  const tagsPath = join(catalogTemp(root), "kdm-tags.json");
  const tagSchemaPath = join(catalogTemp(root), "kdm-tags.schema.json");
  const tagSchemaText = master.local
    ? master.schemaText
    : await readFile(tagSchemaPath, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      });
  const baselines = [
    { path, text: original, message: "Catalog changed during review application; regenerate the review to preserve your edits." },
    { path: schemaPath, text: schemaText, message: "Schema changed during review application; regenerate the review." },
    { path: newsPath, text: newsText, message: "News export changed during review application; regenerate the review." },
    {
      path: tagsPath,
      text: master.local ? master.text : undefined,
      message: "Master tags changed during review application; regenerate the review.",
    },
    { path: tagSchemaPath, text: tagSchemaText, message: "Tag schema changed during review application; regenerate the review." },
    { path: mappingsPath, text: mappingText, message: "Mappings changed during review application; regenerate the review." },
  ];
  const tagFiles =
    master.local && JSON.stringify(JSON.parse(master.text)) !== JSON.stringify(orderedTags) ? [{ path: tagsPath, json: orderedTags }] : [];
  // A review can change only object-key order, which is absent from the item fact diff.
  if (!review.changes.length && JSON.stringify(catalog) === JSON.stringify(JSON.parse(original))) {
    await publishFiles(tagFiles, { baselines, signal: options.signal });
    return validation;
  }
  const reportPath = join(catalogTemp(root), "reports/kdm-merge-report.json");
  const reportText = await readFile(reportPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  const report = reportText === undefined ? { validation: {} } : JSON.parse(reportText);
  baselines.push({
    path: reportPath,
    text: reportText,
    message: "Merge report changed during review application; rerun to preserve its updates.",
  });
  const appliedAt = new Date().toISOString();
  const archive = `archive/catalog-update-${digest(JSON.stringify(review)).slice(0, 16)}.json.gz`;
  const archivePath = join(catalogTemp(root), "reports", archive);
  const archiveBytes = gzipSync(JSON.stringify({ ...review, appliedAt, validation }), { level: 9 });
  report.catalogUpdates ??= [];
  report.catalogUpdates.push({
    date: review.date,
    appliedAt,
    archive,
    changedItems: review.changes.map(({ category, itemId }) => ({ category, itemId })),
    validation,
  });
  report.counts = Object.fromEntries(categories.map((category) => [category, Object.keys(catalog[category]).length]));
  report.updatedAt = appliedAt;
  report.remainingGaps = releaseGaps(catalog);
  Object.assign(report.validation, validation, {
    uniqueItemIds: validation.items,
    unifiedEditionEntries: validation.editions,
    currentCatalogSchema: "passed",
    currentCatalogReferences: "passed",
  });
  await publishFiles(
    [{ path: archivePath, bytes: archiveBytes }, ...tagFiles, { path, json: catalog }, { path: reportPath, json: report }],
    { baselines, signal: options.signal },
  );
  return validation;
}

const updateFlags = {
  catalog: Flag.String("catalog").pipe(Flag.withDefault("static/kdm-catalog")),
  news: Flag.String("news").pipe(Flag.withDefault("exports/kingdom-death-news")),
  cache: Flag.String("cache").pipe(Flag.withDefault(".cache/kdm-shop")),
  mappings: optionalString("mappings"),
  review: optionalString("review"),
  date: optionalString("date"),
  delay: Flag.String("delay").pipe(Flag.withDefault("35")),
  refresh,
  offline,
  sim: Flag.Boolean("sim"),
  apply: Flag.Boolean("apply"),
  "apply-review": optionalString("apply-review"),
  "tags-only": Flag.Boolean("tags-only"),
  "tags-schema": Flag.Boolean("tags-schema"),
};

type UpdateFlags = Command.Command.Config.Infer<typeof updateFlags>;
async function main(values: UpdateFlags, signal: AbortSignal) {
  signal.throwIfAborted();
  const root = values.catalog;
  const newsPath = join(values.news, "news-shop-links.json");
  if (values["tags-schema"]) {
    const existing = await json(join(catalogTemp(root), "kdm-tags.schema.json"));
    const schema = tagSchema(existing.$defs.tag.enum);
    schema.$defs = { ...schema.$defs, ...existing.$defs };
    await publishFiles([{ path: join(catalogTemp(root), "kdm-tags.schema.json"), json: schema }], { signal });
    console.log("Refreshed tag vocabulary schema; item IDs are unrestricted and master tag assignments are unchanged.");
    return;
  }
  if (values["apply-review"]) {
    console.log(await applyReview(await json(values["apply-review"]), root, newsPath, { signal }));
    return;
  }
  const master = await loadTags(root);
  if (values["tags-only"]) {
    const baselineText = await readFile(join(root, "data.json"), "utf8");
    const mappings = await loadMappings(root, values.mappings);
    const plan = planUpdate(JSON.parse(baselineText), [], mappings, [], master.tags);
    const { catalog, ...summary } = plan;
    const validation = await validateCatalog(catalog, join(root, "data.schema.json"));
    const review = {
      preparedAt: new Date().toISOString(),
      date: "tags-only",
      baselineHash: digest(baselineText),
      schemaHash: digest(await readFile(join(root, "data.schema.json"), "utf8")),
      newsHash: digest(await readFile(newsPath, "utf8")),
      tagsHash: digest(master.text),
      tagSchemaHash: digest(master.schemaText),
      ...summary,
      validation,
      requests: [],
    };
    const reviewPath = values.review ?? join(catalogTemp(root), "reports/kdm-update-review.json");
    await publishFiles([{ path: reviewPath, json: review }], { signal });
    console.log(`${plan.changes.length} tag changes, 0 shop requests. Review: ${reviewPath}`);
    if (values.apply) console.log(await applyReview(review, root, newsPath, { signal }));
    return;
  }
  const storedNews: Report = await json(newsPath);
  const loadedNews = await loadReport(values.news);
  const news = { ...loadedNews, ...storedNews, posts: loadedNews.posts, links: loadedNews.links };
  await recoverCachedHistory(news, ".cache/kingdom-death-news");
  await saveReport(news, values.news);
  if (!news.complete) throw new Error("News export is partial; finish scrape:news before preparing a catalog update");
  const mappings: Record<string, Mapping> = await loadMappings(root, values.mappings);
  const baselineText = await readFile(join(root, "data.json"), "utf8");
  const before: Catalog = JSON.parse(baselineText);
  const date = values.date ?? news.posts.reduce((latest, post) => (post.date > latest ? post.date : latest), "");
  const links = news.links.filter((row) => row.date === date && keepUrl(row.shopUrl));
  if (!links.length) throw new Error("No linked products in the news export for " + date);
  const excludedLinks: { handle: string; reason: string }[] = [];
  const client = new ShopClient({
    cache: values.cache,
    delay: Number(values.delay),
    refresh: values.refresh,
    offline: values.offline,
    signal,
  });
  const evidence: Evidence[] = [];
  const unavailable: { url: string; status: number; cached: boolean }[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const handle = new URL(productUrl(link.shopUrl)).pathname.split("/").at(-1)!;
    const exclusion = productExclusion(handle, link.itemName);
    if (exclusion) {
      excludedLinks.push({ handle, reason: exclusion });
      continue;
    }
    const result = await client.product(link.shopUrl);
    const product = result.data;
    if (seen.has(product.handle)) continue;
    seen.add(product.handle);
    evidence.push({ ...result, data: product });
  }
  if (values.sim) {
    const result = await client.get("https://shop.kingdomdeath.com/collections/kingdom-death-simulator/products.json?limit=250");
    for (const raw of (result.data as { products: Record<string, unknown>[] }).products) {
      const product = shopProduct(raw);
      if (seen.has(product.handle)) continue;
      seen.add(product.handle);
      evidence.push({ ...result, data: product });
    }
    for (const category of categories)
      for (const item of Object.values(before[category]))
        for (const edition of item.editions ?? []) {
          const listing = catalogListing(item, edition);
          if (!edition.simulator || !listing) continue;
          const url = productUrl(listing);
          const handle = new URL(url).pathname.split("/").at(-1)!;
          if (seen.has(handle)) continue;
          seen.add(handle);
          try {
            const result = await client.product(url);
            evidence.push(result);
          } catch (error) {
            if (!(error instanceof ShopError) || ![404, 410].includes(error.status)) throw error;
            unavailable.push({ url: error.url, status: error.status, cached: error.cached });
          }
        }
  }
  const plan = planUpdate(before, evidence, mappings, news.links, master.tags);
  const validation = await validateCatalog(plan.catalog, join(root, "data.schema.json"));
  const review = {
    preparedAt: new Date().toISOString(),
    date,
    baselineHash: digest(baselineText),
    schemaHash: digest(await readFile(join(root, "data.schema.json"), "utf8")),
    newsHash: digest(await readFile(newsPath, "utf8")),
    tagsHash: digest(master.text),
    tagSchemaHash: digest(master.schemaText),
    changes: plan.changes,
    sources: plan.sources,
    unavailable,
    unresolved: plan.unresolved,
    releaseGaps: plan.releaseGaps,
    excluded: [...excludedLinks, ...plan.excluded],
    warnings: [
      ...plan.warnings,
      ...unavailable.map(
        (source) => `${source.url}: HTTP ${source.status}; existing facts remain unchanged and missing prices remain unknown.`,
      ),
    ],
    requests: client.requests,
    validation,
  };
  const reviewPath = values.review ?? join(catalogTemp(root), "reports/kdm-update-review.json");
  await publishFiles([{ path: reviewPath, json: review }], { signal });
  console.log(
    `${plan.changes.length} item changes, ${plan.unresolved.length} products to resolve, ${client.requests.length} shop requests. Review: ${reviewPath}`,
  );
  console.log(
    `${plan.releaseGaps.missingEditions.length} content items lack editions; ${plan.releaseGaps.missingDates.length} edition dates need source review.`,
  );
  if (values.apply) console.log(await applyReview(review, root, newsPath, { signal }));
}

const updateCommand = Command.make("catalog:update", updateFlags, (values) => workflow((signal) => main(values, signal))).pipe(
  Command.withDescription("Stage a source-backed catalog review. Shop reads are spaced at least 35 seconds apart."),
);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCommand(updateCommand);
}
