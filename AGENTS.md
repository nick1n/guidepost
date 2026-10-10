# Guidepost

See [README.md](README.md) for the project overview, setup, commands, catalog workflows, and known warnings. This file defines coding conventions, architecture constraints, and required checks.

## AI output style

Never use em dashes or centered dots in user-facing output. Use commas, colons, semicolons, parentheses, bullets, or separate sentences.

## Sub-agents

When delegation is authorized, choose the model and reasoning effort for each task rather than inheriting the primary agent's settings:

- Straightforward tasks with clear instructions, such as file inventories, small documentation edits, or mechanical changes: use
  `gpt-6-luna` with `high` reasoning.
- Medium-complexity tasks with bounded scope, such as focused reviews, isolated implementation, or tests for defined behavior: use
  `gpt-6.1-sol` with `low` reasoning.
- Complex or uncertain tasks, such as architecture decisions, concurrency, persistence, or subtle Effect behavior: keep them with the
  primary agent or use `gpt-6.1-sol` with higher reasoning when delegation helps.

Use only model IDs and reasoning levels exposed by the runtime. These are defaults; increase reasoning or change models when the task
requires it, and briefly explain the exception. When model overrides require `fork_turns="none"`, provide a self-contained brief with
the relevant files, constraints, and expected result. The primary agent owns integration and the required checks.

## Required skills

- For creating, editing, reviewing, or debugging `.svelte`, `.svelte.ts`, or `.svelte.js` files, always use `svelte-code-writer` and `svelte-core-bestpractices`.
- For Effect workflows, services, errors, or tests, use `.agents/skills/effect` alongside the installed-package guidance below.

## Landing page

`src/routes/+page.svelte` is the tool directory. Keep it lightweight, dark, and mobile-first. On mobile, the header sits above the navigation and aligns right. At the wide breakpoint, it stays fixed in the bottom-left and aligns left, with navigation on the right.

The window owns scrolling as the link list grows; do not add a navigation scrolling container. Preserve the full-bleed warm glow, pointer or device-orientation movement, flicker, slow pulse, and reduced-motion behavior unless a redesign changes them. This page may override the global stable scrollbar gutter for edge-to-edge backgrounds.

## TypeScript

Prefer inferred types. Add annotations for public APIs, complex values, readability, or to prevent incorrect widening. Prefer type names of one or two words unless a longer name is clearer; descriptive function names may be longer.

Before adding a constants-only module, check `src/lib/constants.ts` and existing modules. Keep single-component constants local and shared constants in the module serving their consumers. Create a new module only for a distinct feature with enough related data or behavior. Update imports and remove obsolete modules when consolidating.

## Svelte

Use Svelte 5 runes and callback props.

Use event shorthand when a local handler matches the attribute, including on `<svelte:window>` and `<svelte:document>`. Name handlers used by only one binding after that event. Keep explicit attributes for argument passing, event transformations, propagation control, or shared/imported handlers with meaningful names. Do not rename domain handlers to force shorthand. Move multiline inline handlers into `<script>`.

Use `$effect` only for external synchronization that cannot happen in an event handler. Prefer derived values or direct handlers otherwise, and comment above each required effect explaining why it cannot be replaced.

Use class arrays for conditional classes, such as `class={["item", active && "is-active"]}`. Avoid template strings and do not add `class:` directives.

## Accessibility

Use semantic HTML without redundant roles or ARIA. Add ARIA only for names, descriptions, states, or relationships HTML cannot express. Prefer visible labels; use `aria-label` only without a suitable visible label and `aria-describedby` for supplemental information. Referenced IDs must be unique and present. Do not substitute `title` for an accessible name or description.

Hide non-focusable decorative icons and effects with `aria-hidden="true"`. Never hide focusable elements or their ancestors. Informative icons need a text equivalent.

## Styling

Never use all-uppercase text in interface designs. Use sentence case for headings, labels, buttons, and navigation; do not apply `text-transform: uppercase` or manually capitalize entire words for visual emphasis.

Use component-scoped `<style>` blocks for layout, spacing, typography, and interaction. Keep UnoCSS for icons; do not add Tailwind-style layout utilities, Tailwind, `clsx`, `tailwind-merge`, or `cn`. Migrate existing utility-heavy components incrementally when touched.

### Selectors and markup

