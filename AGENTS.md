# Guidepost

## Project overview

Guidepost is a personal hub for board game companion tools. It is a SvelteKit 3 application using Svelte 5 runes, UnoCSS, and Material Symbols.

Kingdom Death: Monster is currently the largest set of tools. Its catalog is data-driven, and collection state is stored locally in the browser. Guidepost may also link to tools and resources for other board games.

## Landing page

`src/routes/+page.svelte` is the Guidepost landing page and tool directory.

Keep it lightweight, dark, and mobile-first. On mobile, the Guidepost header appears above the navigation and aligns right. At the wider layout breakpoint, it stays fixed in the bottom-left and aligns left while the navigation remains on the right.

The window owns page scrolling as the link list grows. Do not create a separate scrolling container for the navigation.

Preserve the full-bleed warm glow, subtle pointer or device-orientation movement, occasional flicker, slow pulse, and reduced-motion behavior unless a redesign explicitly changes them. The landing page may override the global stable scrollbar gutter so its background reaches the viewport edges.

## Required skills

- For creating, editing, reviewing, or debugging `.svelte`, `.svelte.ts`, or `.svelte.js` files, always use `svelte-code-writer` and `svelte-core-bestpractices`.

## Commands

Run these from the project root:

```bash
pnpm dev
pnpm check
pnpm build
pnpm format
pnpm format:check
```

Always run `pnpm check` after TypeScript or Svelte changes. Ignore the following expected warning when running `pnpm dev` or `pnpm check`; it does not indicate a failed command:

```text
The following plugins may not work correctly because they use the `transformIndexHtml` hook which is not supported:
  - unocss:transformers:pre
  - unocss:transformers:default
  - unocss:transformers:post
```

The project may also emit known UnoCSS Vite warnings during builds. Do not change the UnoCSS/Vite integration without confirming that generated production CSS is still complete.

## TypeScript

Prefer inferred TypeScript types when the compiler can determine them clearly. Add explicit annotations for public APIs, complex values, or cases where they improve readability or prevent an incorrect widening; do not add redundant annotations solely to restate an inferred type.

## Svelte conventions

Use Svelte 5 runes and callback props.

Use event attribute shorthand whenever a local handler's name matches the attribute. Apply this to each binding independently, including bindings on Svelte special elements such as `<svelte:window>` and `<svelte:document>`. When a handler serves only one event binding, prefer naming it after the event attribute.

```svelte
<script lang="ts">
  function onclick() {
    // ...
  }

  function onpointermove(event: PointerEvent) {
    // ...
  }
</script>

<svelte:window {onpointermove} />
<button {onclick}>Save</button>
```

Keep the attribute explicit when passing arguments, transforming the event, controlling propagation, or using a shared or imported handler whose descriptive name is clearer. Do not rename shared or domain-specific handlers solely to force shorthand. Move an inline handler into the `<script>` block when it is more than one line.

```svelte
<button onclick={(event) => selectVersion(event, version.v)}>Select</button>
<button onclick={saveCampaign}>Save</button>
```

Avoid `$effect` when a derived value or direct event handler is sufficient. Effects are reserved for external synchronization that cannot happen directly in an event handler. Add a comment above every required effect explaining why it cannot be replaced.

Prefer Svelte class arrays for conditional classes over template strings:

```svelte
<div class={["base-class", active && "text-accent"]}></div>
```

Do not use `class:` directives for new code.

```svelte
<!-- Avoid --><div class={`rounded-lg ${active ? "bg-accent" : "bg-panel"}`}></div><div class:active></div>
```

## Styling and icons

Use UnoCSS utilities from `@unocss/preset-wind4`. Do not add Tailwind, `clsx`, `tailwind-merge`, or `cn` utilities.

