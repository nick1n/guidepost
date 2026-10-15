# Guidepost

A personal hub for board game companion tools, built with SvelteKit 3, Svelte 5, and UnoCSS.
The Kingdom Death: Monster tools include a product catalog and a first-story showdown aid.

## Getting started

Run from the project root:

```bash
pnpm install
pnpm dev
```

On Windows, if `pnpm` is missing, install the pnpm 12 bootstrap with `npm.cmd install --global pnpm@12`.
The `packageManager` field in `package.json` pins the exact pnpm version used by this project.

| Command                 | Purpose                            |
| ----------------------- | ---------------------------------- |
| `pnpm check`            | Check Svelte and TypeScript        |
| `pnpm test:run`         | Run all Vitest tests once          |
| `pnpm test:client`      | Run client-facing app tests        |
| `pnpm test:scripts`     | Run build and catalog script tests |
| `pnpm test:catalog`     | Alias for script tests             |
| `pnpm catalog:workbook` | Regenerate workbook row mappings   |
| `pnpm build`            | Build the static site              |
| `pnpm preview`          | Serve the production build locally |
| `pnpm format`           | Format project files               |
| `pnpm format:check`     | Check formatting                   |

See [AGENTS.md](AGENTS.md) for coding conventions and required checks, and the
[KDM architecture](docs/kdm-architecture.md) for collection storage and planned campaign and sync work.

Tests live in `test/client/` and `test/scripts/`. Tests import tooling through `#scripts/*` and catalog JSON through `#catalog/*`, including file extensions.
`pnpm test` watches both Vitest projects; `pnpm test:scripts` also runs `*-checks.mts` with Node's test runner.

## Catalog

The live app reads [static/kdm/catalog/data.json](static/kdm/catalog/data.json).
Its [schema](static/kdm/catalog/data.schema.json) generates `src/lib/types/gen/kdm-data.d.ts`.
Run `pnpm generate:types` after schema changes. It also generates `src/lib/gen/core-editions.json` for Quick Start,
with playable core edition IDs and labels in catalog order, excluding Resin. Development, checks, and builds regenerate these files;
the dev server watches schema and catalog changes. Do not edit generated files.

The full catalog loads through the collection route. Quick Start imports the smaller edition list and saves ownership by stable keys.
Opening collection preserves ownership and pending saves. The service worker caches the catalog and collection HTML after a visit,
including filtered collection URLs. Font and gesture playground HTML and the legacy WOFF fallback also cache after use;
WOFF2 and shared app code are precached.

The [catalog guide](docs/kdm-catalog.md) covers identity, data rules, mappings, and reviewed product decisions.
Item IDs are object keys; explicit editions have permanent IDs independent of mutable labels.
Edition-less items use synthetic `item` IDs, or `bundle` for bundles. Review new shop labels before adding editions.

Working files, caches, and reports under `temp/` are Git-ignored. The previous catalog and schema are archived as
`temp/kdm-data.json` and `temp/kdm-data.schema.json`. Back up archives, local tags, and mappings before clearing that folder.

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

Optional `temp/kdm-catalog/kdm-tags.json` supplies exact reviewed assignments. Keep every category and item ID, with at least one tag per item.
Vocabulary lives in `temp/kdm-catalog/kdm-tags.schema.json` under `$defs.tag.enum`;
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
The default reads `temp/kdm-catalog/shopify-products/products-page-1.json` and `products-page-2.json`;
`--fetch` downloads those two pages and replaces their caches after both succeed. Missing caches require `--fetch`.
Individual product responses are used for metadata, never stock or availability.
Edition retrieval groups warehouses by release and leaves failed listings unchanged. Run `catalog:availability` after importing new editions.
Both commands reject concurrent catalog edits and write reports to `temp/kdm-catalog/reports/` as
`availability-refresh.json` and `edition-retrieval.json`.

### Workbook map

`pnpm catalog:workbook` reads local `temp/kdm-catalog/imports/kdm-import-records.json` and the catalog, then writes
[workbook-map.json](static/kdm/catalog/workbook-map.json). It maps source rows and release columns to stable catalog IDs,
with no ownership, wishlist, copy-number, comment, or other personal cell values. Sheet and row numbers locate the workbook snapshot;
they are not permanent IDs. Changed row identities and unresolved references require review.
Publication guards the catalog, import records, workbook schemas, and previous map against late edits.

[src/lib/types/workbook.ts](src/lib/types/workbook.ts) owns the mapping and normalized-row contract.
`pnpm generate:types` derives `static/kdm/catalog/workbook-map.schema.json`; edit the contract instead of the generated schema.
Runtime validation also rejects duplicate sheet/row locators. Normalized-row workflows exist; XLSX parsing, writing, and controls are deferred.

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

### Collection

Open [/kdm/collection/](http://localhost:5173/kdm/collection/) for search, edition details, ownership, and wishlist controls.
Catalog-load errors offer retry and home controls; retry preserves the URL and saved ownership.
Offline use requires a previously cached catalog.

Entries save locally in IndexedDB through Dexie, keyed by stable content and edition IDs.
They store owned, wished, and numeric `copyNumber` values. Copy numbers are integers from 1 to 9999, bounded by a known run size;
a blank input removes the value. Saves write changed rows atomically. Stale tabs block editing and offer refresh while preserving their view.
Load and monitoring failures offer retry; a storage-module download failure requires reload.

`Collection`, `OptimisticStore`, and `DexieStore` own commands, pending patches, and persistence.
[CollectionSession](src/lib/state/collection-session.ts) owns storage startup, monitoring, and teardown.
[CollectionBrowsing](src/lib/collection-browsing.svelte.ts) owns browsing and URL transitions;
[CollectionCards](src/lib/collection-cards.svelte.ts) owns collapse, deferred rendering, observation, and scroll anchoring.
See the [architecture guide](docs/kdm-architecture.md#scope-and-existing-behavior) for lifecycle and error handling.

`Collection.exportBackup()` waits for queued saves and exports confirmed data.
`restoreBackup(json)` validates and replaces the snapshot in one queued save, with rollback on failure.
`previewWorkbook(rows)` validates without writing; `importWorkbook(rows)` validates again and merges provided fields in one save.
Rows require sheet, row, product name, and an explicit edition ID for ambiguous releases. Ownership propagates to related editions;
copy numbers apply only to the selected edition. Invalid numeric cells fail validation.

`exportWorkbook()` returns normalized rows, rejecting unmapped editions and values a shared row cannot represent.
JSON backups preserve the complete snapshot. The workbook map loads and validates on demand, then caches for offline transfers.

## Known warnings

The pnpm patch for `@unocss/svelte-scoped` preserves source maps when inserting the global stylesheet link and unregisters
its unused `transformIndexHtml` hook in SvelteKit. Standalone Vite retains that hook. When updating UnoCSS, remove the patch
only after verifying upstream handles both source maps and hook registration. After integration upgrades, verify the global
stylesheet, safelisted icons, and absence of `%unocss-svelte-scoped.global%` placeholders in generated HTML.

- The CSS validator may report `Unknown property: 'corner-shape'` in `AttackProfile.svelte`.
  Supporting browsers use `corner-shape: squircle`; others keep the `border-radius` fallback.

Investigate other warnings separately.

## License

Original Guidepost source code is licensed under [AGPL-3.0-only](LICENSE).
Third-party materials retain their owners' rights and licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Guidepost is an unofficial fan project, unaffiliated with Adam Poots Games or other referenced publishers, and is not endorsed or sponsored by them.