- Use top-level, unqualified tag selectors when an element is unique or all instances share styling. Svelte already provides scope; do not wrap styles in a root selector or qualify semantic tags just to scope them.
- Use short purpose-based classes when instances differ, styles span tags, or a stable hook is clearer. Prefer at most two classes per element: a role plus a state, variant, or icon. Do not replace useful classes with positional selectors.
- Keep selectors shallow and low-specificity, usually with at most two classes. Do not mirror markup hierarchy or nest type selectors.
- Use native nesting for the same subject's pseudo-elements, states, and variants, such as `&:hover` or `&.accent-primary`. Prefer one nesting level; a second is acceptable for a closely related variant state. Do not flatten or nest mechanically.
- Use modern pseudo-classes such as `:is()` and `:where()` and logical properties such as `inline-size`, `block-size`, and `margin-inline`.

### Declarations and responsive layout

Prefer simple modern CSS and native platform features. Use legacy workarounds or performance optimizations only for verified browser-support or profiling needs.

Every declaration must change a supported layout or state. Avoid repeating inherited fonts/colors, preflight resets, or sizing/alignment supplied by normal block/grid layout. Do not add `position`, `z-index`, `overflow`, `isolation`, `contain`, `will-change`, or `pointer-events` defensively; each needs a specific purpose. Preserve companion declarations required for that behavior.

Remove obsolete declarations and tokens when touching a rule. Check base/wide layouts, interaction, and reduced-motion states before deciding something is redundant. Matching pixels at one viewport is insufficient evidence.

Write mobile-first styles with shared mobile/tablet defaults and occasional `min-width` overrides. Prefer normal flow and fluid values (`clamp()`, `min()`, `max()`) to spacing/type breakpoints. Avoid `max-width` and viewport-height queries unless needed for usability. Group a small component's overrides for one breakpoint in a top-level media query; keep capability queries, including reduced motion, separate.

### Tokens and theme

[src/app.css](src/app.css) owns shared colors, type sizes, weights, line heights, borders, radii, and motion values; [uno.config.ts](uno.config.ts) exposes the theme to UnoCSS. Declare each custom property once. Put component-specific layout values and complex effects on that component's root selector.

Use `var(--token)` for theme colors and semantic color utilities in existing utility markup. Prefer role aliases (`--accent`, `--primary`, `--destructive`) when appropriate, otherwise named palette tokens (`--background`, `--panel`, `--card`, `--foreground`, `--muted-foreground`, and `--accent-blue/green/red/purple`). Add missing tokens to the theme before using them. Read palette values from the source files.

Name tokens by purpose, with broad-to-specific grouping such as `--layer-content`, `--size-icon`, or `--duration-pulse`. Use variables for reused/tunable values. A one-use token needs a meaningful concept, local override, or clearer representation of a complex value. Remove unused/duplicate tokens without merging unrelated concepts. Structural values (`0`, `100%`, `auto`, grid ratios, media thresholds) may stay literal.

Use alpha hex (`#RRGGBBAA`) for fixed translucent colors. Reserve `color-mix()` for token-derived colors or blends; specify an interpolation space such as `in oklch` only when blending distinct colors benefits. Omit it for one-color/transparent mixes and gradients. Open Props may guide naming/scales; add the dependency only if a substantial portion is needed.

Shared motion durations are disabled by the reduced-motion query in `src/app.css`. Avoid component queries that only repeat those duration resets. Keep component reduced-motion rules for transforms, custom animations, gesture feedback, and other behavior the shared durations do not cover.

### Icons

Use Material Symbols through UnoCSS, for example `class="search-icon i-material-symbols:search"`. The icon preset in `uno.config.ts` supplies `display: inline-block` and square dimensions from `--size-icon`, falling back to `1em`. Set `--size-icon` on the icon for a custom size instead of repeating display and dimension declarations. Use the shared `control-icon` and `external-icon` classes when their sizes fit. Keep local display overrides required by layout or visibility, and give icons an explicit text color on contrasting backgrounds. Follow the accessibility rules above.

Keep `--size-icon` overrides on icon elements so the value does not unintentionally reach nested icons. This convention applies to UnoCSS icons; `KdIcon` uses font sizing, and icon containers still need their own layout dimensions.

Safelist icon classes in `uno.config.ts` when extraction is unreliable. Verify production CSS if an icon works only in development.

## Catalog

