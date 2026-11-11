# Guidepost

A personal hub for board game companion tools. Currently focused on Kingdom Death: Monster, with a collection tracker, hunt event cards, and a first-story showdown aid.

[Open Guidepost](https://guidepost.gg/) | [Using the tools](docs/using-guidepost.md) | [Report a bug or suggest a feature](https://github.com/nick1n/guidepost/issues)

## What's here

- **Collection:** search the catalog, compare editions, record what you own or want, and see which contents your products provide. Import and export collection workbooks in your browser.
- **Hunt:** draw event cards, choose artwork, and share a link to a particular card.
- **Showdown:** a first-story showdown aid for the table.

Your collection saves on this device. Visit the collection while online before using its cached catalog offline. Campaign management and account sync are [planned](docs/kdm-campaign-design.md), not available yet.

Built with SvelteKit 3, Svelte 5, TypeScript, Effect, and Dexie. Styles live with components; UnoCSS supplies icons.

## Run locally

Use Node.js 26, matching [CI](.github/workflows/build-site.yml), and pnpm 12. The exact pnpm version is pinned in [package.json](package.json).

```bash
git clone https://github.com/nick1n/guidepost.git
cd guidepost
pnpm install
pnpm dev
```

Open the local URL printed by Vite. On Windows, if pnpm is missing, install it with `npm.cmd install --global pnpm@12`.

## Development

| Command             | Purpose                            |
| ------------------- | ---------------------------------- |
| `pnpm check`        | Check Svelte and TypeScript        |
| `pnpm test:run`     | Run Vitest tests once              |
| `pnpm build`        | Build the static site              |
| `pnpm preview`      | Serve the production build locally |
| `pnpm format:check` | Check formatting                   |

Read [AGENTS.md](AGENTS.md) before contributing. The [development guide](docs/development.md) covers the project layout, browser tests, deployment, and other commands.

## Catalog

The app reads [data.json](static/kdm/catalog/data.json). Catalog maintenance uses saved evidence by default; downloading requires `--fetch`.

Start with the [catalog workflows](docs/catalog-workflows.md) for updates, tags, availability, workbook mappings, and generated files.
The [catalog guide](docs/kdm-catalog.md) records product rules and reviewed decisions. For an assisted store review, use the [catalog update skill](.agents/skills/kdm-catalog-update/SKILL.md).

## Documentation

| Guide                                            | What you'll find                                             |
| ------------------------------------------------ | ------------------------------------------------------------ |
| [Using Guidepost](docs/using-guidepost.md)       | Collection links, totals currency, workbooks, and hunt links |
| [Development](docs/development.md)               | Commands, tests, deployment, and source layout               |
| [Glossary](GLOSSARY.md)                          | Product, edition, ownership, coverage, and campaign terms    |
| [Architecture](docs/kdm-architecture.md)         | Implemented state, storage, and app boundaries               |
| [UI conventions](docs/ui-conventions.md)         | Styling, accessibility, tokens, and interaction constraints  |
| [Effect conventions](docs/effect-conventions.md) | Async workflows, HTTP, errors, and action boundaries         |
| [Campaign design](docs/kdm-campaign-design.md)   | Proposed campaign history and synchronization                |
| [Design notes](docs/kdm-design-notes.md)         | Gameplay notes and ideas still under consideration           |

## Known warnings

Keep the `@unocss/svelte-scoped` patch until upstream fixes source maps, SvelteKit hook registration, and streamed HTML checks.
After integration upgrades, verify stylesheet links, safelisted icons, and absence of `%unocss-svelte-scoped.global%` in generated HTML.

The CSS validator may report `Unknown property: 'corner-shape'` in [AttackProfile.svelte](src/lib/kdm/showdown/ui/AttackProfile.svelte).
Supporting browsers use `corner-shape: squircle`; others keep the `border-radius` fallback. Investigate other warnings separately.

## License and credits

Original Guidepost source code is licensed under [AGPL-3.0-only](LICENSE). Third-party materials retain their owners' rights and licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Guidepost is an unofficial fan project, unaffiliated with Adam Poots Games or other referenced publishers, and is not endorsed or sponsored by them.
