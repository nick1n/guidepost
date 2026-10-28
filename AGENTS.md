# Guidepost

See [README.md](README.md) for setup, commands, catalog workflows, and known warnings. This file defines conventions, architecture constraints, and required checks.

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

Use only model IDs and reasoning levels exposed by the runtime. Increase reasoning or change models when needed, and briefly explain the exception. When model overrides require `fork_turns="none"`, provide a self-contained brief with
the relevant files, constraints, and expected result. The primary agent owns integration and checks.

## Required skills

- For creating, editing, reviewing, or debugging `.svelte`, `.svelte.ts`, or `.svelte.js` files, always use `svelte-code-writer` and `svelte-core-bestpractices`.
- For Effect workflows, services, errors, or tests, use `.agents/skills/effect` alongside the installed-package guidance below.

## Landing page

[+page.svelte](src/routes/+page.svelte) is the tool directory. Keep it lightweight, dark, and mobile-first. On mobile, the header sits above the navigation and aligns right. At the wide breakpoint, it stays fixed in the bottom-left and aligns left, with navigation on the right.

The window owns scrolling as the link list grows; do not add a navigation scrolling container. Preserve the full-bleed warm glow, pointer or device-orientation movement, flicker, slow pulse, and reduced-motion behavior unless a redesign changes them. This page may override the global stable scrollbar gutter for edge-to-edge backgrounds.

## TypeScript

Avoid redundant context in file, component, and symbol names when the containing folder already supplies it. For example, use
`app/Header.svelte` and import it as `Header`, rather than `app/AppHeader.svelte`. Add a qualifier only when it distinguishes a meaningful role or resolves an actual ambiguity.

Infer types unless annotations clarify public APIs or complex values, improve readability, or prevent incorrect widening. Prefer one- or two-word type names unless longer is clearer; function names may be longer.

Use ternaries for simple choices. For more complex branching, prefer `if` / `else if` statements when they read more clearly, especially instead of nested ternaries.

Before adding a constants-only module, check [constants.ts](src/lib/constants.ts) and existing modules. Keep single-component constants local and shared constants in the module serving their consumers. Create a new module only for a distinct feature with enough related data or behavior. Update imports and remove obsolete modules when consolidating.

## Svelte

Use Svelte 5 runes and callback props.

Before UI-affecting refactors, capture the current working-tree behavior and screenshots, including uncommitted user changes. Preserve
copy, controls, and styling outside the requested scope; verify the same scenarios afterward. Restore regressions from that baseline,
not from memory or an older commit.

Use event shorthand when a local handler matches the attribute, including on `<svelte:window>` and `<svelte:document>`. Name handlers used by only one binding after that event. Keep explicit attributes for argument passing, event transformations, propagation control, or shared/imported handlers with meaningful names. Do not rename domain handlers to force shorthand. Move multiline inline handlers into `<script>`.

Use `$effect` only when external synchronization must rerun as reactive values change and cannot be expressed through declarative markup, derived values, or event handlers. Explain why reactive reruns are necessary in a preceding comment.

Use class arrays for conditional classes, such as `class={["item", active && "is-active"]}`. Avoid template strings and do not add `class:` directives.

## Browser support

Prefer native HTML, CSS, and Web APIs when they simplify code and preserve behavior. Before adopting a feature, verify support in current stable Chrome, Edge, Firefox, and Safari. Keep the existing implementation until all four support it; Chrome-only verification is insufficient. Recheck compatibility before adopting features such as dialog `closedby` or `scrollsnapchange`.

## Accessibility

Use semantic HTML; add ARIA only for names, descriptions, states, or relationships HTML cannot express. Prefer visible labels; use `aria-label` only without a suitable visible label and `aria-describedby` for supplemental information. Referenced IDs must be unique and present. Do not substitute `title` for an accessible name or description.

Hide non-focusable decorative icons and effects with `aria-hidden="true"`. Never hide focusable elements or their ancestors. Informative icons need a text equivalent.

## Styling

Keep interface copy to useful labels, instructions, and explanations. Avoid decorative eyebrow labels and filler.

Keep surrounding content stable during loading and feedback. Reserve space or use overlays; label changes must not resize controls.
Verify idle, pending, and completed states at narrow and wide widths.