`static/kdm-catalog/data.json` is the live app's source of truth. Data is grouped by category and IDs are object keys; do not add `id` fields to objects. Update `static/kdm-catalog/data.schema.json` when the shape changes and regenerate types as described in [README.md](README.md#catalog).

Explicit editions require permanent readable lowercase kebab-case `id` values, unique within their item. Assign IDs once; never regenerate them when `label`, `name`, or other facts change, and never reuse retired IDs for different releases. Creation tooling in `scripts/catalog/identity.mts` rejects collisions for review. Keep `label` as a mutable display label and do not use it as collection identity. Items
without explicit editions use synthetic `item` IDs, or `bundle` for bundles. The product-only
`static/kdm-catalog/workbook-map.json` connects local workbook rows to these IDs; regenerate it with `pnpm catalog:workbook` from the
Git-ignored import records. Sheet and row numbers are locators for that workbook snapshot, not permanent IDs. Review changed row
identities and ambiguous release alternatives before import or export uses them. Do not put personal workbook cells in
the map.

`src/lib/types/workbook.ts` owns workbook mapping and normalized-row schemas and types. Tooling and collection transfers share them.
Change that contract and run `pnpm generate:types` to refresh `static/kdm-catalog/workbook-map.schema.json`; do not edit the generated
editor schema by hand. Workbook publication guards its captured catalog, import records, schemas, and previous map before replacement.

Keep item fields alphabetical, edition fields starting with `id` then `label`, and inclusion-object fields starting with `item`; remaining fields are alphabetical. Use `orderItemFields`/`organizeCatalog` in `scripts/catalog/order.mts`. Preserve category/item ordering and edition/other array ordering. Inclusion `editionId` resolves on the child item; `parentEditionIds` resolves on the containing item. Edition IDs do not need global uniqueness. Reserve `item` and `bundle` for synthetic editions.

Keep catalog-derived helpers in `src/lib/kdm-data.ts` or `src/lib/catalog-view.ts`, not duplicated in components. `CollectionBrowsing`
owns browsing and URL transitions; `CollectionCards` owns card collapse, deferred rendering, viewport observation, and held-card scroll
anchoring. The collection page disposes card resources on unmount and owns focus, gestures, and navigation.

Load the full catalog only through the collection route. The root layout initializes an empty catalog. Quick Start directly imports
generated `src/lib/gen/core-editions.json`, containing only playable core editions' IDs and labels in catalog order, excluding Resin;
`pnpm generate:types` refreshes it from the live catalog. Catalog helpers receive data explicitly. Switching to
the full catalog must preserve the owner's snapshot and pending writes. Disable collection-link hover data preloading and keep
the full catalog and collection HTML out of service-worker precaching; cache them after collection is visited.

## Effect

This project uses Effect v4. Before changing Effect code, read `node_modules/effect/AGENTS.md` completely and follow relevant linked references. For uncovered APIs/behavior, inspect the installed source and types. Prefer version-matched guidance over examples from other releases. If unavailable, report it and consult official documentation matching the installed version; do not upgrade Effect just to obtain guidance.

Use feature-owned `Schema.TaggedError` classes and unions at action boundaries. Use named `Effect.fn` for significant effectful operations, preserving deferred execution and instance binding. Keep pure helpers and UI callbacks ordinary functions. Preserve interruption when handling broad causes; cancellation must not produce failure notifications. Library guidance does not override the state, persistence, and UI boundaries below.

At action boundaries, inspect the full cause before extracting a typed error. Causes containing interruption remain interrupted, even if they also contain a typed failure. Causes containing defects log the full cause rather than hiding it behind an expected error message. Keep simple Effect operations direct; generator wrappers should express actual sequencing.

## State and persistence

For campaign, settlement, survivor, gameplay undo/redo, preferences, or Dexie synchronization work, read [docs/kdm-architecture.md](docs/kdm-architecture.md). It proposes one owner and settlement per campaign, many survivors, memberships, and shared showdown/settlement/hunt history. It has explicit implementation gaps; do not treat proposed campaign services as existing code.

Preserve these collection boundaries unless the task explicitly changes them:

```text
Collection -> OptimisticStore -> DexieStore (CollectionStore)
```

