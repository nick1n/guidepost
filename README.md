# Guidepost

Guidepost is a personal hub for board game companion tools.

## Catalog types

Run `pnpm check:shop-links` to check catalog URLs with HEAD requests and update `shopReachable` on each item in
`src/lib/kdm-data.json`. Relative URLs use `https://shop.kingdomdeath.com`. The script follows redirects, checks duplicate URLs once,
and times out each request after 10 seconds. It never falls back to GET.

Results are `true` for a final HTTP 2xx response, `false` for HTTP errors or failed requests, and `null` for items without URLs.
The field is absent until checked. A failed check can reflect rate limiting, a temporary network failure, or a site rejecting HEAD;
the result does not indicate whether a product is in stock. Each run overwrites previous results and logs response statuses or errors.

`src/lib/schema.json` defines the catalog shape. `pnpm generate:types` uses `json-schema-to-typescript` to generate
`src/lib/types/gen/kdm-data.d.ts`. Edit the schema, then regenerate the types; do not edit generated files by hand.

`pnpm dev`, `pnpm build`, and `pnpm check` regenerate the types before starting. The dev server also regenerates them whenever the schema
changes. Generation writes only when the output changes; invalid schemas report an error in the terminal and preserve the last valid types.
The app's types in `src/lib/types/index.ts` extend the generated types with catalog IDs.

## Known UnoCSS warning

Development, checks, and builds may print:

```text
The following plugins may not work correctly because they use the `transformIndexHtml` hook which is not supported:
  - unocss:svelte-scoped:global-styles
```

This warning is safe to ignore with the current integration. SvelteKit detects the declared hook, but UnoCSS skips it for SvelteKit and
uses `transform` and `renderChunk` to include global styles instead. See the
[UnoCSS implementation](https://github.com/unocss/unocss/blob/main/packages-integrations/svelte-scoped/src/_vite/globalStylesPlugin.ts).

The production build has been verified to link the global stylesheet and include all safe listed icons. Keep the integration as-is;
after UnoCSS/SvelteKit upgrades or integration changes, rebuild and recheck those outputs and confirm no `%unocss-svelte-scoped.global%`
placeholders remain in generated HTML. Other warnings need their own investigation.

## License

Original Guidepost source code is licensed under the [GNU Affero General Public License v3.0 only](LICENSE).

That license does not cover third-party names, trademarks, game content, artwork, icons, or other material identified in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Those materials remain subject to their owners' rights and applicable licenses.

The application links to its public source repository from the landing page.

Guidepost is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Adam Poots Games or any other publisher referenced by the project.
