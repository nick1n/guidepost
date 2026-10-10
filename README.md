# Guidepost

A personal hub for board game companion tools, built with SvelteKit 3, Svelte 5, and UnoCSS.
The Kingdom Death: Monster tools include a product catalog and a first-story showdown aid.

## Getting started

Run these commands from the project root:

```bash
pnpm install
pnpm dev
```

On Windows, if `pnpm` is missing, install the pinned version with `npm.cmd install --global pnpm@12.6.0`, then run the commands above.

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
| `pnpm format`           | Format project files in place      |
| `pnpm format:check`     | Check formatting                   |

See [AGENTS.md](AGENTS.md) for coding conventions and required checks. The
[KDM architecture](docs/kdm-architecture.md) describes current collection storage and planned campaign and offline sync work.

Client-facing tests live in `test/client/`; build and catalog script tests live in `test/scripts/`.
Script tests import tooling through the package's `#scripts/*` alias, with the source extension included.
`pnpm test` watches both Vitest projects. Script checks named `*-checks.mts` use Node's test runner through `pnpm test:scripts`.

## Catalog

The live app reads [static/kdm-catalog/data.json](static/kdm-catalog/data.json). Its
[schema](static/kdm-catalog/data.schema.json) generates `src/lib/types/gen/kdm-data.d.ts`.
After changing the schema, run `pnpm generate:types`. Development, checks, and builds also regenerate types;
the dev server watches schema changes. The same command generates `src/lib/gen/core-editions.json` for landing-page Quick Start,
containing only playable core editions' IDs and labels in catalog order, excluding Resin from Quick Start.
The dev server also watches catalog changes.
Do not edit generated files by hand.

The full catalog loads only when opening collection. Collection links disable hover data preloading. Quick Start imports the generated
edition list directly and saves ownership by stable keys. The shared collection starts with an empty catalog; opening collection
supplies the full catalog without resetting ownership or pending saves.
The service worker defers the full catalog and collection HTML until collection is visited, then caches them for offline use,
including reloads of collection URLs with search and filter parameters.

`scripts/catalog/releases.mts` resolves shop variants, curated release selectors, materials, and prices for update and retrieval workflows.
Full availability refreshes use its conservative edition matching; incremental updates preserve editions that were not observed.

The [catalog guide](exports/kdm-catalog/README.md) covers data rules, mappings, and review decisions.
Catalog commands maintain the files in `static/kdm-catalog/`. The previous catalog and its schema are archived locally as
`temp/kdm-data.json` and `temp/kdm-data.schema.json`. Working files, caches, and reports under `temp/` are Git-ignored.
Keep a copy of the archived catalog, local tags, or mappings before clearing that folder.

Catalog item IDs are object keys. Explicit editions have permanent readable `id` values, unique within each item, such as `first-run`,
`resin`, or `1-6`; their display labels (`label`) can change without changing
collection identity. Items without explicit editions use a synthetic `item` edition, or `bundle` for bundles.
The JSON schema restricts nonempty labels to its enum; TypeScript uses strings. `name` can override the displayed label.
Keep IDs when renaming labels. IDs use lowercase kebab-case; `item` and `bundle` are reserved for synthetic editions. Creation tooling
suggests an ID from the initial label and rejects collisions for review. It never regenerates an existing ID.
Inclusion selectors use `editionId` on the child item and `parentEditionIds` on the containing item; update any local shop mappings that use labels.
Edition `format`, `simulator`, `numbered`, and `materials` facts determine behavior independently of display labels.
Dates, prices, and descriptions use `releaseDate`, `prices`, and `description`.
Review newly discovered shop labels before applying an update so a renamed release is not added as a separate edition.
Item fields are alphabetical. Edition fields start with `id`, then `label`; inclusion-object fields start with `item`.
Remaining fields are alphabetical. Catalog write commands preserve this property order without
changing the established item, edition, or other array ordering.

### Prepare an update

```bash
pnpm scrape:news
pnpm catalog:update --sim
```

The scraper updates news exports; the updater stages changes without changing the catalog. Inspect
`temp/kdm-catalog/reports/kdm-update-review.json`, resolve unknown or ambiguous products, then apply it:

```bash
pnpm catalog:update --apply-review temp/kdm-catalog/reports/kdm-update-review.json
pnpm catalog:validate
```

