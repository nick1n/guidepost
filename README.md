# Guidepost

A personal hub for board game companion tools, built with SvelteKit 3, Svelte 5, and UnoCSS. The Kingdom Death: Monster tools include a product catalog, hunt event cards, and a first-story showdown aid.

## Getting started

```bash
pnpm install
pnpm dev
```

On Windows, install missing pnpm with `npm.cmd install --global pnpm@12`. [package.json](package.json) pins the project version.

## Using the tools

### Collection

Open `/kdm/collection/` to search products, view editions, and track ownership and wishes. Entries save locally. Included rows show content coverage; product ownership is recorded separately. Stale tabs block editing and offer refresh. Offline use requires a cached catalog.

See the [collection architecture](docs/kdm-architecture.md) for persistence and ownership rules, and the [proposed design](docs/kdm-campaign-design.md) for future campaign and synchronization plans.

Collection links keep browsing state in the hash, for example `/kdm/collection/#/accessories?q=dice` or
`/kdm/collection/#/content?tag=monster&tag=pinup`. Categories are `content`, `accessories`, `bundles`, and `homebrew`;
`q` searches and repeated `tag` parameters require every selected tag. The default content view needs no hash.
Item links such as `/kdm/collection/#/content/woe-white-speaker` show one item, overriding search and tags.
Changing search, tags, category, or ownership filters returns to category browsing.
Controls replace the current history entry, and Back/Forward restores linked views.
Ownership and wishlist filters stay local and are not included in links.

The catalog loads in the browser and is reused on return visits within the app. Catalog and saved-collection failures have separate retry controls.

Choose **Totals currency** in Settings to convert the collection value into USD, EUR, GBP, CAD, AUD, or JPY. Individual products keep
their listed currency. Conversions use Frankfurter's ECB reference rates, cached on this device for 24 hours and refreshed when the
collection is opened or brought back into view. The rate date appears beneath the currency setting. Offline use keeps the last saved
rates; without saved rates, EUR/USD conversion uses the built-in estimate of EUR 1 = USD 1.13. Other currencies need a saved rate,
otherwise amounts stay in their original currencies. Converted totals are estimates and exclude exchange fees.

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
| `pnpm check:build`  | Verify built HTML and assets       |
| `pnpm test:run`     | Run all Vitest tests once          |
| `pnpm test:client`  | Run client-facing app tests        |
| `pnpm test:scripts` | Run build and catalog script tests |
| `pnpm test:catalog` | Alias for script tests             |
| `pnpm build`        | Build the static site              |
| `pnpm preview`      | Serve the production build locally |
| `pnpm format`       | Format project files               |
| `pnpm format:check` | Check formatting                   |

Use `pnpm test` for watch mode.

Pull requests run the shared site build workflow with `/guidepost` as the base path, including build and catalog script tests.
Pushes to `main` and manual runs on `main`
validate, build, check the artifact, and run the production collection startup browser test before deploying to GitHub Pages.
Pushes changing only the Dependabot configuration or Markdown files skip deployment.
The `github-pages` environment must allow only the `main` branch. GitHub Actions use major version tags.
Dependabot groups package and action version updates into one monthly PR. TypeScript major upgrades remain manual until SvelteKit
and svelte-check support the new compiler API; UnoCSS packages remain manual while the scoped integration patch is required.
Automatic rebasing is disabled for new dependency PRs; update their branches manually when needed, then review and merge after CI passes.

### Browser tests

Install Chrome or Chromium; set `CHROME_PATH` if needed. Menu, collection, and hunt checks require a running development server:

```bash
pnpm test:menu-browser -- http://localhost:5173
pnpm test:collection-browser -- http://localhost:5173
pnpm test:hunt-browser -- http://localhost:5173
```

Startup and error-page checks require a production build:

```bash
pnpm build
pnpm test:collection-startup
pnpm test:error-browser
```

These cover initial routing, catalog loading and reuse, retry feedback, layout stability, and cancellation.
Screenshots and reports go to `temp/browser-verification/`.

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
| `scripts/catalog/data/`             | Shared reviewed tags, shop mappings, import schemas, and ledger |
| `local-data/kdm-catalog/`           | Personal workbook, raw import records, and archives             |
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
pnpm catalog:update --fetch
pnpm catalog:apply
pnpm catalog:availability
pnpm catalog:workbook
```

`catalog:update --fetch` prepares the monthly review; inspect it before `catalog:apply` publishes it. See the workflow guide for weekly availability refreshes and specialist commands.

### Generated files

Run `pnpm generate:types` after editing these sources. Development, checks, and builds also generate them.

| Generated output                                                                                                          | Source                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [Catalog types](src/lib/types/gen/kdm-data.d.ts) and [browser validator](src/lib/gen/catalog-validator.js) (with `.d.ts`) | [data.schema.json](static/kdm/catalog/data.schema.json) |
| [Core editions](src/lib/gen/core-editions.json)                                                                           | [data.json](static/kdm/catalog/data.json)               |
| [Workbook map schema](static/kdm/catalog/workbook-map.schema.json)                                                        | [workbook.ts](src/lib/types/workbook.ts)                |

The [workbook map](static/kdm/catalog/workbook-map.json) uses `pnpm catalog:workbook` to validate and normalize the committed product-only map. To rebuild it, pass the private records explicitly with `pnpm catalog:workbook --imports local-data/kdm-catalog/imports/kdm-import-records.json`; the tracked `scripts/catalog/data/import-records.schema.json` validates them.

### Local data

Shared reviewed inputs and applied catalog/news ledger changes belong in version control together. Keep the original XLSX and raw
`kdm-import-records.json` in Git-ignored `local-data/kdm-catalog/`; never commit personal workbook cells. Shopify/news caches stay in
`.cache/`, and generated reports stay in `temp/`.

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
