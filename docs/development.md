# Development

See [AGENTS.md](../AGENTS.md) for required checks and [UI conventions](ui-conventions.md) for interface work.

## Commands

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

## Deployment and dependencies

Pull requests run the shared site build workflow with `/guidepost` as the base path, including build and catalog script tests.
Pushes to `main` and manual runs on `main`
validate, build, check the artifact, and run the production collection startup browser test before deploying to GitHub Pages.
Pushes changing only the Dependabot configuration or Markdown files skip deployment.
The `github-pages` environment must allow only the `main` branch. GitHub Actions use major version tags.
Dependabot groups package and action version updates into one monthly PR. TypeScript major upgrades remain manual until SvelteKit
and svelte-check support the new compiler API; UnoCSS packages remain manual while the scoped integration patch is required.
Automatic rebasing is disabled for new dependency PRs; update their branches manually when needed, then review and merge after CI passes.

## Browser tests

Install Chrome or Chromium; set `CHROME_PATH` if needed. Build the site and start a production preview before running all suites:

```bash
pnpm build
pnpm preview
# In another terminal:
pnpm test:browser --url http://127.0.0.1:4173
```

Run individual suites by path relative to `test/browser/` or the repository root. Multiple files are accepted; `--list` shows available suites:

```bash
pnpm test:browser app/menu.test.mts hunt.test.mts
pnpm test:browser test/browser/collection/interactions.test.mts --url http://localhost:5173
pnpm test:browser --list
```

Suites run sequentially and stop at the first failure. Most use a running app server, defaulting to `http://127.0.0.1:5173`;
`--url` overrides that address. Production preview avoids development-server reloads during a test. Startup and error-page suites require a production build and start their own servers.
Screenshots and reports go to `temp/browser-verification/<suite>/`. Each run writes `report.json`; failures also capture page diagnostics
and a screenshot when the browser is available.

## Project layout

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
| `test/browser/`                     | Headless browser suites, shared support, and browser fixtures   |
| `docs/`                             | Architecture, catalog rules, workflows, and design notes        |
| `scripts/catalog/data/`             | Shared reviewed tags, shop mappings, import schemas, and ledger |
| `local-data/kdm-catalog/`           | Personal workbook, raw import records, and archives             |
| `.cache/`                           | Downloaded evidence and request coordination                    |
| `temp/`                             | Reports, browser verification, and scratch output               |

Shared catalog calculations stay in [kdm-data.ts](../src/lib/kdm-data.ts) and [catalog-view.ts](../src/lib/catalog-view.ts).
Pages share [hash navigation](../src/lib/app/navigation/hash-route.svelte.ts) through `createHashRoute`, which handles URL changes and Back/Forward.
See [design notes](kdm-design-notes.md) for UI decisions.

## Generated catalog files

See [catalog workflows](catalog-workflows.md#generated-files) for sources, generation, and private inputs.

## Service worker

Use SvelteKit 3 APIs:

- `immutable`, `assets`, `prerendered` from `$app/manifest`
- `version` from `$app/env`
- `resolve` from `$app/paths`
- `self` from `$app/service-worker`

Do not use the removed `$service-worker` module. Precache assets individually so one missing asset does not reject installation. The service worker caches the app shell/assets; `DexieStore` owns collection persistence.