- The root layout provides one `Collection` per app instance through Svelte context. `Collection` owns collection commands. `CollectionStore` in `src/lib/state/stores.ts` is the persistence interface implemented by `DexieStore` in `src/lib/state/dexie-store.ts`; data types live in `src/lib/types`.
- `DexieStore` reads and writes complete snapshots scoped to one owner in IndexedDB. It applies changed rows and removals with the revision check and update in one transaction. The `ownerId` index serves snapshot reads; entry primary keys serve writes. Load Dexie only inside browser initialization. Metadata schema version 1 validates the stored shape and is not a migration. Keep storage details out of `Collection`.
- `CollectionStore.changes` optionally reports stale snapshots. `DexieStore` uses metadata `liveQuery` subscriptions with Effect finalizers. `Collection.observeChanges()` blocks edits and offers explicit refresh without replacing optimistic state. Observations never advance the expected write revision; local saves must not report themselves as stale.
- Observer failures set a load error and block edits while preserving the snapshot. The layout forwards `Collection.canObserve` to `CollectionSession`, which owns startup, scoped monitoring, and teardown. Keep healthy monitoring active during refresh and restart failed monitoring only after a successful retry. Interrupt the subscription before closing Dexie. A storage-module download failure has no store to retry; offer a page reload.
- Collection state stores `owned`, `wished`, and numeric `copyNumber` (integers 1 through 9999, bounded by a known run size) under stable content and edition IDs. Do not key saved entries by mutable edition labels.
- `OptimisticStore` holds confirmed state plus pending field patches, serializes persistence, and removes failed patches without overwriting newer edits. Only persistence waits in the queue. Batch related updates in one `saveMany()` transaction.
- Backups validate before replacing a snapshot; workbook imports validate normalized row identities and merge provided fields in one queued save. Exports wait for queued writes and use confirmed data. Keep XLSX controls deferred.
- Guard asynchronous results and failures against owner/store changes, including backup and workbook validation and export. Superseded operations interrupt before updating the next owner's state or reaching notifications.
- Run UI Effects through `collectionActions.run()`, for example `collectionActions.run(collection.setManyOwned(ids, true))`. This ordinary TypeScript module owns no reactive state. Loading errors belong to `Collection.loadError` alongside `loadStatus`, and clear on retry or user changes.
- `Notifications` currently uses injected Effect logging; visible toasts are planned. Initialize with `{ success: false }` to avoid startup save announcements.
- Reusable dialogs use ordinary callbacks and close immediately on confirmation. They own focus, dismissal, and closing-animation guards; the parent owns persistence/workflows. Quick Start assumes core ownership and navigates independently of saving, even on failure.

Client-facing tests live in `test/client/`, using Vitest 5 and the version-aligned `@effect/vitest` adapter. Build and catalog script tests live in `test/scripts/` and import tooling through `#scripts/*`. Prefer `it.effect`, injected services, `Deferred` synchronization, and `TestClock`. Preserve optimistic-update, rollback, interruption, and finalization coverage when refactoring the queue. Keep Dexie snapshot, owner isolation, and stale-revision coverage in `test/client/dexie-store.test.mts`.
Preserve mixed-cause handling, observer failure/retry, refresh races, and superseded transfer coverage in the collection action, collection, and transfer tests.

## PWA and service worker

Use SvelteKit 3 APIs:

- `immutable`, `assets`, `prerendered` from `$app/manifest`
- `version` from `$app/env`
- `resolve` from `$app/paths`
- `self` from `$app/service-worker`

Do not use the removed `$service-worker` module. Precache assets individually so one missing asset does not reject installation. The service worker caches the app shell/assets; `DexieStore` owns collection persistence.

## Required checks

Run commands from the project root. Preserve unrelated user changes; do not reset or overwrite the working tree wholesale.

1. Run `pnpm check` before finishing.
2. Run `pnpm format:check` or format touched files with project Prettier (140-character width and Svelte plugin).
3. Run `pnpm test:run` after Effect workflow or persistence changes (`pnpm test` is watch mode).
4. Run `pnpm build` for build, service-worker, UnoCSS, or routing changes. After UnoCSS/SvelteKit dependency or integration changes, verify pages link to an existing global stylesheet, safelisted icons have CSS rules, and generated HTML has no `%unocss-svelte-scoped.global%` placeholders.

The [documented warnings](README.md#known-warnings) are safe to ignore. Preserve the UnoCSS integration and `corner-shape` enhancement rather than changing them solely to silence those warnings. Investigate other warnings separately.
