# Guidepost

SvelteKit 3 and Svelte 5 board game tools. Start with [README.md](README.md) for setup and [GLOSSARY.md](GLOSSARY.md) for domain terms.

## Read for your task

Before editing, read every guide and required skill matching the task below. For work spanning several areas, read all matching guidance;
do not rely on this summary or generic library examples alone.

| Task                                      | Required guidance                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| UI, styling, accessibility                | [UI conventions](docs/ui-conventions.md)                                                            |
| Collection, preferences, persistence      | [Implemented architecture](docs/kdm-architecture.md)                                                |
| Effect workflows, services, errors, tests | [Effect conventions](docs/effect-conventions.md) and [Effect skill](.agents/skills/effect/SKILL.md) |
| Catalog data or tooling                   | [Catalog guide](docs/kdm-catalog.md) and [workflows](docs/catalog-workflows.md)                     |
| Campaign or synchronization design        | [Proposed design](docs/kdm-campaign-design.md), not implemented behavior                            |
| Build, browser tests, service worker      | [Development](docs/development.md)                                                                  |

Source: `src/routes/` for pages, `src/lib/kdm/` for features, `src/lib/app/` for shared app services,
`src/lib/components/` for controls, `src/lib/types/` for contracts, `scripts/` for tooling.
See the [project layout](docs/development.md#project-layout) for data and test directories.

## Working rules

- Preserve unrelated working-tree changes and reviewed catalog facts. Never reset the working tree wholesale.
- Preserve the site's theme, copy, and playful interactions outside the requested scope.
- Never use em dashes or centered dots in user-facing output.
- Document durable workflows, contracts, and decisions in their existing home. Keep resolved bugs and test results in tests or PR descriptions.
- Read and write text explicitly as UTF-8, including scripts and subprocess output. Inspect bulk diffs for damaged Unicode.
- Scripts use local files and caches by default. Every network path, including retries and fallbacks, requires `--fetch`.

## Code conventions

- Infer types unless annotations clarify a contract or prevent incorrect widening. Avoid redundant names and nested ternaries.
- Keep single-component constants local and shared constants with their consumers; check `src/lib/constants.ts` before adding a constants module.
- Use Svelte 5 runes, callback props, class arrays, and scoped CSS. UnoCSS is for icons; do not add utility layout systems.
- Use both [svelte-code-writer](.agents/skills/svelte-code-writer/SKILL.md) and [svelte-core-bestpractices](.agents/skills/svelte-core-bestpractices/SKILL.md) for any `.svelte`, `.svelte.ts`, or `.svelte.js` work.
- Use the [UI refactor skill](.agents/skills/ui-refactor/SKILL.md) before UI-affecting refactors.
- Keep asynchronous application storage and lifecycle workflows in Effect, run through `src/lib/app/actions.ts`. Promises and callbacks belong inside adapters.
- Before Effect changes, read all of `node_modules/effect/AGENTS.md` and relevant references. Use Effect `HttpClient` for new application HTTP requests and asset downloads; validate JSON with Schema.
- Preserve `Collection -> OptimisticStore -> DexieStore (CollectionStore)`. Product ownership is explicit; content coverage is derived.
- Guard asynchronous results and failures against owner/store changes. Superseded operations must interrupt before updating state or notifying; interrupted causes never produce failure notifications.
- Keep revision checks and snapshot writes in one transaction. Observations never advance the expected write revision; exports wait for pending writes and use confirmed state.
- Keep catalog-derived helpers in `src/lib/kdm-data.ts` or `src/lib/catalog-view.ts`. Load the full catalog only through the collection route.
- Catalog item keys and edition IDs are permanent identity; labels are display text. Never commit personal workbook cells.

## Skills

Use [kdm-catalog-update](.agents/skills/kdm-catalog-update/SKILL.md) for store reviews, [vitest](.agents/skills/vitest/SKILL.md) for test work,
and [pwa-development](.agents/skills/pwa-development/SKILL.md) for offline or worker changes. Other skills live under `.agents/skills/`;
load only those relevant to the task. Project contracts take precedence over generic examples.

## Delegation

When delegation is authorized, use `gpt-6-luna` with `high` reasoning for mechanical tasks, `gpt-6.1-sol` with `low` for bounded implementation or review,
and the primary agent or `gpt-6.1-sol` with higher reasoning for architecture, concurrency, persistence, or subtle Effect work.
Use available model IDs only and explain exceptions. For `fork_turns="none"`, supply a self-contained brief. The primary agent owns integration and checks.

## Required checks

Run from the project root:

1. Always run `pnpm check`.
2. Run `pnpm format:check` or format touched files with project Prettier.
3. After Effect workflow or persistence changes, run `pnpm test:run` (`pnpm test` watches).
4. For catalog edits, run `pnpm catalog:validate`; for catalog script changes, also run `pnpm test:catalog`.
5. For build, service-worker, UnoCSS, or routing changes, run `pnpm build`. After UnoCSS/SvelteKit integration upgrades, also verify stylesheet links,
   safelisted icon rules, and absence of `%unocss-svelte-scoped.global%` in generated HTML.

Only [documented warnings](README.md#known-warnings) may be ignored. Preserve the UnoCSS patch and `corner-shape` fallback.
