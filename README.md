# Guidepost

Guidepost is a personal hub for board game companion tools, built with SvelteKit 3, Svelte 5, and UnoCSS.
Kingdom Death: Monster is its largest toolset, with a data-driven catalog and collection tracking stored locally in the browser.

## Getting started

```bash
pnpm install
pnpm dev
```

Common development commands:

| Command             | Purpose                     |
| ------------------- | --------------------------- |
| `pnpm check`        | Check Svelte and TypeScript |
| `pnpm test:run`     | Run tests once              |
| `pnpm build`        | Build for production        |
| `pnpm format`       | Format the project          |
| `pnpm format:check` | Check formatting            |

See [AGENTS.md](AGENTS.md) for project conventions and the [local-first KDM architecture](docs/kdm-architecture.md) for
planned campaigns, gameplay history, and offline synchronization. The architecture distinguishes current collection persistence
from proposed campaign services.

## Catalog

The live app reads [src/lib/kdm-data.json](src/lib/kdm-data.json). Its [schema](src/lib/kdm-data.schema.json) generates
`src/lib/types/gen/kdm-data.d.ts`. Edit the schema, then run `pnpm generate:types`; do not edit generated types by hand.
Development, builds, and checks regenerate types automatically. The dev server also watches schema changes.

### Shop links

Run `pnpm check:shop-links` to update each item's `shopReachable` field using HEAD requests:

- `true`: final HTTP 2xx response.
- `false`: HTTP error or failed request.
- `null`: no URL. The field is absent until checked.

Each run overwrites earlier results. Requests follow redirects, time out after 10 seconds, and never fall back to GET.
Failures can reflect rate limits or HEAD rejection; reachability does not indicate stock availability.

### Review catalog

The [merged review catalog](exports/kdm-catalog/README.md) is maintained separately from the live app. To prepare and apply an update:

```bash
pnpm scrape:news
pnpm catalog:update --sim
# Review the staged changes before applying.
pnpm catalog:update --apply-review temp/kdm-catalog/reports/kdm-update-review.json
pnpm catalog:validate
```

Unknown or ambiguous products need reviewed mappings and tags. Applying a review rejects stale inputs and validates schemas and references.
Shop responses are cached for 24 hours, with requests at least 35 seconds apart. Use `--offline` for cached responses or `--refresh` to fetch again.

The [catalog guide](exports/kdm-catalog/README.md) covers tag editing, mappings, data rules, and migration requirements before app adoption.

## Known warnings

### UnoCSS

Development, checks, and builds may warn that `unocss:svelte-scoped:global-styles` uses the unsupported `transformIndexHtml` hook.
This is safe to ignore with the current integration: UnoCSS uses `transform` and `renderChunk` for SvelteKit instead.

After UnoCSS/SvelteKit upgrades or integration changes, rebuild and verify the global stylesheet, safelisted icons, and absence of
`%unocss-svelte-scoped.global%` placeholders in generated HTML.

### CSS corner shape

`pnpm check` may report `Unknown property: 'corner-shape'` in `AttackProfile.svelte`. The current CSS validator does not recognize
the property. It is safe to keep: [`corner-shape: squircle`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/corner-shape)
adjusts the rounded corners in supporting browsers; other browsers ignore it and use the existing `border-radius`.

Investigate other warnings separately.

## License

Original Guidepost source code is licensed under [AGPL-3.0-only](LICENSE). Third-party names, trademarks, game content, artwork,
icons, and other materials retain their owners' rights and applicable licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Guidepost is an unofficial fan project, unaffiliated with Adam Poots Games or other referenced publishers, and is not endorsed or sponsored by them.
