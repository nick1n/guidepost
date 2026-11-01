import { catalogTemp, catalogLocal, catalogData } from "../paths.mts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { publishFiles } from "../publication.mts";
import { releaseGaps } from "../update.mts";
import { validateCatalog } from "../validate.mts";
import { categories } from "../types.mts";
import type { Review } from "./schema.mts";
export type { Review } from "./schema.mts";
import { checkTags, organizeTags, sortCatalogTags } from "../tags.mts";
import { organizeCatalog } from "../order.mts";
import { captureInputs, digest, readOptional } from "../inputs.mts";

export function reviewPath(root: string) {
  return join(catalogTemp(root), "reports/kdm-update-review.json");
}

export async function applyReview(review: Review, root: string, newsPath: string, options: { signal?: AbortSignal } = {}) {
  options.signal?.throwIfAborted();
  if (review.unresolved.length) throw new Error("Resolve the unmatched or ambiguous products in the review before applying it");
  const { catalog, mappings, master, sources, baselines } = await captureInputs(root);
  const { path, text: original } = sources.catalog;
  if (sources.catalog.hash !== review.baselineHash) throw new Error("Catalog changed after this review was created; regenerate the review");
  if (sources.schema.hash !== review.schemaHash) throw new Error("Schema changed after this review was created");
  const newsText = review.newsHash ? await readFile(newsPath, "utf8") : undefined;
  if (newsText !== undefined && digest(newsText) !== review.newsHash) throw new Error("News export changed after this review was created");
  if (digest(master.text) !== review.tagsHash) throw new Error("Master tags changed after this review was created; regenerate the review");
  if (digest(master.schemaText) !== review.tagSchemaHash) throw new Error("Tag schema changed after this review was created");
  for (const change of review.changes) catalog[change.category][change.itemId] = change.after;
  if (sources.mappings.hash !== review.mappingsHash)
    throw new Error("Mappings changed after this review was created; regenerate the review");
  checkTags(catalog, master.tags, mappings);
  const availability = review.monthly?.availability;
  if (review.monthly) catalog.shopUpdated = review.monthly.checkedAt.slice(0, 10);
  sortCatalogTags(catalog);
  organizeCatalog(catalog);
  const validation = await validateCatalog(catalog, sources.schema.path);
  const orderedTags = { $schema: "./tags.schema.json", ...organizeTags(catalog, master.tags) };
  if (review.newsHash)
    baselines.push({ path: newsPath, text: newsText, message: "News export changed during review application; regenerate the review." });
  const tagFiles =
    master.reviewed && JSON.stringify(JSON.parse(master.text)) !== JSON.stringify(orderedTags)
      ? [{ path: sources.tags.path, json: orderedTags }]
      : [];
  // A review can change only object-key order, which is absent from the item fact diff.
  if (!review.monthly && !review.changes.length && JSON.stringify(catalog) === JSON.stringify(JSON.parse(original))) {
    await publishFiles(tagFiles, { baselines, signal: options.signal });
    return validation;
  }
  const reportPath = join(catalogTemp(root), "reports/kdm-merge-report.json");
  const reportText = await readOptional(reportPath);
  const report = reportText === undefined ? { validation: {} } : JSON.parse(reportText);
  const importsPath = join(catalogData(root), "news-imports.json");
  const importsText = review.monthly ? await readOptional(importsPath) : undefined;
  if (review.monthly && (importsText === undefined ? null : digest(importsText)) !== review.monthly.importsHash)
    throw new Error("Import history changed after this review was created; regenerate the review");
  if (review.monthly)
    baselines.push({
      path: importsPath,
      text: importsText,
      message: "Import history changed during review application; regenerate the review.",
    });
  baselines.push({
    path: reportPath,
    text: reportText,
    message: "Merge report changed during review application; rerun to preserve its updates.",
  });
  const appliedAt = new Date().toISOString();
  const archive = `archives/catalog-update-${digest(JSON.stringify(review)).slice(0, 16)}.json.gz`;
  const archivePath = join(catalogLocal(root), archive);
  const archiveBytes = gzipSync(JSON.stringify({ ...review, appliedAt, validation }), { level: 9 });
  report.catalogUpdates ??= [];
  report.catalogUpdates.push({
    date: review.date,
    appliedAt,
    archive,
    changedItems: review.changes.map(({ category, itemId }) => ({ category, itemId })),
    validation,
    ...(review.monthly ? { posts: Object.keys(review.monthly.posts), availability } : {}),
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
    [
      { path: archivePath, bytes: archiveBytes },
      ...tagFiles,
      { path, json: catalog },
      { path: reportPath, json: report },
      ...(review.monthly ? [{ path: importsPath, json: { ...JSON.parse(importsText ?? "{}"), ...review.monthly.posts } }] : []),
    ],
    { baselines, signal: options.signal },
  );
  return validation;
}