Never use all-uppercase text in interface designs. Use sentence case for headings, labels, buttons, and navigation; do not apply `text-transform: uppercase` or manually capitalize entire words for visual emphasis.

Use component-scoped `<style>` blocks for layout, spacing, typography, and interaction. Keep UnoCSS for icons; do not add Tailwind-style layout utilities, Tailwind, `clsx`, `tailwind-merge`, or `cn`. Migrate existing utility-heavy components incrementally when touched.

### Selectors and markup

- Use top-level, unqualified tag selectors when an element is unique or all instances share styling. Svelte provides scope; avoid root wrappers or qualified tags solely for scoping.
- Use short purpose-based classes when instances differ, styles span tags, or a stable hook is clearer. Use at most two classes per element where possible: a role plus a state, variant, or icon. Do not replace useful classes with positional selectors.
- Keep selectors shallow and low-specificity, usually with at most two classes; avoid mirroring markup or nesting type selectors.
- Use native nesting for the same subject's pseudo-elements, states, and variants, such as `&:hover` or `&.accent-primary`. Prefer one nesting level; a second is acceptable for a closely related variant state. Do not flatten or nest mechanically.
- Use modern pseudo-classes such as `:is()` and `:where()` and logical properties such as `inline-size`, `block-size`, and `margin-inline`.

### Declarations and responsive layout

Prefer modern CSS and native features. Add workarounds or optimizations only for verified support or profiling needs.

Use multiples of `0.125rem` for all `rem` values, including tokens, inline styles, and CSS math functions. Gradient stops and shadow values are exempt. When adjusting values, preserve dependent sizing and visible gradient bands.

Every declaration must affect a supported layout or state. Avoid repeating inherited fonts/colors, preflight resets, or sizing/alignment supplied by normal block/grid layout. Do not add `position`, `z-index`, `overflow`, `isolation`, `contain`, `will-change`, or `pointer-events` defensively; each needs a specific purpose. Preserve companion declarations required for that behavior.

Remove obsolete declarations and tokens when touching a rule. Verify base and wide layouts, interaction, and reduced motion before removing apparently redundant styles.

Write mobile-first styles with shared mobile/tablet defaults and occasional `min-width` overrides. Prefer normal flow and fluid values (`clamp()`, `min()`, `max()`) to spacing/type breakpoints. Avoid `max-width` and viewport-height queries unless needed for usability. Group a small component's overrides for one breakpoint in a top-level media query; keep capability queries, including reduced motion, separate.

### Tokens and theme

[src/app.css](src/app.css) owns shared colors, type sizes, weights, line heights, borders, radii, and motion values; [uno.config.ts](uno.config.ts) exposes the theme to UnoCSS. Declare each custom property once. Put component-specific layout values and complex effects on that component's root selector.

Use `var(--token)` for theme colors and semantic color utilities in existing utility markup. Prefer role aliases (`--accent`, `--primary`, `--destructive`) when appropriate, otherwise named palette tokens (`--background`, `--panel`, `--card`, `--foreground`, `--muted-foreground`, and `--accent-blue/green/red/purple`). Add missing tokens to the theme before using them. Read palette values from the source files.

Name tokens by purpose, with broad-to-specific grouping such as `--layer-content`, `--size-icon`, or `--duration-pulse`. Use variables for reused/tunable values. A one-use token needs a meaningful concept, local override, or clearer representation of a complex value. Remove unused/duplicate tokens without merging unrelated concepts. Structural values (`0`, `100%`, `auto`, grid ratios, media thresholds) may stay literal.

Use alpha hex (`#RRGGBBAA`) for fixed translucent colors. Reserve `color-mix()` for token-derived colors or blends; specify an interpolation space such as `in oklch` only when blending distinct colors benefits. Omit it for one-color/transparent mixes and gradients. Open Props may guide naming/scales; add the dependency only if a substantial portion is needed.

For UI color choices and simplification:

