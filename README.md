# Guidepost

Guidepost is a personal hub for board game companion tools, built with SvelteKit 3, Svelte 5, and UnoCSS.
Kingdom Death: Monster is its largest toolset, with a data-driven catalog and collection tracking stored locally in the browser.

## Getting started

```bash
# Install dependencies; updates node_modules and may update pnpm-lock.yaml.
pnpm install

# Start development; regenerates catalog types and development caches.
pnpm dev
```

Common development commands:

| Command             | Purpose                     | File changes                                                |
| ------------------- | --------------------------- | ----------------------------------------------------------- |
| `pnpm check`        | Check Svelte and TypeScript | Regenerates catalog types and SvelteKit metadata            |
| `pnpm test:run`     | Run tests once              | Temporary test files/caches; does not apply catalog changes |
| `pnpm build`        | Build for production        | Regenerates types and replaces generated build output       |
| `pnpm format`       | Format the project          | Rewrites supported files in place                           |
| `pnpm format:check` | Check formatting            | Read-only                                                   |

Commands marked as writing or replacing files can overwrite earlier contents. Generated types, caches, and build output can be regenerated;
catalog changes and formatting modify maintained files. Review files and product snapshots under `temp/` are Git-ignored, so copy them elsewhere
before a rerun if you need to retain a particular version.

See [AGENTS.md](AGENTS.md) for project conventions and the [local-first KDM architecture](docs/kdm-architecture.md) for
planned campaigns, gameplay history, and offline synchronization. The architecture distinguishes current collection persistence
from proposed campaign services.

## Catalog

The live app reads [src/lib/kdm-data.json](src/lib/kdm-data.json). Its [schema](src/lib/kdm-data.schema.json) generates
`src/lib/types/gen/kdm-data.d.ts`. Edit the schema, then run `pnpm generate:types`; do not edit generated types by hand.
Development, builds, and checks regenerate types automatically. The dev server also watches schema changes.
`pnpm generate:types` replaces the generated declaration file; manual edits to that file are overwritten.

### Shop links

Run `pnpm check:shop-links` to update each item's `shopReachable` field using HEAD requests:

- `true`: final HTTP 2xx response.
- `false`: HTTP error or failed request.
- `null`: no URL. The field is absent until checked.

Each run overwrites earlier results. Requests follow redirects, time out after 10 seconds, and never fall back to GET.
This command writes the live catalog, replacing previous `shopReachable` values; it is not a read-only check.
Failures can reflect rate limits or HEAD rejection; reachability does not indicate stock availability.

### Review catalog

The [merged review catalog](exports/kdm-catalog/README.md) is maintained separately from the live app. To prepare and apply an update:

```bash
# Fetch announcements; writes news exports and caches, replacing earlier export files.
pnpm scrape:news

# Stage updates including Simulator products; replaces the previous review and refreshes caches, not the catalog.
pnpm catalog:update --sim

# Apply reviewed changes; writes the catalog, local tag ordering, report, and review archive.
pnpm catalog:update --apply-review temp/kdm-catalog/reports/kdm-update-review.json

# Read-only: validate catalog data, references, ordering, and local tag assignments.
pnpm catalog:validate
```

Unknown or ambiguous products need reviewed mappings and tags. Applying a review rejects stale inputs and validates schemas and references.
Shop responses are cached for 24 hours, with requests at least 35 seconds apart. Use `--offline` for cached responses or `--refresh` to fetch again.

The [catalog guide](exports/kdm-catalog/README.md) covers tag editing, mappings, data rules, and migration requirements before app adoption.

### Filling missing editions

To fill missing content editions from Shopify variants:

```bash
# Fetch .js JSON listings 33 seconds apart; writes missing editions, mappings, cache, and retrieval report.
pnpm catalog:editions

# Reuse the saved responses without requests; writes editions, mappings, and the report.
pnpm catalog:editions --offline
```

This only processes content items without editions. Shipping warehouse options are grouped under their release label.
Responses, including HTTP failures, are cached in `temp/kdm-catalog/shopify-products/edition-cache/` until explicitly refreshed with
`--refresh`. Unreachable or invalid listings remain unchanged and appear in `temp/kdm-catalog/reports/edition-retrieval.json`.
The command writes the review catalog after validation and refuses to overwrite catalog or mapping edits made during retrieval.

### Updating tags

Edit the grouped assignments in `temp/kdm-catalog/kdm-tags.json`. Each item ID maps to an array of tags, for example:

```json
"survivor-aya": ["survivor", "female", "aya"]
```

Keep all category groups and item IDs in the file. Each item needs at least one tag. While this local file exists, merges use its assignments
exactly, replacing the catalog's previous tags rather than guessing or combining them with shop tags.

