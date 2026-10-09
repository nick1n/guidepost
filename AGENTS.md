# Guidepost

See [README.md](README.md) for the project overview, setup, commands, catalog workflows, and known warnings. This file defines coding conventions, architecture constraints, and required checks.

## AI output style

Never use em dashes or centered dots in user-facing output. Use commas, colons, semicolons, parentheses, bullets, or separate sentences.

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

Keep catalog-derived helpers in `src/lib/kdm-data.ts` or `src/lib/catalog-view.ts`, not duplicated in components.

## Effect

This project uses Effect v4. Before changing Effect code, read `node_modules/effect/AGENTS.md` completely and follow relevant linked references. For uncovered APIs/behavior, inspect the installed source and types. Prefer version-matched guidance over examples from other releases. If unavailable, report it and consult official documentation matching the installed version; do not upgrade Effect just to obtain guidance.

Use feature-owned `Schema.TaggedError` classes and unions at action boundaries. Use named `Effect.fn` for significant effectful operations, preserving deferred execution and instance binding. Keep pure helpers and UI callbacks ordinary functions. Preserve interruption when handling broad causes; cancellation must not produce failure notifications. Library guidance does not override the state, persistence, and UI boundaries below.

## State and persistence

For campaign, settlement, survivor, gameplay undo/redo, preferences, or Dexie synchronization work, read [docs/kdm-architecture.md](docs/kdm-architecture.md). It proposes one owner and settlement per campaign, many survivors, memberships, and shared showdown/settlement/hunt history. It has explicit implementation gaps; do not treat proposed campaign services as existing code.

Preserve these collection boundaries unless the task explicitly changes them:

```text
ContentState -> OptimisticStore -> GuestStore -> BrowserStorage
```

- `ContentState` owns collection commands. `CollectionStore` is the persistence interface implemented by `GuestStore`, not another runtime layer. Both stores are defined in `src/lib/state/stores.ts`; data types live in `src/lib/types`.
- `GuestStore` reads/writes complete snapshots without a second cache. Only `BrowserStorage` in `src/lib/state/browser-storage.ts` accesses `localStorage` and translates failures to `StorageError`. Provide `BrowserStorage.layer` to `GuestStore.make()`; keep storage details out of `ContentState`.
- `OptimisticStore` holds confirmed state plus pending field patches, serializes persistence, and removes failed patches without overwriting newer edits. Only persistence waits in the queue. Batch related updates in one `saveMany()` transaction.
- Run UI Effects through `collectionActions.run()`, for example `collectionActions.run(collection.setManyOwned(ids, true))`. This ordinary TypeScript module owns no reactive state. Loading errors belong to `ContentState.loadError` alongside `loadStatus`, and clear on retry or user changes.
- `Notifications` currently logs outcomes to the console; visible toasts are planned. Initialize with `{ success: false }` to avoid startup save announcements.
- Reusable dialogs use ordinary callbacks and close immediately on confirmation. They own focus, dismissal, and closing-animation guards; the parent owns persistence/workflows. Quick Start assumes core ownership and navigates independently of saving, even on failure.

Tests live in `test/`, using Vitest 5 and the version-aligned `@effect/vitest` adapter. Prefer `it.effect`, injected services, `Deferred` synchronization, and `TestClock`. Preserve optimistic-update, rollback, interruption, and finalization coverage when refactoring the queue.

## PWA and service worker

Use SvelteKit 3 APIs:

- `immutable`, `assets`, `prerendered` from `$app/manifest`
- `version` from `$app/env`
- `resolve` from `$app/paths`
- `self` from `$app/service-worker`

Do not use the removed `$service-worker` module. Precache assets individually so one missing asset does not reject installation. The service worker caches the app shell/assets; `GuestStore` owns collection persistence.

## Required checks

Run commands from the project root. Preserve unrelated user changes; do not reset or overwrite the working tree wholesale.

1. Run `pnpm check` before finishing.
2. Run `pnpm format:check` or format touched files with project Prettier (140-character width and Svelte plugin).
3. Run `pnpm test:run` after Effect workflow or persistence changes (`pnpm test` is watch mode).
4. Run `pnpm build` for build, service-worker, UnoCSS, or routing changes. After UnoCSS/SvelteKit dependency or integration changes, verify pages link to an existing global stylesheet, safelisted icons have CSS rules, and generated HTML has no `%unocss-svelte-scoped.global%` placeholders.

The [documented warnings](README.md#known-warnings) are safe to ignore. Preserve the UnoCSS integration and `corner-shape` enhancement rather than changing them solely to silence those warnings. Investigate other warnings separately.