- Prefer existing palette shades for solid fills, borders, and text over ad hoc mixes with black, white, or neutral surfaces. Match the color roles and interaction colors of equivalent controls.
- Shared palettes run from `0` (lightest) to `10` (darkest), with a 20% OKLCH lightness floor. Read each family's values from [app.css](src/app.css); matching shade numbers do not guarantee matching lightness. When inserting or renumbering shades, update every consumer and the palette lab while preserving existing colors.
- Keep entity colors identity-based. Use the existing `--identity-*` scale, where `--identity-5` is the original color. Generate shades `in oklch` with achromatic endpoints whose hue is `none`, and define the scale on the element owning `--identity` so inherited shades resolve correctly.
- Compare an alpha mix with the color rendered over its actual background, including any parent tint. Opacity percentages are not lightness percentages or shade numbers. Choose the closest usable shade by OKLab distance, checking text contrast and preserving visible hover, focus, selected, and disabled states.
- Retain transparency for gradients, shadows, glows, artwork overlays, and adaptive borders whose appearance depends on their backdrop. A shade replacement may approximate a flat surface; it cannot generally replace alpha over varying backgrounds.
- Share repeated fills, tints, and complex effects through purpose-based local tokens when they serve the same role. Keep unrelated roles and independently active status colors separate. Remove obsolete declarations rather than preserving unused styling.
- Verify that tokens resolve on every owner and variant, check combined status effects, and keep palette previews in sync with scale changes.

The reduced-motion query in [app.css](src/app.css) disables shared durations; do not repeat these resets in components. Keep component reduced-motion rules for transforms, custom animations, gesture feedback, and other behavior the shared durations do not cover.

### Icons

Use Material Symbols through UnoCSS, for example `class="search-icon i-material-symbols:search"`. The icon preset in [uno.config.ts](uno.config.ts) supplies `display: inline-block` and square dimensions from `--size-icon`, falling back to `1em`. Set `--size-icon` on the icon for a custom size instead of repeating display and dimension declarations. Use the shared `control-icon` and `external-icon` classes when their sizes fit. Keep local display overrides required by layout or visibility, and give icons an explicit text color on contrasting backgrounds. Follow the accessibility rules above.

Keep `--size-icon` overrides on icon elements so the value does not unintentionally reach nested icons. This convention applies to UnoCSS icons; `KdIcon` uses font sizing, and icon containers still need their own layout dimensions.

Safelist icon classes in [uno.config.ts](uno.config.ts) when extraction is unreliable. Verify production CSS if an icon works only in development.

## Scripts

Scripts must use local files and caches by default. Require `--fetch` for every network path, including retries and fallbacks.
Never download automatically for missing or stale caches; report missing data with instructions to rerun with `--fetch`.

## Catalog

[data.json](static/kdm/catalog/data.json) is the live app's source of truth. Data is grouped by category and item IDs are object keys; do not add `id` fields to items. Update [data.schema.json](static/kdm/catalog/data.schema.json) when the shape changes and regenerate types as described in [README.md](README.md#catalog).

Explicit editions require permanent readable lowercase kebab-case `id` values, unique within their item. Assign IDs once; retain them when facts change and never reuse retired IDs. Creation tooling in [identity.mts](scripts/catalog/identity.mts) rejects collisions for review. `label` is mutable display text, never collection identity. Items
without explicit editions use synthetic `item` IDs, or `bundle` for bundles. The product-only
[workbook-map.json](static/kdm/catalog/workbook-map.json) connects local workbook rows to these IDs; regenerate it with `pnpm catalog:workbook` from the
Git-ignored import records. Sheet and row numbers are locators for that workbook snapshot, not permanent IDs. Review changed row
identities and ambiguous release alternatives before import or export uses them. Do not put personal workbook cells in
the map.

[workbook.ts](src/lib/types/workbook.ts) owns workbook mapping and normalized-row schemas and types. Tooling and collection transfers share them.
Change that contract and run `pnpm generate:types` to refresh [workbook-map.schema.json](static/kdm/catalog/workbook-map.schema.json); do not edit the generated
editor schema by hand. Workbook publication guards its captured catalog, import records, schemas, and previous map before replacement.

Keep item fields alphabetical, edition fields starting with `id` then `label`, and inclusion-object fields starting with `item`; remaining fields are alphabetical. Use `orderItemFields`/[organizeCatalog](scripts/catalog/order.mts). Preserve category/item ordering and edition/other array ordering. Keep `includes` on parents: `editionId` resolves on the child item and `parentEditionIds` on the containing item. Derive reverse membership.

