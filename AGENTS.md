# KDM Collection Tracker

## Project overview

This is a SvelteKit 3 application using Svelte 5 runes, UnoCSS, Material Symbols, and InstantDB. The catalog is data-driven and the collection state supports local guest persistence plus authenticated cloud persistence.

## Required skills

- For creating, editing, reviewing, or debugging `.svelte`, `.svelte.ts`, or `.svelte.js` files, always use `svelte-code-writer` and `svelte-core-bestpractices`.
- For InstantDB initialization, auth, queries, transactions, schema, permissions, or persistence adapters, always use `instantdb`.
- When a change involves both Svelte and InstantDB, use all applicable skills.

## Commands

Run these from the project root:

```bash
pnpm dev
pnpm check
pnpm build
pnpm format
pnpm format:check
```

Always run `pnpm check` after TypeScript or Svelte changes. The project may emit known UnoCSS Vite warnings during builds; do not change the UnoCSS/Vite integration without confirming that generated production CSS is still complete.

## Svelte conventions

Use Svelte 5 runes and callback props.

Prefer event shorthand when a component has a single named handler. If an inline handler is more than one line, move it into the `<script>` block.

```svelte
<button {onclick} />
```

Keep parameterized handlers explicit when they need an item value, event transformation, or propagation control:

```svelte
onclick={(event) => selectVersion(event, version.v)}
```

Avoid `$effect` when a derived value or direct event handler is sufficient. Effects are reserved for external synchronization, such as guest authentication or synchronizing InstantDB query results with the state store. Add a comment above every required effect explaining why it cannot be replaced.

Prefer Svelte class arrays for conditional classes:

```svelte
<div class={["base-class", active && "text-accent"]}></div>
```

Do not use template strings for class attributes, `class:` directives for new code, or utility helpers such as `cn`.

```svelte
<!-- Avoid --><div class={`rounded-lg ${active ? "bg-accent" : "bg-panel"}`}></div><div class:active></div>
```

## Styling and icons

Use UnoCSS utilities from `@unocss/preset-wind4`. Do not add Tailwind, `clsx`, `tailwind-merge`, or `cn` utilities.

Use Material Symbols through UnoCSS icon classes:

```svelte
<span class="i-material-symbols:search inline-block size-4" aria-hidden="true"></span>
```

For inline icons, use `inline-block` when width and height need to apply. Give icons an explicit text color when they sit on a contrasting background.

Use the UnoCSS safelist in `uno.config.ts` for utilities that must be present in production but cannot reliably be extracted. Verify generated production CSS if a utility appears to work only in development.

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

`ContentState` owns collection commands. `ContentStateStore`, `LocalGuestStore`, and `InstantStore` are defined in `src/lib/state/stores.ts`; collection-state data types are defined in `src/lib/state/types.ts`.

```text
ContentState -> ContentStateStore -> LocalGuestStore or InstantStore
```

Keep `ContentState` backend-agnostic. Do not import InstantDB types into the shared store interface or command logic. Instant-specific entity decoding, UUID handling, and transactions belong in `InstantStore`.

Guests use `LocalGuestStore`; authenticated users use `InstantStore`. When a guest becomes a full user, migrate local state before clearing the guest store.

State commands should update optimistically and restore the previous state if persistence fails. Batch related updates with one transaction through `saveMany()`.

```ts
// Do
await store.saveMany(nextStates);

// Avoid
await Promise.all(ids.map((id) => store.save(id, nextStates[id])));
```

Do not write guest state to InstantDB when the app is intentionally using local-only guest persistence. InstantDB permissions cannot redirect rejected writes into local IndexedDB.

## InstantDB

Keep schema and permissions in `src/instant.schema.ts` and `src/instant.perms.ts`. Push changes with the authenticated Instant CLI when the schema changes:

```bash
pnpm dlx instant-cli push schema --yes
pnpm dlx instant-cli push perms --yes
```

Instant entity IDs must be UUIDs. Never construct IDs from strings such as `userId:itemId`.

```ts
// Do
const entityId = crypto.randomUUID();

// Avoid
const entityId = `${userId}:${itemId}`;
```

## PWA and service worker

The service worker uses SvelteKit 3 APIs:

- `immutable`, `assets`, and `prerendered` from `$app/manifest`
- `version` from `$app/env`
- `resolve` from `$app/paths`

Do not use the removed `$service-worker` module. Precache assets individually so one unavailable asset does not reject the entire service-worker install.

The service worker is for app-shell and asset caching. Do not use it to proxy InstantDB state or replace the storage adapters. InstantDB and the local store own persistence and synchronization.

## Formatting

Prettier is configured with a 140-character print width and the Svelte plugin. Use the project formatter instead of manual formatting. Keep imports, object literals, and long expressions readable at the configured width.

## Before finishing a change

1. Run `pnpm check`.
2. Run `pnpm format:check` or format the touched files.
3. Run `pnpm build` for build, service-worker, UnoCSS, or routing changes.
4. Preserve unrelated user changes and do not reset or overwrite the working tree wholesale.
