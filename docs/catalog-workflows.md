# Catalog workflows

This guide covers catalog commands and local operational data. For catalog facts and authoring decisions, see the [catalog guide](kdm-catalog.md).

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

Reports under `temp/kdm-catalog/reports/` are Git-ignored. Local reviewed inputs and archives belong under `local-data/kdm-catalog/`; response caches belong under `.cache/kdm-catalog/shopify-products/`. The previous catalog and schema are archived as `local-data/kdm-catalog/archives/kdm-data.json` and `local-data/kdm-catalog/archives/kdm-data.schema.json`. Back up archives, local tags, and mappings before clearing local data or caches.

### Prepare an update

```bash
pnpm scrape:news --fetch
pnpm catalog:update --sim --fetch
```

The scraper updates news JSON and CSV exports; the updater stages a review. Inspect
`temp/kdm-catalog/reports/kdm-update-review.json` and resolve unknown or ambiguous products before applying it:

```bash
pnpm catalog:update --apply-review temp/kdm-catalog/reports/kdm-update-review.json
pnpm catalog:validate
```

The review captures input hashes and unresolved matches. Applying validates the captured inputs and proposed data before publication;
the archive retains the full change set, and the merge report summarizes applied changes.
Applying writes the live catalog and reports. Changed inputs invalidate the review; prepare a new one.
Validation checks schemas, references, ordering, and local tag assignments without modifying them.

Catalog and news commands use cached evidence by default, including stale caches, and never download missing entries.
Add `--fetch` to download fresh data; `--offline` explicitly selects the default and cannot accompany `--fetch`.
News fetching refreshes the index and all articles; `--refresh-posts` reprocesses saved articles without downloading.
Shop requests start at least 35 seconds apart. Responses, including HTTP failures, are cached for 24 hours, with no automatic retries;
`--fetch` bypasses completed caches and shares in-progress duplicate lookups.
Append `--help` to a command for its flags. Ctrl+C interrupts requests and waits for publication or checkpoint cleanup.

Catalog, availability, edition, and workbook publication recheck captured inputs before replacing each file and publish completion reports last.
Cancellation or detected edits before the first replacement leave destinations unchanged. Multi-file publication is not transactional,
and external edits can still race between a check and replacement. After a partial failure, inspect the reported published and pending paths
before rerunning. Edition retrieval checkpoints remain incomplete until final publication.

### Edit tags

Optional `local-data/kdm-catalog/kdm-tags.json` supplies exact reviewed assignments. Keep every category and item ID, with at least one tag per item.
Vocabulary lives in `local-data/kdm-catalog/kdm-tags.schema.json` under `$defs.tag.enum`;
`pnpm catalog:tags-schema` refreshes the schema while preserving vocabulary.

```bash
pnpm catalog:tags
# Inspect the review, then apply:
pnpm catalog:update --apply-review temp/kdm-catalog/reports/kdm-update-review.json
pnpm catalog:validate
```

Tag updates make no shop requests and replace tag arrays. `pnpm catalog:tags --apply` stages and applies immediately, syncing the local master file.
Without local tag files, edit the review catalog. Apply pending assignments before deleting local files.
Catalog tags sort by frequency, with alphabetical ties; master tag arrays stay alphabetical.

### Refresh availability or fill editions

| Command                             | Effect                                  |
| ----------------------------------- | --------------------------------------- |
| `pnpm catalog:availability`         | Apply saved shop availability           |
| `pnpm catalog:availability --fetch` | Fetch pages and replace availability    |
| `pnpm catalog:editions`             | Fill missing editions from caches       |
| `pnpm catalog:editions --fetch`     | Fetch variants to fill missing editions |

Availability resolves shop listings and release variants conservatively: a matching warehouse in stock makes an edition available;
unmatched or ambiguous editions are unavailable. Homebrew availability is preserved.
Stock and availability come only from shop `products.json?limit=250&page=1` and `page=2`.
The default reads `.cache/kdm-catalog/shopify-products/products-page-1.json` and `products-page-2.json`;
`--fetch` downloads those two pages and replaces their caches after both succeed. Missing caches require `--fetch`.
Individual product responses are used for metadata, never stock or availability.
Edition retrieval groups warehouses by release and leaves failed listings unchanged. Run `catalog:availability` after importing new editions.
Both commands reject concurrent catalog edits and write reports to `temp/kdm-catalog/reports/` as
`availability-refresh.json` and `edition-retrieval.json`.

### Workbook map

`pnpm catalog:workbook` reads local `local-data/kdm-catalog/imports/kdm-import-records.json` and the catalog, then writes
[workbook-map.json](../static/kdm/catalog/workbook-map.json). It maps source rows and release columns to stable catalog IDs,
with no ownership, wishlist, copy-number, comment, or other personal cell values. Sheet and row numbers locate the workbook snapshot;
they are not permanent IDs. Changed row identities and unresolved references require review.
Publication guards the catalog, import records, workbook schemas, and previous map against late edits.

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

## Local working data

Catalog imports, reviewed tags, shop mappings, and archives live under `local-data/kdm-catalog/`. Keep `imports/`, `kdm-tags.json`, `kdm-tags.schema.json`, `kdm-shop-mappings.json`, and `archives/` backed up: they contain reviewed inputs needed to reproduce mappings and catalog work. They are Git-ignored and must not contain personal workbook cell values in committed files. Shopify response caches belong in `.cache/kdm-catalog/shopify-products/`; generated reports stay in `temp/kdm-catalog/reports/`. Shop request coordination remains in `.cache/kdm-shop/`.

Use `--fetch` for every network path; missing local inputs should be reported with instructions rather than downloaded automatically.

### Existing checkout migration

Git does not move ignored files. Before running catalog commands in an older checkout, stop running catalog jobs, back up the retained inputs,
and move the following files within that workspace. Do not overwrite a destination that already exists; compare both copies first.

| Previous path                                              | Current path                                            |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| `temp/kdm-catalog/imports/`                                | `local-data/kdm-catalog/imports/`                       |
| `temp/kdm-catalog/kdm-tags.json`                           | `local-data/kdm-catalog/kdm-tags.json`                  |
| `temp/kdm-catalog/kdm-tags.schema.json`                    | `local-data/kdm-catalog/kdm-tags.schema.json`           |
| `temp/kdm-catalog/shopify-products/kdm-shop-mappings.json` | `local-data/kdm-catalog/kdm-shop-mappings.json`         |
| `temp/kdm-catalog/reports/archive/`                        | `local-data/kdm-catalog/archives/`                      |
| `temp/kdm-data.json`, `temp/kdm-data.schema.json`          | Same filenames under `local-data/kdm-catalog/archives/` |
| Remaining `temp/kdm-catalog/shopify-products/` contents    | `.cache/kdm-catalog/shopify-products/`                  |

Move the reviewed shop mappings out before relocating the remaining Shopify cache. Keep filenames and contents intact, and verify file hashes
after the move. Leave `temp/kdm-catalog/reports/`, `.cache/kdm-shop/`, and `.cache/kingdom-death-news/` in place. Other scratch files need no move.
Historical reports may reference the old archive paths; use the mapping above to locate those archives.

The loaders read only the current paths. Without migration, old tags and mappings will not be used, and workbook generation cannot find old
import records. Run `pnpm catalog:validate` after migration to verify the catalog against the relocated inputs.