Product ownership is explicit; never infer it from included components, equivalences, or upgrade recipes. Inclusion lists may be partial
and support listed-content progress and bundle savings. Use `Collection.toggleEditionOwned` for product checkboxes,
`Collection.toggleIncludedOwned` for included-content controls, and `Collection.setEditionOwned` for explicit acquisitions.

`requires` lists dependencies beyond core and its contents; omit empty arrays. Keep campaign restrictions and partial or optional
requirements in notes, without repeating `requires`.

Keep catalog-derived helpers in [kdm-data.ts](src/lib/kdm-data.ts) or [catalog-view.ts](src/lib/catalog-view.ts), not duplicated in components. `CollectionBrowsing`
owns browsing and URL transitions; `CollectionCards` owns card collapse, deferred rendering, viewport observation, and held-card scroll
anchoring. The collection page disposes card resources on unmount and owns focus, gestures, and navigation.

Load the full catalog only through the collection route. The root layout initializes an empty catalog. Quick Start directly imports
generated [core-editions.json](src/lib/gen/core-editions.json), containing only playable core editions' IDs and labels in catalog order, excluding Resin;
`pnpm generate:types` refreshes it from the live catalog. Catalog helpers receive data explicitly. Switching to
the full catalog must preserve the owner's snapshot and pending writes. Disable collection-link hover data preloading and keep
the full catalog and collection HTML out of service-worker precaching; cache them after collection is visited.

### Catalog workflow and decisions

Read [the catalog guide](docs/kdm-catalog.md) for product-specific decisions and [catalog workflows](docs/catalog-workflows.md)
for commands, caches, retained local inputs, and reports.
Preserve direct owner edits and reviewed facts.

- Research cached news and `.cache/kdm-catalog/shopify-products/products-page-N.json` before requesting the shop.
  Prefer product `.js` JSON; its prices are cents, while paginated product prices are dollars. Space shop requests at least
  35 seconds apart. Local mappings, imports, and archives live in Git-ignored `local-data/kdm-catalog/`; reports remain in `temp/kdm-catalog/reports/`.
- Local `local-data/kdm-catalog/kdm-tags.json` supplies exact reviewed tags when present; sync it after direct tag edits.
  Catalog tags sort by global item frequency, highest first, with alphabetical ties. Master tag arrays stay alphabetical,
  and item key ordering matches the catalog. The tag schema validates vocabulary, not every item ID.
- `catalog:tags` stages changes; `catalog:tags --apply` applies them and syncs the master file. `catalog:update` stages
  broader changes and rejects stale reviews. `catalog:availability` owns stock and availability, using only
  `https://shop.kingdomdeath.com/products.json?limit=250&page=1` and `page=2`. By default it reads the saved
  `products-page-1.json` and `products-page-2.json`; `--fetch` retrieves exactly those two pages and refreshes their caches.
  Never use individual product responses, caches, or HEAD checks for stock or availability. Metadata imports preserve existing
  stock on unchanged listings; refresh availability after adding editions. Link checks write reports only. Preserve homebrew flags. `--offline` uses caches. Failed downloads or concurrent edits must not overwrite catalog data.

### Catalog data rules

- Matching models, busts, and painter's scale releases share an item with distinct editions; similar names alone are not
  sufficient to merge. Named boxed collections are sets. Models packaged with gameplay use `kind: "box"`;
  all-Beta items use `kind: "beta"`, and mixed Beta/non-Beta items use `kind: "box"`. Preserve reviewed kinds, including
  core, expansion, set, vignette, and armor-kit. Sculpt prototypes do not imply Beta gameplay.
- Gameplay defaults to false; store item `gameplay` only when true and edition overrides only when different.
  Beta belongs on editions as `beta: true`, without beta ID prefixes. Item badges aggregate all editions.
  Bundle gameplay respects included editions and their overrides.
- Edition prices are integer cents in `prices` arrays (recorded sales plus current MSRP, maximum is MSRP). Missing prices on products
  are unknown; `[0]` is a known zero price. Genuine non-sale components use `includedOnly: true` with no `prices` field.
  Reuse reviewed identical content through `includes` instead of creating another edition to suppress its price. Simple products may
  represent their own contents; keep distinct content editions for actual differences. Items whose editions are all included-only
  belong in included-only; mixed items stay in content.