Applying a review writes the live catalog and local reports. Stale inputs are rejected; prepare a new review if its inputs change.
Validation checks schemas, references, ordering, and local tag assignments without changing them.
Shop requests are at least 35 seconds apart and cached for 24 hours. Use `--offline` for cached evidence or `--refresh` to fetch again.

Catalog review application, availability refresh, edition retrieval, and workbook-map generation share a publication module. It stages all outputs in unique
adjacent temporary files, then rechecks captured inputs before each replacement. Completion reports publish last. Detected edits or
cancellation before the first replacement leave destination files unchanged; temporary files are cleaned up. Failures after a replacement
list the published and pending paths, retaining the original error. Rerun from the current files after inspecting those paths.
Each replacement applies to one file. Publication across several files is not transactional, and an external edit between a baseline
check and replacement can still race with the command. Edition retrieval still saves incomplete progress checkpoints while fetching;
final publication marks them complete after the mappings and catalog publish.

### Edit tags

When present, `temp/kdm-catalog/kdm-tags.json` supplies the exact tag assignments for each item. Keep all category groups and
item IDs, with at least one tag per item. Allowed values live in `temp/kdm-catalog/kdm-tags.schema.json` under `$defs.tag.enum`.
Add new vocabulary there before using it; `pnpm catalog:tags-schema` refreshes the schema while preserving that vocabulary.

```bash
pnpm catalog:tags
# Inspect the staged review, then apply it:
pnpm catalog:update --apply-review temp/kdm-catalog/reports/kdm-update-review.json
pnpm catalog:validate
```

Tag-only updates make no shop requests. `pnpm catalog:tags --apply` prepares and applies assignments immediately.
These commands replace tag arrays. Without the optional local tag files, edit tags directly in the review catalog.
Apply pending assignments before deleting the local files.

Year tags such as `"2018"` use the earliest known physical release year, with documented or Sim dates as fallbacks.
Planned release windows can supply a year; restock announcements do not establish an original release.
Use `upcoming` while any edition is awaiting release, even if other editions are already out.

### Refresh availability or fill editions

| Command                               | Effect                                                    |
| ------------------------------------- | --------------------------------------------------------- |
| `pnpm catalog:availability`           | Fetch shop pages and replace catalog availability         |
| `pnpm catalog:availability --offline` | Apply saved shop pages without requests                   |
| `pnpm catalog:editions`               | Fill content items missing editions from Shopify variants |
| `pnpm catalog:editions --offline`     | Fill missing editions using cached responses              |

Availability matching uses shop handles or URLs and release variants. A matching warehouse in stock makes an edition available;
unmatched or ambiguous shop editions default to unavailable. Homebrew availability is preserved.
Results go to `temp/kdm-catalog/reports/availability-refresh.json`.

Edition retrieval groups warehouse choices under their release label and leaves failed listings unchanged.
Requests are at least 35 seconds apart; responses stay cached until `--refresh`.
Results go to `temp/kdm-catalog/reports/edition-retrieval.json`.
Both commands write the live catalog and refuse to overwrite catalog edits made during retrieval.

### Workbook map

`pnpm catalog:workbook` reads the local `temp/kdm-catalog/imports/kdm-import-records.json` and current catalog, then writes
[`workbook-map.json`](static/kdm-catalog/workbook-map.json). The map connects each source row and its release columns to stable catalog
content and edition IDs. It contains product references only, with no owned, wished, copy-number, comment, or other personal cell values.
Workbook sheet and row numbers locate this source snapshot; they are not permanent IDs. The command rejects changed row identities and
unresolved references for review. Generation captures the catalog, import records, both workbook schemas, and previous map;
a late edit to any of them prevents replacement. Ctrl+C cancels preparation and cleans temporary files.

[`src/lib/types/workbook.ts`](src/lib/types/workbook.ts) defines the shared mapping and normalized-row contract used by tooling and collection
transfers. `pnpm generate:types` generates the editor schema at `static/kdm-catalog/workbook-map.schema.json`; edit the shared contract
instead of the generated schema. Runtime validation also rejects duplicate sheet/row locators, which JSON Schema cannot express.

Validated row workflows are implemented; `.xlsx` parsing, writing, and controls are deferred.

### Live shop links