Release-year tags are plain strings such as `"2018"`. Use the earliest known physical release year for a combined item; use its documented
item year or earliest Sim release when physical dates are unavailable. If no edition release date is known, use the earliest physical
`releaseWindow` year, including planned releases. A year tag can therefore indicate a scheduled release rather than an already released item.
Do not infer an original release year from restock announcements.
For undated products, cached Shopify publication dates can supply a release-date proxy. Prefer older cached release records;
use `created_at` instead when it is at least one calendar year older than `published_at`. These choices are recorded in
`temp/kdm-catalog/reports/cached-release-dates.json`. Items without selectable editions store their date in `releaseDate`.
The local `temp/kdm-catalog/reports/release-year-tags.json` report lists assigned years and items whose release year remains unknown.

Allowed tags are listed in `temp/kdm-catalog/kdm-tags.schema.json` under `$defs.tag.enum`. Add new vocabulary there before using it.
VS Code provides tag-value completions and flags unknown tags, empty arrays, and duplicates. The schema does not enumerate item IDs;
the merge checks missing and unknown IDs. `pnpm catalog:tags-schema` refreshes the schema structure while preserving its vocabulary and custom definitions.
That command rewrites the local schema file; it does not change catalog tags.

Prepare and review your changes, then apply that review:

```bash
# Stage current tag assignments; replaces the previous review without changing the catalog or contacting the shop.
pnpm catalog:tags

# Inspect the review, then apply it; replaces catalog tags and writes local tag ordering, report, and archive.
pnpm catalog:update --apply-review temp/kdm-catalog/reports/kdm-update-review.json

# Read-only: check that the updated catalog and local tag assignments agree.
pnpm catalog:validate
```

Alternatively, `pnpm catalog:tags --apply` prepares and immediately applies the current assignments. Tag-only updates make no shop requests.
This writes the catalog directly, replacing existing tag arrays rather than appending to them, and replaces the previous staged review.
They update `exports/kdm-catalog/kdm-data.json` and keep the local tag file in catalog order. If you edit the catalog or tag inputs after preparing
a review, prepare a new review before applying it.

Tag preparation validates the whole catalog, so unrelated catalog errors can stop `pnpm catalog:tags`.
Edition labels are exact reference keys: when renaming an edition's `v`, update references to that label in child `edition` selectors,
the item's `includes[].parentEditions`, and any local workbook pointers or shop mappings. Item IDs and tags are separate from edition labels.

Both local tag files are Git-ignored and optional. Apply any pending assignments before deleting them. Without them, updates use the tags
already saved in `exports/kdm-catalog/kdm-data.json`; edit those item tag arrays directly.

### Availability refresh

Run the [availability script](scripts/refresh-catalog-availability.mts) independently of the full catalog merge:

```bash
# Replace product snapshots and the availability report; overwrite catalog availability flags.
pnpm catalog:availability

# Overwrite catalog availability flags and the report using cached pages; no shop requests or snapshot changes.
pnpm catalog:availability --offline

# Write availability to this catalog and replace snapshots/report in its workspace's temp folder.
pnpm catalog:availability --catalog path/to/exports/kdm-catalog/kdm-data.json
```

The command downloads every shop product page, spacing requests at least 35 seconds apart. Raw snapshots replace
`temp/kdm-catalog/shopify-products/products-page-N.json` after all pages succeed. By default, it updates only edition availability in
`exports/kdm-catalog/kdm-data.json`.

Matching uses `edition.url ?? item.url` against product handles, with named variants distinguishing First Run, Encore, and other releases.
Names and curated mappings are not used. An edition gets `available: true` when any matching warehouse variant is available;
unavailable, unmatched, or ambiguous editions omit the field and default to false. All other catalog fields remain unchanged.
Each refresh replaces earlier availability results, including removing `available: true` from editions now unavailable or unmatched.

Matching counts and unresolved editions are recorded in `temp/kdm-catalog/reports/availability-refresh.json`.
Failed downloads leave the named snapshots and catalog unchanged. If the catalog changes during the refresh, the command refuses to overwrite it.

## Known warnings

### UnoCSS

Development, checks, and builds may warn that `unocss:svelte-scoped:global-styles` uses the unsupported `transformIndexHtml` hook.
This is safe to ignore with the current integration: UnoCSS uses `transform` and `renderChunk` for SvelteKit instead.

After UnoCSS/SvelteKit upgrades or integration changes, rebuild and verify the global stylesheet, safelisted icons, and absence of
`%unocss-svelte-scoped.global%` placeholders in generated HTML.

### CSS corner shape

`pnpm check` may report `Unknown property: 'corner-shape'` in `AttackProfile.svelte`. The current CSS validator does not recognize
the property. It is safe to keep: [`corner-shape: squircle`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/corner-shape)
adjusts the rounded corners in supporting browsers; other browsers ignore it and use the existing `border-radius`.

Investigate other warnings separately.

## License

Original Guidepost source code is licensed under [AGPL-3.0-only](LICENSE). Third-party names, trademarks, game content, artwork,
icons, and other materials retain their owners' rights and applicable licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Guidepost is an unofficial fan project, unaffiliated with Adam Poots Games or other referenced publishers, and is not endorsed or sponsored by them.