- Exact release dates use edition `releaseDate`; windows use `releaseWindow`, quarters as `YYYY Qn`. Earlier documented releases
  take precedence over restock dates. Undated Encore without a window inherits First Run or Deathgrey.
  Future Box releases use `Preorder` and Plastic material; items with any future release retain `upcoming`.
- Use the schema's edition-label enum. Label changes preserve edition IDs; update label-based local mappings when needed.
  Do not automatically create an item for each miniature in a box; add child items only for separately cataloged products or reviewed
  included components. Master Dwelling Key dynamically grants all Sim editions.
- Content sorts core, expansions by release, then other items by ID. Homebrew puts CCG-tagged items first, sorting each group by ID.
  Other categories sort by ID. Editions sort Sim first,
  then release chronology. Keep aliases deduplicated without case/punctuation differences. Product notes are user-facing;
  maintenance assumptions belong in the catalog guide. Keep previously excluded products excluded.
- Shop links use `handle`: an item handle applies to all editions; otherwise each edition needs its own. External links
  retain `url`. Keep old handle mappings when replacing listings, using `replaceUrl: true` only on the new mapping.
  Handles identify listings; pricing and availability still require variant matching.
- Availability defaults to false and is omitted unless true. The `kings-coins` Prize edition (shop handle `kings-coin-prize`)
  is explicitly unavailable despite Shopify stock. Do not generalize that exception. Homebrew uses `3D Files` editions with `available: true`.
- Preserve reviewed monster role/family tags on models, expansions, and matching pinups; do not guess unconfirmed roles.
  Shirts and dice keep `monster-...` tags but omit `monster`. Tyrant retains both Dragon King and Tyrant family tags.

## Effect

Use Effect v4. Before changing Effect code, read all of `node_modules/effect/AGENTS.md` and relevant linked references. Inspect installed source and types for uncovered behavior. If guidance is unavailable, report it and consult version-matched official documentation; do not upgrade Effect to obtain guidance.

Use Effect `HttpClient` for new application HTTP requests and asset downloads, including small browser loaders. Use the installed
`effect/http` exports with `FetchHttpClient.layer`, validate JSON with Schema, and map transport, status, and decoding failures to
feature-owned errors. Inject HTTP services or `FetchHttpClient.Fetch` in tests instead of replacing global `fetch`. In SvelteKit load
functions, inject the provided `event.fetch` through `FetchHttpClient.Fetch` to preserve framework behavior.

Use feature-owned `Schema.TaggedError` classes and unions at action boundaries. Use named `Effect.fn` for significant effectful operations, preserving deferred execution and instance binding. Keep pure helpers and UI callbacks ordinary functions. Library guidance does not override the state, persistence, and UI boundaries below.

Implement asynchronous application storage and lifecycle workflows in Effect, including settings resets, database deletion,
session shutdown, and reload sequencing. Keep Promise and callback APIs inside adapters using `Effect.tryPromise` or
`Effect.callback`, with feature-owned typed errors and callback cleanup. UI handlers compose and run Effects through the
existing action boundary; do not orchestrate these workflows with `async`/`await`, `Promise.all`, or local `try`/`catch`.
Before finishing, review new asynchronous paths for this boundary and test deferred execution, failure, and interruption
where they affect persistence or resource cleanup.

At action boundaries, inspect the full cause before extracting typed errors. Any interruption remains interrupted and produces no failure notification, including mixed causes. Log the full cause for defects. Keep simple operations direct; generators should express sequencing.

## State and persistence

For implemented collection behavior, read [docs/kdm-architecture.md](docs/kdm-architecture.md). For campaign, settlement, survivor, gameplay undo/redo, preferences, and synchronization proposals, read [docs/kdm-campaign-design.md](docs/kdm-campaign-design.md); those services are not implemented.

Preserve these collection boundaries unless the task explicitly changes them:

```text
Collection -> OptimisticStore -> DexieStore (CollectionStore)
```