`pnpm check:shop-links` checks item and edition listings in the live catalog, resolving shop handles and external URLs.
It writes `temp/kdm-catalog/reports/shop-links.json`, leaving catalog facts unchanged.
It uses HEAD requests with redirects and a 10-second timeout: `true` for HTTP 2xx, `false` for errors, and `null` for missing URLs.
Failures may reflect rate limits or HEAD rejection. Reachability does not indicate stock.

### Collection

With the dev server running, open [/collection/](http://localhost:5173/collection/) for search, edition details, ownership, and wishlist controls.
Catalog loading failures show a collection error page with retry and home controls. Offline failures explain that a connection is needed
when the catalog is not available locally; retry preserves the collection URL and saved ownership.
[`CollectionBrowsing`](src/lib/collection-browsing.svelte.ts) owns category, filter, batching, and URL transitions.
[`CollectionCards`](src/lib/collection-cards.svelte.ts) owns collapse state, deferred bodies, viewport observation, and held-card scroll
anchoring. The page disposes its observers and pending scroll corrections on unmount. Focus, category gestures, and navigation stay in the page.

Collection entries save locally in IndexedDB through Dexie. Each entry is keyed by stable content and edition IDs and stores owned,
wished, and numeric `copyNumber` values. Copy numbers are integers from 1 to 9999, limited further by a known edition run size.
Blank inputs remove the copy number. Saves apply the current owner's snapshot atomically, writing only changed rows. A persisted revision rejects
writes from a stale tab. Open tabs observe revision changes and offer a refresh before further edits; they retain their current view
until you refresh. Dexie loads only after the browser mounts the app.
The schema version on collection metadata validates the stored format. It does not migrate older browser data.

The root layout creates a `Collection` instance and provides it through Svelte context. Components call its commands through
`collectionActions.run()`. `Collection` owns reactive state, `OptimisticStore` owns pending patches and confirmed snapshots, and
`DexieStore` owns persistence. `isSaving` reports pending writes. The injected `Notifications` service uses Effect logging;
visible notifications are planned. Expected action failures log their typed error messages; unexpected defects log the full Effect
cause. Cancellation does not produce a failure notification.

[`CollectionSession`](src/lib/state/collection-session.ts) owns browser storage startup, monitoring, and teardown. The layout forwards
collection readiness to the session and interrupts its lifetime on unmount. Shutdown waits for initialization and observer finalizers
before closing storage; a failed snapshot load keeps the opened store available for retry.

Monitoring stays active during refresh and restarts after an observer failure is retried. Observer failures block editing while
preserving the current view. Database load failures offer a retry; a failed storage-module download offers a page reload.
Commands discard superseded results and failures, including workbook validation interrupted by an owner change.

`Collection.exportBackup()` produces a versioned JSON backup after queued saves settle. `restoreBackup(json)` validates the entire
backup and replaces the snapshot in one queued save, with rollback on failure. `previewWorkbook(rows)` validates normalized product
rows without writing; `importWorkbook(rows)` validates again and merges their provided fields in one save. Rows identify the sheet,
row, and product name, with an explicit edition ID when release alternatives are ambiguous. Invalid numeric cells cause typed errors.
Source-row ownership propagates to explicitly related editions; copy numbers apply only to the selected edition.

`exportWorkbook()` returns normalized rows for a future XLSX adapter. It rejects unmapped editions and separate values that a shared
workbook row cannot represent. JSON backups remain the complete snapshot format. The workbook map loads only when a row workflow runs.

## Known warnings

- UnoCSS may warn that `unocss:svelte-scoped:global-styles` uses the unsupported `transformIndexHtml` hook.
  The current SvelteKit integration uses `transform` and `renderChunk`; this warning is safe to ignore.
  After integration upgrades, rebuild and verify the global stylesheet, safelisted icons, and absence of
  `%unocss-svelte-scoped.global%` placeholders in generated HTML.
- The CSS validator may report `Unknown property: 'corner-shape'` in `AttackProfile.svelte`.
  Supporting browsers use `corner-shape: squircle`; others keep the `border-radius` fallback.

Investigate other warnings separately.

## License

Original Guidepost source code is licensed under [AGPL-3.0-only](LICENSE).
Third-party materials retain their owners' rights and licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Guidepost is an unofficial fan project, unaffiliated with Adam Poots Games or other referenced publishers, and is not endorsed or sponsored by them.
