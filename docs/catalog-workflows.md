# Catalog workflows

This guide covers catalog commands and local operational data. For catalog facts and authoring decisions, see the [catalog guide](kdm-catalog.md).

In `scripts/catalog/`, `commands/` contains CLI entry points, `review/` owns update preparation and application, and `workbook/` owns retained
import references and map generation. Shared catalog rules and file handling stay at the catalog root.

The live app reads [static/kdm/catalog/data.json](../static/kdm/catalog/data.json).
Run `pnpm exec prettier --write static/kdm/catalog/data.json` after direct edits; its override keeps short records compact.
Its [schema](../static/kdm/catalog/data.schema.json) generates [kdm-data.d.ts](../src/lib/types/gen/kdm-data.d.ts).
Run `pnpm generate:types` after schema changes. It also generates [core-editions.json](../src/lib/gen/core-editions.json) for Quick Start,
with playable core edition IDs and labels in catalog order, excluding Resin. Development, checks, and builds regenerate these files;
the dev server watches schema and catalog changes. Do not edit generated files.

The full catalog loads through the collection route. Quick Start imports the smaller edition list and saves ownership by stable keys.
Opening collection preserves ownership and pending saves. The service worker caches the catalog and collection HTML after a visit,
including filtered collection URLs. Font and gesture playground HTML and the legacy WOFF fallback also cache after use;
WOFF2 and shared app code are precached.

The [catalog guide](kdm-catalog.md) covers identity, data rules, mappings, and reviewed product decisions.
Item IDs are object keys; explicit editions have permanent IDs independent of mutable labels.
Edition-less items use synthetic `item` IDs, or `bundle` for bundles. Review new shop labels before adding editions.

Shop mappings in `scripts/catalog/data/shop-mappings.json` select an item with `category` and `itemId`.
`editionId` selects the listing's default edition; `variantEditionIds` maps Shopify variant IDs to edition IDs and overrides that default.
`variantIds` optionally limits imported variants. Use `editionLabel` only for a confirmed new release, replacing it with the assigned ID afterward.
For older mappings, replace `edition` and `variantEditions` label values with `editionId` and `variantEditionIds` IDs; review ambiguous matches.

Mark reviewed superseded listings with a `retired` reason to exclude them from imports while preserving their mappings.
Current catalog handles determine stock and purchase links. Keep unreplaced or ambiguous preorders active for review;
a bundle is not superseded merely because its components shipped.

Reviewed maintenance state lives in `scripts/catalog/data/` and belongs in Git. Private workbook sources and archives stay under
`local-data/kdm-catalog/`; response caches belong under `.cache/kdm-catalog/shopify-products/`, and generated reports under
`temp/kdm-catalog/reports/`. These private and generated directories remain Git-ignored.

### Prepare an update

```bash
pnpm catalog:update --fetch
```

This monthly update refreshes news and both shop pages, includes simulator discovery, and stages all unimported announcements.
Inspect `temp/kdm-catalog/reports/kdm-update-review.json` and resolve unknown or ambiguous products before applying.
Each changed or added item includes field-level `differences` with previous values or list additions/removals, the full proposed item in
`after`, and related `listings` with media removed and HTML descriptions converted to readable text.
Identical cleaned descriptions appear once. Listing prices are integer cents; shipping, tax, vendor, option definitions, and position metadata
are omitted from the review. Raw shop caches retain those fields for matching.
Unresolved entries include their listing, current catalog choices, and `resolution` instructions with the catalog and mapping file paths.
For an existing release, save its handle on the sale edition in the live catalog. Use edition ID mappings when variants need explicit selection.
For a distinct release, confirm its label, material, and release date/window. Save edits and rerun `pnpm catalog:update` to regenerate the review.
Applying writes the reviewed `after` values; listing details and differences are reference information. Unchanged shop products are omitted.

Apply the reviewed changes:

```bash
pnpm catalog:apply
pnpm catalog:validate
```

Applying uses the captured data offline, updates stock, and archives changes. Changed inputs invalidate the review;
rerun `pnpm catalog:update` after editing mappings or tags. Commit `scripts/catalog/data/news-imports.json` with the applied catalog changes:
without this ledger, all saved announcements count as unimported, including older posts.
Catalog publication also rejects workbook map or schema changes made during a run, including creation or deletion of those files.

Commands use local files and caches by default. `--fetch` permits downloads; `--offline` cannot accompany it.
News fetching downloads new or failed articles. Use `--refresh-posts` to reprocess historical articles, adding `--fetch` to download them again.
Shop requests start at least 35 seconds apart and cache responses for 24 hours without automatic retries.
Use `--help` for command options.

Multi-file publication is not transactional. After a partial failure, inspect the reported published and pending paths before rerunning.
Ctrl+C waits for publication or checkpoint cleanup; edition retrieval checkpoints remain incomplete until final publication.

### Edit tags

`scripts/catalog/data/tags.json` supplies exact reviewed assignments. Keep every category and item ID, with at least one tag per item.
Vocabulary lives in `scripts/catalog/data/tags.schema.json` under `$defs.tag.enum`;
`pnpm catalog:tags --schema` refreshes the schema while preserving vocabulary; `pnpm catalog:tags-schema` is an alias.

```bash
pnpm catalog:tags
pnpm catalog:apply
pnpm catalog:validate
```

Tag staging needs no news or shop data and replaces tag arrays. `pnpm catalog:apply` applies the staged review; alternatively,
`pnpm catalog:tags --apply` stages and applies immediately, syncing the shared master file. Commit reviewed tag edits with the applied catalog.
Catalog tags sort by frequency, with alphabetical ties; master tag arrays stay alphabetical.

### Refresh availability or fill editions