- The root layout provides one `Collection` per app instance through Svelte context; it owns collection commands. [CollectionStore](src/lib/kdm/collection/state/collection-store.ts) is the persistence interface implemented by [DexieStore](src/lib/kdm/collection/state/dexie-store.ts); data types live in `src/lib/types`.
- `DexieStore` reads and writes complete snapshots scoped to one owner in IndexedDB. It applies changed rows and removals with the revision check and update in one transaction. The `ownerId` index serves snapshot reads; entry primary keys serve writes. Load Dexie only inside browser initialization. Metadata schema version 1 validates the stored shape and is not a migration. Keep storage details out of `Collection`.
- `CollectionStore.changes` optionally reports stale snapshots. `DexieStore` uses metadata `liveQuery` subscriptions with Effect finalizers. `Collection.observeChanges()` blocks edits and offers explicit refresh without replacing optimistic state. Observations never advance the expected write revision; local saves must not report themselves as stale.
- Observer failures set a load error and block edits while preserving the snapshot. The layout forwards `Collection.canObserve` to `CollectionSession`, which owns startup, scoped monitoring, and teardown. Keep healthy monitoring active during refresh and restart failed monitoring only after a successful retry. Interrupt the subscription before closing Dexie. A storage-module download failure has no store to retry; offer a page reload.
- Store `owned`, `wished`, component `missing` overrides, and `copyNumber` under stable content and edition IDs. Copy numbers are integers 0 through 9999, independent of known run size. Keep product ownership separate from derived coverage; omit false defaults and delete empty edited entries. See [ownership rules](docs/kdm-architecture.md#product-ownership-and-content-coverage).
- `OptimisticStore` holds confirmed state plus pending field patches, serializes persistence, and removes failed patches without overwriting newer edits. Only persistence waits in the queue. Batch related updates in one `saveMany()` transaction.
- Backups validate before replacing a snapshot; workbook imports validate normalized row identities and merge provided fields in one queued save. Exports wait for queued writes and use confirmed data. Keep XLSX controls deferred.
- Guard asynchronous results and failures against owner/store changes, including backup and workbook validation and export. Superseded operations interrupt before updating the next owner's state or reaching notifications.
- Run UI Effects through `collectionActions.run()`, for example `collectionActions.run(collection.setManyOwned(ids, true))`. This module owns no reactive state. Loading errors belong to `Collection.loadError` alongside `loadStatus`, and clear on retry or user changes.
- `Notifications` currently uses injected Effect logging; visible toasts are planned. Initialize with `{ success: false }` to avoid startup save announcements.
- Reusable dialogs use ordinary callbacks and close immediately on confirmation. They own focus, dismissal, and closing-animation guards; the parent owns persistence/workflows. Quick Start assumes core ownership and navigates independently of saving, even on failure.

Client-facing tests live in `test/client/`, using Vitest 5 and the version-aligned `@effect/vitest` adapter. Build and catalog script tests live
in `test/scripts/` and import tooling through `#scripts/*`. Prefer `it.effect`, injected services, `Deferred`, and `TestClock`.
Preserve existing regression coverage when refactoring.

## PWA and service worker

Use SvelteKit 3 APIs:

- `immutable`, `assets`, `prerendered` from `$app/manifest`
- `version` from `$app/env`
- `resolve` from `$app/paths`
- `self` from `$app/service-worker`

Do not use the removed `$service-worker` module. Precache assets individually so one missing asset does not reject installation. The service worker caches the app shell/assets; `DexieStore` owns collection persistence.

## Required checks

Run from the project root. Preserve unrelated changes; never reset or overwrite the working tree wholesale.

1. Run `pnpm check` before finishing.
2. Run `pnpm format:check` or format touched files with project Prettier (140-character width and Svelte plugin).
3. Run `pnpm test:run` after Effect workflow or persistence changes (`pnpm test` is watch mode).
4. Run `pnpm catalog:validate` for catalog edits and `pnpm test:catalog` for catalog script changes.
5. Run `pnpm build` for build, service-worker, UnoCSS, or routing changes. After UnoCSS/SvelteKit dependency or integration changes, verify pages link to an existing global stylesheet, safelisted icons have CSS rules, and generated HTML has no `%unocss-svelte-scoped.global%` placeholders.

Only the [documented warnings](README.md#known-warnings) are safe to ignore. Preserve UnoCSS integration and `corner-shape`; investigate other warnings.
