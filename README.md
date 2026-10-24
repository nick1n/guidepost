# Guidepost

A personal hub for board game companion tools, built with SvelteKit 3, Svelte 5, and UnoCSS. The Kingdom Death: Monster tools include a product catalog, hunt event cards, and a first-story showdown aid.

## Getting started

Run from the project root:

```bash
pnpm install
pnpm dev
```

On Windows, if `pnpm` is missing, install the pnpm 12 bootstrap with `npm.cmd install --global pnpm@12`. The `packageManager` field in [package.json](package.json) pins the exact pnpm version used by this project.

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

See [AGENTS.md](AGENTS.md) for coding conventions and required checks. Client tests live in feature directories under `test/client/`; script and build tests live in feature directories under `test/scripts/`. `pnpm test` watches both Vitest projects; `pnpm test:scripts` also runs `*-checks.mts` with Node's test runner. Tests import tooling through `#scripts/*` and catalog JSON through `#catalog/*`, including file extensions.

With a local development server running, `pnpm test:menu-browser -- http://127.0.0.1:5173` checks menu history, focus, preferences, and gestures in installed Chrome or Chromium (or `CHROME_PATH`). Screenshots and the report go to `temp/browser-verification/menu-*`.

`pnpm test:collection-browser [URL]` runs isolated Chrome checks. Set `CHROME_PATH` if Chrome is not detected.

`pnpm test:hunt-browser -- http://localhost:5173` checks card selection, artwork variants, flip and draw animations, and saved settings.
`pnpm test:hunt-artwork-browser -- http://localhost:5173` checks artwork exit sequencing, rapid changes, image loading, and the rendered face during entry.
`pnpm test:hunt-navigation-browser -- http://localhost:5173` checks that navigating Home removes hunt controls immediately, on mobile and desktop with both motion preferences.
`pnpm test:hunt-picker-browser -- http://localhost:5173` checks the event picker's gestures, focus, dismissal, and short-screen layout.
Both require a running local server and installed Chrome or Chromium (or `CHROME_PATH`); screenshots and reports go to `temp/browser-verification/`.

## Where things live

| Path                                | Purpose                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| `src/routes/`                       | Pages and route loaders                                         |
| `src/lib/kdm/collection/`           | Collection browsing, cards, commands, and persistence           |
| `src/lib/kdm/showdown/`             | Showdown rules, display state, and UI                           |
| `src/lib/kdm/survivors/`            | Survivor gear and progress controls                             |
| `src/lib/kdm/catalog/ui/`           | Catalog UI shared with Quick Start                              |
| `src/lib/kdm/ui/`                   | Shared KDM presentation and status definitions                  |
| `src/lib/app/`                      | Menu, date preferences, and notifications                       |
| `src/lib/components/`               | Reusable controls, dialogs, and gestures                        |
| `src/lib/types/`                    | Catalog, collection, and workbook contracts shared with tooling |
| `scripts/catalog/commands/`         | Catalog command entrypoints                                     |
| `scripts/catalog/`, `scripts/news/` | Catalog implementation and news scraping                        |
| `static/kdm/catalog/`               | Live catalog, schemas, and product-only workbook map            |
| `test/client/`, `test/scripts/`     | Tests grouped by feature and tooling area                       |
| `docs/`                             | Architecture, catalog rules, workflows, and design notes        |
| `local-data/kdm-catalog/`           | Retained imports, reviewed tags, shop mappings, and archives    |
| `.cache/`                           | Downloaded evidence and request coordination                    |
| `temp/`                             | Reports, browser verification, and scratch output               |

Shared catalog calculations stay in [kdm-data.ts](src/lib/kdm-data.ts) and [catalog-view.ts](src/lib/catalog-view.ts).
See the [collection architecture](docs/kdm-architecture.md), [campaign proposal](docs/kdm-campaign-design.md),
[catalog guide](docs/kdm-catalog.md), [catalog workflows](docs/catalog-workflows.md), and [design notes](docs/kdm-design-notes.md).

