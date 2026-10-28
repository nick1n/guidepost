# Guidepost

A personal hub for board game companion tools, built with SvelteKit 3, Svelte 5, and UnoCSS. The Kingdom Death: Monster tools include a product catalog, hunt event cards, and a first-story showdown aid.

## Getting started

Run from the project root:

```bash
pnpm install
pnpm dev
```

On Windows, if `pnpm` is missing, install the pnpm 12 bootstrap with `npm.cmd install --global pnpm@12`. The `packageManager` field in [package.json](package.json) pins the exact pnpm version used by this project.

## Using the tools

### Collection

Open `/kdm/collection/` for search, edition details, ownership, and wishlist controls. Entries save locally through Dexie under stable content and edition IDs. Product ownership is explicit; included rows show derived content coverage. Stale tabs block editing and offer refresh while preserving the current view. Offline use requires a previously cached catalog.

See the [implemented collection architecture](docs/kdm-architecture.md) for persistence, ownership, and content coverage. Future campaign and synchronization concepts are documented separately as [proposed design](docs/kdm-campaign-design.md).

Use **Import workbook** or **Export workbook** in the collection menu to transfer KDM Collection Sheets or Guidepost exports.
Imports preview changes and ask you to resolve ambiguous editions. Original sheets merge checked products, wishes, and copy numbers;
blank and unchecked cells leave saved values unchanged. Exports preserve the original three-tab layout and retain collection data for reimport.
Files are processed in your browser without uploads.

### Hunt links

Share a hunt card using `/kdm/hunt/#/event/art/face`, for example `/kdm/hunt/#/1/fen/front`.

- Events: `0` through `99` (`0` is event 100).
- Artwork: `ccg`, `fen`, or `kekasi`.
- Face: `front`, `back`, or `reverse` for cards with a special reverse.

Links default to event 1, CCG artwork, and the back face, so `#/1` is enough. Opening a link leaves saved artwork preferences unchanged.
Card controls update the URL without adding browser history entries.

## Development

See [AGENTS.md](AGENTS.md) for coding conventions and required checks.

### Commands

| Command             | Purpose                            |
| ------------------- | ---------------------------------- |
| `pnpm check`        | Check Svelte and TypeScript        |
| `pnpm test:run`     | Run all Vitest tests once          |
| `pnpm test:client`  | Run client-facing app tests        |
| `pnpm test:scripts` | Run build and catalog script tests |
| `pnpm test:catalog` | Alias for script tests             |
| `pnpm build`        | Build the static site              |
| `pnpm preview`      | Serve the production build locally |
| `pnpm format`       | Format project files               |
| `pnpm format:check` | Check formatting                   |

Use `pnpm test` for watch mode.

### Browser tests

Start a local development server and install Chrome or Chromium. Set `CHROME_PATH` if it is not detected.

```bash
pnpm test:menu-browser -- http://localhost:5173
pnpm test:collection-browser -- http://localhost:5173
pnpm test:hunt-browser -- http://localhost:5173
```

These check menu interactions, collection controls, and hunt cards. Screenshots and reports go to `temp/browser-verification/`.

### Project layout

| Path                                | Purpose                                                         |
| ----------------------------------- | --------------------------------------------------------------- |
| `src/routes/`                       | Pages and route loaders                                         |
| `src/lib/kdm/`                      | KDM features and shared UI                                      |
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
Pages share [hash navigation](src/lib/app/navigation/hash-route.svelte.ts) through `createHashRoute`, which handles URL changes and Back/Forward.
See [design notes](docs/kdm-design-notes.md) for UI decisions.

## Catalog

The live app reads [data.json](static/kdm/catalog/data.json). Item IDs are object keys; explicit edition IDs are permanent and independent of mutable labels.

- [Catalog guide](docs/kdm-catalog.md): data rules, identity, and reviewed product decisions.
- [Catalog workflows](docs/catalog-workflows.md): commands, cache behavior, local inputs, imports, and reports.

### Commands

Catalog commands use local files and caches by default. Add `--fetch` for network access.

```bash
pnpm catalog:validate
pnpm catalog:update --sim --fetch
pnpm catalog:availability
pnpm catalog:workbook
```

See each command's `--help` output and the workflow guide before applying staged catalog changes.

### Generated files

Edit the source files, then run `pnpm generate:types` to refresh these outputs. Development, checks, and builds also run this command.

| Generated output                                                                                                          | Source                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [Catalog types](src/lib/types/gen/kdm-data.d.ts) and [browser validator](src/lib/gen/catalog-validator.js) (with `.d.ts`) | [data.schema.json](static/kdm/catalog/data.schema.json) |
| [Core editions](src/lib/gen/core-editions.json)                                                                           | [data.json](static/kdm/catalog/data.json)               |
| [Workbook map schema](static/kdm/catalog/workbook-map.schema.json)                                                        | [workbook.ts](src/lib/types/workbook.ts)                |

The [workbook map](static/kdm/catalog/workbook-map.json) uses a separate command, `pnpm catalog:workbook`, and requires the live catalog and local workbook import records.

### Local data

Back up `local-data/kdm-catalog/`. Its reviewed imports, tags, shop mappings, and archives are needed to reproduce catalog work.
The folder is Git-ignored; do not commit personal workbook cells.

## Known warnings

Keep the `@unocss/svelte-scoped` patch until upstream fixes source maps, SvelteKit hook registration, and streamed HTML checks.
After integration upgrades, verify that pages link to an existing global stylesheet, safelisted icons have CSS rules, and generated HTML
contains no `%unocss-svelte-scoped.global%` placeholders.

The CSS validator may report `Unknown property: 'corner-shape'` in [AttackProfile.svelte](src/lib/kdm/showdown/ui/AttackProfile.svelte).
Supporting browsers use `corner-shape: squircle`; others keep the `border-radius` fallback.

Investigate other warnings separately.

## License

Original Guidepost source code is licensed under [AGPL-3.0-only](LICENSE). Third-party materials retain their owners' rights and licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Guidepost is an unofficial fan project, unaffiliated with Adam Poots Games or other referenced publishers, and is not endorsed or sponsored by them.
