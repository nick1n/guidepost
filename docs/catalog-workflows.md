# Catalog workflows

This guide covers catalog commands and local operational data. For catalog facts and authoring decisions, see the [catalog guide](kdm-catalog.md).

In `scripts/catalog/`, `commands/` contains CLI entry points, `review/` owns update preparation and application, and `workbook/` owns retained
import references and map generation. Shared catalog rules and file handling stay at the catalog root.

The live app reads [static/kdm/catalog/data.json](../static/kdm/catalog/data.json).
Run `pnpm exec prettier --write static/kdm/catalog/data.json` after direct edits; its override keeps short records compact.
See [generated files](#generated-files) for source contracts and regeneration commands.

Runtime loading and caching are described in the [architecture](kdm-architecture.md).

Shop mappings in `scripts/catalog/data/shop-mappings.json` select an item with `category` and `itemId`.
`editionId` selects the listing's default edition; `variantEditionIds` maps Shopify variant IDs to edition IDs and overrides that default.
`variantIds` optionally limits imported variants. Use `editionLabel` only for a confirmed new release, replacing it with the assigned ID afterward.
For older mappings, replace `edition` and `variantEditions` label values with `editionId` and `variantEditionIds` IDs; review ambiguous matches.

Mark reviewed superseded listings with a `retired` reason to exclude them from imports while preserving their mappings.
Current catalog handles determine stock and purchase links. Keep unreplaced or ambiguous preorders active for review;
a bundle is not superseded merely because its components shipped.

See [shared and local data](#shared-and-local-data) for tracked inputs, private workbooks, caches, and reports.

## Review new listings with Codex

Invoke [$kdm-catalog-update](../.agents/skills/kdm-catalog-update/SKILL.md) in a new thread for this repository to review saved evidence,
find existing matches, and check products in the update's news articles for missing tags, including already matched items and restocks.
Confirm proposed matches, new items, and tag updates before applying them. Append `Refresh the shop first` to request current store
evidence, or supply handles with decisions such as `new beta` or `matches item-id / edition-id`. Supplied decisions carry through without
repeated confirmation; a supplied list limits the review to those products unless a broader review is requested.

## Prepare an update

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
All catalog CLI network requests start at least 61 seconds apart, including news, shop downloads, link checks to any host,
and each redirect hop. They share persisted timing in `.cache/kdm-shop/`; cached reads require no wait. Shop responses cache for 24 hours.
Fetch progress shows the active URL, HTTP status, and any wait before the next request. Interactive terminals also show a spinner
and a wait countdown; redirected output uses plain log lines. HTTP 429 stops the command without retrying or fetching later listings.
Shop downloads retain `Retry-After` as reported cooldown information, which also applies to later explicit runs using the same request cache;
it does not guarantee that a subsequent request will succeed. Other HTTP failures stop downloads with a readable error.

Both `catalog:update --fetch` and `catalog:availability --fetch` use the shared shop client with a Chrome 157 User-Agent.
The client generates a random `cart` cookie value for each request when `KDM_SHOP_CART_COOKIE` is unset or empty.
To override it, set `KDM_SHOP_CART_COOKIE` in the invoking process environment to the browser's `cart` cookie value
(the value only, without `cart=`). The client sends only that cookie, only to `https://shop.kingdomdeath.com`, and does not
save it in reports or caches. Shop HTTP errors explain how to supply a valid browser value and rerun with `--fetch`;
the hint does not establish that the cookie caused the error. A 429 still stops the command without retries.
Use `--help` for command options.

Multi-file publication is not transactional. After a partial failure, inspect the reported published and pending paths before rerunning.
Ctrl+C waits for publication or checkpoint cleanup; edition retrieval checkpoints remain incomplete until final publication.

## Edit tags

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

## Refresh availability or fill editions

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

## Workbook map

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

The mapping and normalized-row contract is listed under [generated files](#generated-files).
Runtime validation also rejects duplicate sheet/row locators. XLSX transfers load the product-only map on demand.

`pnpm catalog:workbook-template` rebuilds the committed template from `local-data/kdm-catalog/imports/KDM Collection Sheets.xlsx`,
validating mapped names and removing personal data. Keep the source Git-ignored and review the sanitized template before publication.

## Live shop links

`pnpm check:shop-links` displays the saved summary. Add `--fetch` to check catalog listings and write
`temp/kdm-catalog/reports/shop-links.json`. Link checks leave the catalog unchanged.
HEAD requests follow redirects with a 10-second timeout per hop. Every hop uses the shared 61-second request gate, including external hosts.
News, shop downloads, and link checks share `.cache/kdm-shop/request.lock` and the persisted request start time, preventing overlapping
requests across commands. Catalog `--cache path` also coordinates the news phase of monthly updates. Standalone news scraping uses
`--request-cache path` to select the same custom request cache; its `--cache` option selects cached HTML instead.
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

## Generated files

Edit the source contracts, not generated files, then run `pnpm generate:types`. Development, checks, and builds also generate them;
the dev server watches schema and catalog changes.

| Generated output                                                                                                                | Source                                                     |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [Catalog types](../src/lib/types/gen/kdm-data.d.ts) and [browser validator](../src/lib/gen/catalog-validator.js) (with `.d.ts`) | [data.schema.json](../static/kdm/catalog/data.schema.json) |
| [Core editions](../src/lib/gen/core-editions.json)                                                                              | [data.json](../static/kdm/catalog/data.json)               |
| [Workbook map schema](../static/kdm/catalog/workbook-map.schema.json)                                                           | [workbook.ts](../src/lib/types/workbook.ts)                |

`workbook.ts` owns both the mapping and normalized-row schemas and types. The generated core edition list supplies Quick Start with
playable core edition IDs and labels in catalog order, excluding Resin.

## Shared and local data

Commit the maintenance files under `scripts/catalog/data/`: `shop-mappings.json`, `tags.json`, `tags.schema.json`, `news-imports.json`, and
`import-records.schema.json`. Commit applied catalog and ledger changes together so another maintainer can continue without replaying imported news.
The committed workbook map contains product references only. Normal maintenance does not read private workbook records.

Keep these directories Git-ignored. Back up private inputs and archives separately if needed. Custom workspaces use the same layout.

| Directory                              | Contents                                                                |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `local-data/kdm-catalog/imports/`      | Original workbooks and personal import records                          |
| `local-data/kdm-catalog/archives/`     | Catalog snapshots, including `kdm-data.json` and `kdm-data.schema.json` |
| `.cache/kdm-catalog/shopify-products/` | Shopify responses                                                       |
| `.cache/kingdom-death-news/`           | News pages                                                              |
| `.cache/kdm-shop/`                     | Request timing and coordination                                         |
| `temp/kdm-catalog/reports/`            | Generated reviews and reports                                           |

Use `--fetch` for every network path; missing local inputs should be reported with instructions rather than downloaded automatically.

### Existing checkout migration

Older ignored files do not move with Git. Compare any reviewed local mappings, tags, vocabulary, or news ledger against the files in
`scripts/catalog/data/` before replacing shared state; loaders no longer read local copies as overrides.
Move private inputs and archives to the directories above.
Do not overwrite the committed workbook map from older personal records without reviewing row identities and edition IDs.
Run `pnpm catalog:validate` after reconciling shared edits. Caches and reports need no migration for a fresh clone; use `--fetch` to obtain missing caches.