Write responsive styles mobile-first. Let mobile and tablet layouts share base styles, then add an occasional min-width override when a wider layout needs one. Treat UnoCSS prefixes such as `sm:`, `md:`, and `lg:` as media queries and use them with the same restraint. Do not add prefixes for small spacing or type changes that can share a base value or use fluid sizing. Prefer normal flow and values such as `clamp()`, `min()`, and `max()` before adding a breakpoint. Avoid max-width and viewport-height queries unless the layout cannot stay usable without one. Accessibility and capability queries such as `prefers-reduced-motion` are not layout breakpoints and should remain when needed.

Use Material Symbols through UnoCSS icon classes:

```svelte
<span class="i-material-symbols:search inline-block size-4" aria-hidden="true"></span>
```

For inline icons, use `inline-block` when width and height need to apply. Give icons an explicit text color when they sit on a contrasting background.

Use the UnoCSS safelist in `uno.config.ts` for utilities that must be present in production but cannot reliably be extracted. Verify generated production CSS if a utility appears to work only in development.

## Theme

Global theme tokens are defined in `src/app.css` and exposed to UnoCSS through `uno.config.ts`. Treat those files as the source of truth. Keep each custom property declared once.

Use semantic UnoCSS color utilities or `var(--token)` instead of hardcoding theme colors in components.

The core palette is:

- `--background`: `#151515`
- `--panel`: `#1e1e1e`
- `--card`: `#2b2b2b`
- `--foreground`: `#fdfffe`
- `--muted-foreground`: `#a29c9a`
- `--accent-blue`: `#11b2e1`
- `--accent-green`: `#4ae111`
- `--accent-red`: `#e14011`
- `--accent-purple`: `#a811e1`

Prefer semantic aliases such as `--accent`, `--primary`, and `--destructive` when the color communicates a role. Use the named palette variables when no semantic token fits. If a listed token is missing from `src/app.css` or `uno.config.ts`, add it to the theme before using it instead of hardcoding its value in a component.

## Catalog data

The source of truth is `src/lib/kdm-data.json`. Data is grouped by category and IDs are object keys:

```json
{
  "content": {
    "core": {
      "name": "Kingdom Death: Monster"
    }
  }
}
```

Do not add `id` fields back into catalog objects. Update `src/lib/schema.json` when the JSON shape changes. Keep catalog-derived helpers in `src/lib/kdm-data.ts` or `src/lib/catalog-view.ts`, rather than duplicating lookup logic in components.

## State and persistence

`ContentState` owns collection commands. `ContentStateStore` and `LocalGuestStore` are defined in `src/lib/state/stores.ts`; collection-state data types are defined in `src/lib/types`.

```text
ContentState -> ContentStateStore -> LocalGuestStore
```

`LocalGuestStore` persists collection state to `localStorage`. Keep browser-storage details out of `ContentState` so collection commands remain separate from persistence.

State commands should update optimistically and restore the previous state if persistence fails. Batch related updates with one transaction through `saveMany()`.

```ts
// Do
await store.saveMany(nextStates);

// Avoid
await Promise.all(ids.map((id) => store.save(id, nextStates[id])));
```

## PWA and service worker

The service worker uses SvelteKit 3 APIs:

- `immutable`, `assets`, and `prerendered` from `$app/manifest`
- `version` from `$app/env`
- `resolve` from `$app/paths`
- `self` from `$app/service-worker`

Do not use the removed `$service-worker` module. Precache assets individually so one unavailable asset does not reject the entire service-worker install.

The service worker is for app-shell and asset caching. Do not use it as a collection-state persistence layer; `LocalGuestStore` owns that responsibility.

## Formatting

Prettier is configured with a 140-character print width and the Svelte plugin. Use the project formatter instead of manual formatting. Keep imports, object literals, and long expressions readable at the configured width.

## Before finishing a change

1. Run `pnpm check`.
2. Run `pnpm format:check` or format the touched files.
3. Run `pnpm build` for build, service-worker, UnoCSS, or routing changes.
4. Preserve unrelated user changes and do not reset or overwrite the working tree wholesale.
