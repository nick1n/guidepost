The review catalog has 892 items and 1117 editions. It combines the app catalog, collection workbook, and cached news. The live app still reads `src/lib/kdm-data.json`; this export needs app integration before adoption.

| File                                                         | Purpose                                     |
| ------------------------------------------------------------ | ------------------------------------------- |
| [Catalog](./kdm-data.json), [schema](./kdm-data.schema.json) | Product facts and relationships             |
| [News export](../kingdom-death-news/news-shop-links.json)    | Cached announcement dates and product links |

The Git-ignored `temp/kdm-catalog/kdm-tags.json` and `temp/kdm-catalog/kdm-tags.schema.json` files are optional personal review tools. Apply your edits with `pnpm catalog:tags --apply` before deleting both files. Without the local assignments, updates and validation use the tags saved in `kdm-data.json`. Edit local tags in `temp/kdm-catalog/kdm-tags.json`. Allowed values live in `temp/kdm-catalog/kdm-tags.schema.json` under `$defs.tag.enum`. VS Code provides tag-value completions and flags misspellings, empty arrays, and duplicates. The schema accepts any item key; merging checks missing and unknown IDs. While local assignments are present, stored catalog tags come exactly from that file, preserving assignment order.

```bash
pnpm catalog:tags
pnpm catalog:tags --apply
pnpm catalog:validate
```

The first command prepares a review; the second prepares and applies the current assignments. Tag-only commands make no shop requests. `pnpm catalog:tags-schema` refreshes the schema structure while preserving the vocabulary and custom tag definitions. Catalog additions do not require per-ID schema regeneration.

For news updates:

```bash
pnpm scrape:news
pnpm catalog:update --sim
pnpm catalog:update --apply-review temp/kdm-catalog/reports/kdm-update-review.json
pnpm catalog:validate
```

Reports and archives stay local in the Git-ignored `temp/kdm-catalog/reports/` folder. The updater creates a new merge report when none exists. Updates stage a review by default. Unknown products require curated mappings and reviewed tags. Use `--date YYYY-MM-DD` for another cached article, `--offline` for cached shop evidence, and `--refresh` to refresh shop responses. Shop requests start at least 35 seconds apart, reuse responses for 24 hours, and have no automatic retries. A 404/410 preserves existing facts; other failures stop preparation. Applying a stale review is rejected if the catalog, schemas, news, or master tags changed.

The news scraper collects announcement links. The catalog updater reads each product's `.js` endpoint, preserving the complete response in the cache, including availability and other storefront metadata. Product prices already use integer cents. Sim collection listings use `products.json`, whose dollar prices convert to cents during normalization. Source tags remain evidence; catalog tags still come from the reviewed master file. Offline updates prefer `.js` caches and can reuse existing `.json` product caches without requesting the shop.

Undated Encore editions without a release window inherit the same item's First Run date, or its Deathgrey date when First Run has none. This is a user-approved assumption; known Encore dates remain unchanged.

Current data rules:

- IDs are object keys. Sets, expansions, vignettes, armor kits, Beta models, singular Pinups, busts, Painter's Scale products, dice, and shirts use their established prefixes. Named boxed collections are sets; couples and grouped expansion miniatures are models.
- Matching standard models, busts, and painter's scale products share an item, with separate selectable editions. Single artist releases use Painters or Bust; multiple releases use labels such as Painters: First Run and Bust: Encore. Distinct themes, remasters, and unmatched artist models remain separate. Beta/Plastic consolidation remains pending. Morgan's bust belongs to Morgan the Savior, and the White Speaker painter's scale belongs to White Speaker Koshka (formerly White Speaker). Senior Death High Allister and Thief Variant remain separate.
- Gameplay defaults to false. Item `gameplay` appears only when true; editions store an override only when different. `gameplayContent` and notes belong on the item. Alternative names use `aliases`; `alt` is removed.
- Edition availability defaults to false. Store `available: true` only when at least one matching shop variant or warehouse is available. Updates refresh known availability; responses without availability evidence preserve the existing value. This reflects the cached shop snapshot, not a live stock check.
- Prices are integer cents. Edition `$` arrays contain recorded sale amounts and current MSRP, with the maximum representing MSRP. Missing prices are unknown; `[0]` is a known zero price. Lunar Aya's Sim price remains the user-authorized $7 estimate, documented in the report.
- Shared URLs live on the item; resolve listings with `edition.url ?? item.url`. Variant selectors and temporary preorder URLs are omitted. Physical sizes may inherit the item default; Sim has no model size.
- Exact dates remain edition `r`, formatted YYYY-MM-DD. Imprecise dates use `releaseWindow`; future quarters use YYYY Qn. Unknown run counts are omitted. Released expansion dates use the public shop launch announcement when only a month was documented.
- `includes` remains on the item. Child `edition` selects a release, and `parentEditions` scopes the containing release. Physical contents require a physical parent; Sim contents require Sim. Reverse membership is derived. Satan Pledge preserves its 184 exact release references.
- Both catalog and master tag files share category and family ordering. Only expansions sort by release date; other groups sort alphabetically by ID. Editions sort by Sim, Box, First Run, Deathgrey, Deathgrey M2, Deathpink, Encore, Plastic, Painters, and Bust. Run-qualified artist editions use the same order within their format. Other existing labels, including General, material releases, and numbered versions, remain available afterward.

The schema retains ID-pattern rules and basic field validation without conditional branches. The CLI additionally checks references, cycles, edition labels, real dates, normalization, and ordering.

Before adopting this export, update the app's older catalog shape and migrate saved item IDs and edition selections. Historical migration maps are retained in the optional local archive at `temp/kdm-catalog/reports/archive/kdm-merge-history.json.gz`. Archives are ignored by Git and are not required to use the catalog or run updates. No collection ownership is inferred from ambiguous material or run choices. The original workbook remains in `temp/kdm-catalog/imports/KDM Collection Sheets.xlsx`; 705 active rows have catalog pointers, and excluded rows are preserved in the archive.

The Git-ignored `temp/kdm-catalog/imports/` folder contains temporary workbook data. Validation checks import records and their schema when records are present; catalog updates and validation also work without them. After completing the Excel import, you can remove this folder. Optional shop mappings live in the Git-ignored `temp/kdm-catalog/shopify-products/kdm-shop-mappings.json` file. Updates work without this file; unknown or ambiguous products remain in the review for resolution. An explicit `--mappings` path must exist.

All optional working files live under the workspace's `temp/kdm-catalog/` folder, covered by the single `/temp/` ignore rule. Store product snapshots and mappings share `shopify-products/`. Maintained catalog data and its schema remain here in `exports/kdm-catalog/`. Custom catalog paths follow the same `exports/` and `temp/` workspace layout.

Refresh shop availability independently with `pnpm catalog:availability`. It downloads `/products.json?limit=250&page=N`, at least 35 seconds between requests, into `temp/kdm-catalog/shopify-products/products-page-N.json`. After every page succeeds, it updates only edition `available` fields in this catalog. Each `edition.url ?? item.url` must resolve to the product handle; names and optional mappings are not used. Named release variants distinguish First Run, Encore, and format-qualified runs. Any matching warehouse with `available: true` makes that edition available; unmatched or ambiguous editions omit the field. Details go to `temp/kdm-catalog/reports/availability-refresh.json`.

Use `pnpm catalog:availability --offline` to apply the saved pages without downloading, or `--catalog path/to/exports/kdm-catalog/kdm-data.json` to select a different catalog. Failed downloads leave the named snapshots and catalog unchanged. Catalog edits made during the refresh prevent the catalog write.