| Command                             | Effect                                  |
| ----------------------------------- | --------------------------------------- |
| `pnpm catalog:availability`         | Apply saved shop stock and availability |
| `pnpm catalog:availability --fetch` | Fetch two pages, validate, then publish |
| `pnpm catalog:editions`             | Fill missing editions from caches       |
| `pnpm catalog:editions --fetch`     | Fetch variants to fill missing editions |

Availability resolves shop listings and release variants conservatively: a matching warehouse in stock makes an edition available;
unmatched or ambiguous editions are unavailable. Homebrew availability is preserved.
The weekly availability refresh validates before publishing stock and availability updates for existing catalog editions. It uses only
shop `products.json?limit=250&page=1` and `page=2`.
The default reads `.cache/kdm-catalog/shopify-products/products-page-1.json` and `products-page-2.json`;
`--fetch` downloads those two pages and replaces their caches after both succeed. Missing caches require `--fetch`.
Individual product responses are never used for stock or availability.
Edition retrieval groups warehouses by release and leaves failed listings unchanged. Run `catalog:availability` after importing new editions.
Both commands reject concurrent catalog edits and write reports to `temp/kdm-catalog/reports/` as
`availability-refresh.json` and `edition-retrieval.json`.

### Workbook map

`pnpm catalog:workbook` validates and normalizes the committed [workbook-map.json](../static/kdm/catalog/workbook-map.json) against the live catalog.
No private workbook files are needed. The map connects source rows and release columns to stable catalog IDs,
with no ownership, wishlist, copy-number, comment, or other personal cell values. Sheet and row numbers locate the workbook snapshot;
they are not permanent IDs. Changed row identities and unresolved references require review.
To rebuild from private records explicitly, run:

```bash
pnpm catalog:workbook --imports local-data/kdm-catalog/imports/kdm-import-records.json
```

This uses `scripts/catalog/data/import-records.schema.json`. Source references require `editionId`, including `item` or `bundle` for products
without explicit editions. Primary, related, and release-column references retain those IDs when labels change. Older label-based sources must
be assigned reviewed IDs before import; do not guess ambiguous matches. Personal cells never enter the map. Publication guards the catalog,
source records when supplied, schemas, and previous map against late edits.

[src/lib/types/workbook.ts](../src/lib/types/workbook.ts) owns the mapping and normalized-row contract.
`pnpm generate:types` derives [workbook-map.schema.json](../static/kdm/catalog/workbook-map.schema.json); edit the contract instead of the generated schema.
Runtime validation also rejects duplicate sheet/row locators. XLSX transfers load the product-only map on demand.

`pnpm catalog:workbook-template` rebuilds the committed template from `local-data/kdm-catalog/imports/KDM Collection Sheets.xlsx`,
validating mapped names and removing personal data. Keep the source Git-ignored and review the sanitized template before publication.

### Live shop links

`pnpm check:shop-links` displays the saved summary. Add `--fetch` to check catalog listings and write
`temp/kdm-catalog/reports/shop-links.json`. Link checks leave the catalog unchanged.
HEAD requests follow redirects with a 10-second timeout. Requests to the shop start at least 35 seconds apart;
other hosts use 1-second spacing. Shop downloads and link checks share `.cache/kdm-shop/request.lock` and the persisted
request start time, preventing overlapping requests across commands. Use `--cache path` to select the same custom cache for both.
A second process using that cache stops with a lock error; rerun after the first command finishes.
A separate `temp/kdm-catalog/reports/shop-links.lock` prevents competing checkers from overwriting progress and releases on completion or cancellation.
Lock errors include the recorded PID and acquisition time when available. Normal cancellation cleans up locks; a crash or forced termination may leave one behind.
Before removing a lock manually, confirm its recorded process has exited in Task Manager or with `Get-Process -Id <pid>`, and identify the command that owned it.
Remove only the lock named in the error, either `.cache/kdm-shop/request.lock` or `temp/kdm-catalog/reports/shop-links.lock`.
Keep `last-request.json`, `shop-links-checkpoint.json`, and cached responses; they preserve request timing and resumable progress.
Each request checkpoints progress in `temp/kdm-catalog/reports/shop-links-checkpoint.json`. Rerunning with `--fetch`
resumes an incomplete run using results less than 24 hours old. A completed run starts fresh on the next `--fetch`.
Failures, including rate limits or HEAD rejection, are recorded only in the link report.
HEAD responses never change stock, availability, or `shopUpdated`.

## Shared and local data

Commit the maintenance files under `scripts/catalog/data/`: `shop-mappings.json`, `tags.json`, `tags.schema.json`, `news-imports.json`, and
`import-records.schema.json`. Commit applied catalog and ledger changes together so another maintainer can continue without replaying imported news.
The committed workbook map contains product references only. Normal maintenance does not read private workbook records.

Keep original workbooks, personal import records, and archives under Git-ignored `local-data/kdm-catalog/`. Back those up separately if needed.
Shopify response caches stay in `.cache/kdm-catalog/shopify-products/`, news caches in `.cache/kingdom-death-news/`, generated reports in
`temp/kdm-catalog/reports/`, and request coordination in `.cache/kdm-shop/`.

Use `--fetch` for every network path; missing local inputs should be reported with instructions rather than downloaded automatically.

### Existing checkout migration

Older ignored files do not move with Git. Compare any reviewed local mappings, tags, vocabulary, or news ledger against the files in
`scripts/catalog/data/` before replacing shared state; loaders no longer read local copies as overrides.
Keep private workbooks and import records under `local-data/kdm-catalog/imports/`, and archives under `local-data/kdm-catalog/archives/`.
Do not overwrite the committed workbook map from older personal records without reviewing row identities and edition IDs.
Run `pnpm catalog:validate` after reconciling shared edits. Caches and reports need no migration for a fresh clone; use `--fetch` to obtain missing caches.