Keep `local-data/kdm-catalog/` backed up because it holds reviewed imports, `kdm-tags.json`, `kdm-tags.schema.json`, `kdm-shop-mappings.json`, and archives required to reproduce catalog work. It is Git-ignored; do not commit personal workbook cells. Shopify caches live in `.cache/kdm-catalog/shopify-products/`. Reports remain under `temp/kdm-catalog/reports/`, and request coordination remains in `.cache/kdm-shop/`.

## Generated files

| Generated output                                                                           | Authoritative input and command                                                                       |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [src/lib/types/gen/kdm-data.d.ts](src/lib/types/gen/kdm-data.d.ts)                         | [static/kdm/catalog/data.schema.json](static/kdm/catalog/data.schema.json); run `pnpm generate:types` |
| [src/lib/gen/catalog-validator.js](src/lib/gen/catalog-validator.js) and its `.d.ts`       | [static/kdm/catalog/data.schema.json](static/kdm/catalog/data.schema.json); run `pnpm generate:types` |
| [src/lib/gen/core-editions.json](src/lib/gen/core-editions.json)                           | [static/kdm/catalog/data.json](static/kdm/catalog/data.json); run `pnpm generate:types`               |
| [static/kdm/catalog/workbook-map.schema.json](static/kdm/catalog/workbook-map.schema.json) | [src/lib/types/workbook.ts](src/lib/types/workbook.ts); run `pnpm generate:types`                     |
| [static/kdm/catalog/workbook-map.json](static/kdm/catalog/workbook-map.json)               | Live catalog plus local workbook import records; run `pnpm catalog:workbook`                          |

Edit authoritative inputs, not generated outputs. Development, checks, and builds may regenerate generated types, the browser validator, and core editions. The validator bundles Ajv standalone code and its runtime helpers as self-contained ESM; the browser does not compile schemas. Tooling-only semantic and cross-reference checks remain in `catalog:validate`. See [catalog workflows](docs/catalog-workflows.md#workbook-map) and the [catalog guide](docs/kdm-catalog.md).

## Catalog

The live app reads [data.json](static/kdm/catalog/data.json). Item IDs are object keys; explicit edition IDs are permanent and independent of mutable labels. For data rules, identity, and reviewed product decisions, see the [catalog guide](docs/kdm-catalog.md). For commands, cache behavior, local inputs, imports, and reports, see [catalog workflows](docs/catalog-workflows.md).

Common commands:

```bash
pnpm catalog:validate
pnpm catalog:update --sim --fetch
pnpm catalog:availability
pnpm catalog:workbook
```

Catalog commands use local files and caches by default. Add `--fetch` for network access. See each command's `--help` output and the workflow guide before applying staged catalog changes.

## Collection

Open `/kdm/collection/` for search, edition details, ownership, and wishlist controls. Entries save locally through Dexie under stable content and edition IDs. Product ownership is explicit; included rows show derived content coverage. Stale tabs block editing and offer refresh while preserving the current view. Offline use requires a previously cached catalog.

See the [implemented collection architecture](docs/kdm-architecture.md) for persistence, ownership, and content coverage. Future campaign and synchronization concepts are documented separately as [proposed design](docs/kdm-campaign-design.md).

## Known warnings

The pnpm patch for `@unocss/svelte-scoped` preserves source maps when inserting the global stylesheet link and unregisters its unused `transformIndexHtml` hook in SvelteKit. Standalone Vite retains that hook. It also checks the complete streamed HTML head, including `res.end()` content, so split chunks do not trigger false missing-stylesheet errors. Error and non-HTML responses are excluded. When updating UnoCSS, remove the patch only after verifying upstream handles source maps, hook registration, and streamed response checks. After integration upgrades, verify the global stylesheet, safelisted icons, and absence of `%unocss-svelte-scoped.global%` placeholders in generated HTML.

- The CSS validator may report `Unknown property: 'corner-shape'` in [AttackProfile.svelte](src/lib/kdm/showdown/ui/AttackProfile.svelte). Supporting browsers use `corner-shape: squircle`; others keep the `border-radius` fallback.

Investigate other warnings separately.

## License

Original Guidepost source code is licensed under [AGPL-3.0-only](LICENSE). Third-party materials retain their owners' rights and licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Guidepost is an unofficial fan project, unaffiliated with Adam Poots Games or other referenced publishers, and is not endorsed or sponsored by them.
