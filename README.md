# Guidepost

A personal hub for board game companion tools, built with SvelteKit 3, Svelte 5, and UnoCSS.
The Kingdom Death: Monster tools include a catalog and collection tracking saved locally in your browser.

## Getting started

Run these commands from the project root:

```bash
pnpm install
pnpm dev
```

| Command             | Purpose                            |
| ------------------- | ---------------------------------- |
| `pnpm check`        | Check Svelte and TypeScript        |
| `pnpm test:run`     | Run app tests once                 |
| `pnpm test:catalog` | Run catalog script tests           |
| `pnpm build`        | Build the static site              |
| `pnpm preview`      | Serve the production build locally |
| `pnpm format`       | Format project files in place      |
| `pnpm format:check` | Check formatting                   |

See [AGENTS.md](AGENTS.md) for coding conventions and required checks. The
[KDM architecture](docs/kdm-architecture.md) describes current collection storage and planned campaign and offline sync work.

## Catalog

The live app reads [src/lib/kdm-data.json](src/lib/kdm-data.json). Its
[schema](src/lib/kdm-data.schema.json) generates `src/lib/types/gen/kdm-data.d.ts`.
After changing the schema, run `pnpm generate:types`. Development, checks, and builds also regenerate types;
the dev server watches schema changes. Do not edit generated types by hand.

The [review catalog](exports/kdm-catalog/README.md) is maintained separately in `exports/kdm-catalog/` and still needs
app integration and saved-collection migration. Its guide covers data rules, mappings, and review decisions.
Working files, caches, and reports under `temp/` are Git-ignored. Keep a copy of local tags or mappings before clearing that folder.

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

Applying a review writes the review catalog and local reports. Stale inputs are rejected; prepare a new review if its inputs change.
Validation checks schemas, references, ordering, and local tag assignments without changing them.
Shop requests are at least 35 seconds apart and cached for 24 hours. Use `--offline` for cached evidence or `--refresh` to fetch again.

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
| `pnpm catalog:availability`           | Fetch shop pages and replace review-catalog availability  |
| `pnpm catalog:availability --offline` | Apply saved shop pages without requests                   |
| `pnpm catalog:editions`               | Fill content items missing editions from Shopify variants |
| `pnpm catalog:editions --offline`     | Fill missing editions using cached responses              |

Availability matching uses shop handles or URLs and release variants. A matching warehouse in stock makes an edition available;
unmatched or ambiguous shop editions default to unavailable. Homebrew availability is preserved.
Results go to `temp/kdm-catalog/reports/availability-refresh.json`.

Edition retrieval groups warehouse choices under their release label and leaves failed listings unchanged.
Requests are 33 seconds apart; responses stay cached until `--refresh`.
Results go to `temp/kdm-catalog/reports/edition-retrieval.json`.
Both commands write the review catalog and refuse to overwrite catalog edits made during retrieval.

### Live shop links

`pnpm check:shop-links` writes `shopReachable` in the live catalog's content, dice, and bundle categories.
It uses HEAD requests with redirects and a 10-second timeout: `true` for HTTP 2xx, `false` for errors, and `null` for missing URLs.
Failures may reflect rate limits or HEAD rejection. Reachability does not indicate stock.

### Tracker drafts

With the dev server running, open [/track-preview/](http://localhost:5173/track-preview/) to compare three review-catalog layouts.
Try search, edition details, ownership, and wishlist controls. Selections reset on reload and are not saved to your collection.

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
