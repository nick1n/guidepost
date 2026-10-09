The live catalog combines the previous app catalog, collection workbook, and cached news. Its data and schema live in `static/kdm-catalog/`, and the collection page at `/collection/` uses its generated types. The previous catalog and schema are archived locally in `temp/kdm-data.json` and `temp/kdm-data.schema.json`.

| File                                                                                                                    | Purpose                                     |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [Catalog](../../static/kdm-catalog/data.json), [schema](../../static/kdm-catalog/data.schema.json)                      | Product facts and relationships             |
| [Workbook map](../../static/kdm-catalog/workbook-map.json), [schema](../../static/kdm-catalog/workbook-map.schema.json) | Source rows and catalog edition IDs         |
| [News export](../kingdom-death-news/news-shop-links.json)                                                               | Cached announcement dates and product links |

The Git-ignored `temp/kdm-catalog/kdm-tags.json` and `temp/kdm-catalog/kdm-tags.schema.json` files are optional personal review tools. Apply your edits with `pnpm catalog:tags --apply` before deleting both files. Without the local assignments, updates and validation use the tags saved in `data.json`. Edit local tags in `temp/kdm-catalog/kdm-tags.json`. Allowed values live in `temp/kdm-catalog/kdm-tags.schema.json` under `$defs.tag.enum`. VS Code provides tag-value completions and flags misspellings, empty arrays, and duplicates. The schema accepts any item key; merging checks missing and unknown IDs. While local assignments are present, stored catalog tags come exactly from that file, ordering catalog tags by popularity across all catalog items, with alphabetical ties. The master tag file keeps each item?s tags alphabetical.

```bash
pnpm catalog:tags
pnpm catalog:tags --apply
pnpm catalog:validate
```

The first command prepares a review with catalog tags ordered by popularity; the second applies that order and writes alphabetical tag lists to the local master tag file before writing the catalog. Tag-only commands make no shop requests. `pnpm catalog:tags-schema` refreshes the schema structure while preserving the vocabulary and custom tag definitions. Catalog additions do not require per-ID schema regeneration.

For news updates:

```bash
pnpm scrape:news
pnpm catalog:update --sim
pnpm catalog:update --apply-review temp/kdm-catalog/reports/kdm-update-review.json
pnpm catalog:validate
```

Reports and archives stay local in the Git-ignored `temp/kdm-catalog/reports/` folder. The updater creates a new merge report when none exists. Updates stage a review by default. Unknown products require curated mappings and reviewed tags. Use `--date YYYY-MM-DD` for another cached article, `--offline` for cached shop evidence, and `--refresh` to refresh shop responses. Shop requests start at least 35 seconds apart, reuse responses for 24 hours, and have no automatic retries. A 404/410 preserves existing facts; other failures stop preparation. Applying a stale review is rejected if the catalog, schemas, news, or master tags changed.

The news scraper collects announcement links. The catalog updater reads each product's `.js` endpoint, preserving the complete response in the cache, including availability and other storefront metadata. Product prices already use integer cents. Sim collection listings use `products.json`, whose dollar prices convert to cents during normalization. Source tags remain evidence; catalog tags still come from the reviewed master file. Offline updates prefer `.js` caches and can reuse existing `.json` product caches without requesting the shop.

Undated Encore editions without a release window inherit the same item's First Run date, or its Deathgrey date when First Run has none. This is a user-approved assumption; known Encore dates remain unchanged.

Current data rules:

- `included-only` contains items whose editions are all explicitly marked `standalone: false`. Mixed items stay in `content`, retaining that flag on their included-only editions. Parent `includes` references remain valid across categories.

- Content IDs are object keys. Explicit editions have permanent readable lowercase kebab-case `id` values, unique within their item, such as `first-run`, `resin`, or `1-6`. Assign once and retain IDs when labels or other facts change; do not reuse retired IDs. `label` is a mutable release label. Creation tooling suggests an ID from the initial label and rejects collisions for review. Edition-less items use a synthetic `item` ID, or `bundle` for bundles, when tracked in a collection; these IDs are reserved. Beta items keep ordinary IDs, with `beta: true` on their editions. Items with all Beta editions use `kind: "Beta"`; mixed Beta and non-Beta items use `kind: "Box"`. Sets, expansions, vignettes, armor kits, singular Pinups, busts, Painter's Scale products, dice, and shirts use their established prefixes. Named boxed collections are sets; couples and grouped expansion miniatures are models.
- Matching standard models, busts, and painter's scale products share an item, with separate selectable editions. Single artist releases use Painters or Bust; multiple releases use labels such as Painters: First Run and Bust: Encore. Distinct themes, remasters, and unmatched artist models remain separate. Beta status is recorded on editions with `beta: true`; item IDs omit the former `beta-` prefix. Morgan's bust belongs to Morgan the Savior, and the White Speaker painter's scale belongs to White Speaker Koshka (formerly White Speaker). Senior Death High Allister and Thief Variant remain separate.
- Gameplay defaults to false. Item `gameplay` appears only when true; editions store an override only when different. `gameplayContent` and notes belong on the item. Alternative names use `aliases`; `alt` is removed.
- Edition availability defaults to false. Store `available: true` only when at least one matching shop variant or warehouse is available. Updates refresh known availability; responses without availability evidence preserve the existing value. This reflects the cached shop snapshot, not a live stock check.
- Prices are integer cents. Edition `prices` arrays contain recorded sale amounts and current MSRP, with the maximum representing MSRP. Missing prices are unknown; `[0]` is a known zero price. Lunar Aya's Sim price remains the user-authorized $7 estimate, documented in the report.
- Shared URLs live on the item; resolve listings with `edition.url ?? item.url`. Variant selectors and temporary preorder URLs are omitted. Physical sizes may inherit the item default; Sim has no model size.
- Exact dates remain edition `releaseDate`, formatted YYYY-MM-DD. Imprecise dates use `releaseWindow`; future quarters use YYYY Qn. Unknown run counts are omitted. Released expansion dates use the public shop launch announcement when only a month was documented.
- Every explicit edition records `format: "physical"` or `format: "digital"`. Sim entitlements also record `simulator: true`; digital 3D Files do not grant simulator access. Known `materials` and `numbered: true` are explicit facts. A release-specific `name` can supply alternate display wording.
- `includes` remains on the item. Child `editionId` selects a stable release ID on the referenced child item, and `parentEditionIds` selects releases on the containing item. IDs can repeat across different items. Sim references require explicit parent editions, which can include physical keys that grant digital access. Physical expansion contents are scoped to physical editions. Reverse membership is derived. Satan Pledge preserves its 184 exact release references.
- Simulator keys share the `kingdom-death-simulator` content item. Dwelling Key and Illusionist Key include Core's Sim edition. Master Dwelling Key uses edition `includesAllSim: true`, resolved against every edition marked `simulator: true` whenever the catalog is read. It covers current and future Sim releases without maintaining a duplicated list, and grants digital access without owning physical models.
- Both catalog and master tag files share category and item ordering. Content starts with core, then expansions sorted by release date, then all remaining items alphabetically by ID without family blocks. Other categories sort alphabetically by ID. Editions sort with Sim first, then by release date or release window, oldest first. Undated editions come last. Equal dates use the established release-label order as a tie-breaker.
- Item fields are alphabetical. Edition fields start with `id`, then `label`; inclusion-object fields start with `item`, followed by alphabetical fields. Catalog write commands preserve this property order; array contents and their established ordering remain unchanged.

The schema retains ID-pattern rules and basic field validation without conditional branches. The CLI additionally checks references, cycles, edition labels, real dates, normalization, and ordering.

The collection page uses this catalog and saves owned, wished, and numeric `copyNumber` state under stable content and edition IDs. Copy
numbers are integers from 1 through 9999, bounded by a known run size. The original workbook
remains in `temp/kdm-catalog/imports/KDM Collection Sheets.xlsx`. No collection ownership is inferred from ambiguous material or run
choices.

Run `pnpm catalog:workbook` to regenerate `static/kdm-catalog/workbook-map.json` from the local
`temp/kdm-catalog/imports/kdm-import-records.json` and live catalog. The 705 mapped rows retain their sheet, row, and product name as
source anchors, plus primary, related, and release-column references to stable edition IDs. M, N, and O alternatives remain separate;
general personal values stay scoped to the source row. The map contains product references only, never owned, wished, copy, comment,
or raw cell values. Sheet and row numbers locate this workbook snapshot rather than serving as permanent IDs. Regeneration rejects
changed row identities and unresolved references for review. Validated normalized-row import/export workflows exist in
`src/lib/state/collection-transfer.ts`; XLSX parsing, writing, and controls are deferred. Exports reject unmapped entries and values
that a shared row cannot represent. JSON backups preserve a complete collection snapshot.

The Git-ignored `temp/kdm-catalog/imports/` folder contains temporary workbook data. Validation checks import records and their schema when records are present; catalog updates and validation also work without them. Keep the import records and original workbook if you need to regenerate or verify the map. Optional shop mappings live in the Git-ignored `temp/kdm-catalog/shopify-products/kdm-shop-mappings.json` file. Updates work without this file; unknown or ambiguous products remain in the review for resolution. An explicit `--mappings` path must exist.

All optional working files live under the workspace's `temp/kdm-catalog/` folder, covered by the single `/temp/` ignore rule. Store product snapshots and mappings share `shopify-products/`. Maintained catalog data and its schema live in `static/kdm-catalog/`. Custom catalog paths follow the same `static/kdm-catalog/` and `temp/` workspace layout.

Refresh shop availability independently with `pnpm catalog:availability`. It downloads `/products.json?limit=250&page=N`, at least 35 seconds between requests, into `temp/kdm-catalog/shopify-products/products-page-N.json`. After every page succeeds, it updates only edition `available` fields in this catalog. Each `edition.url ?? item.url` must resolve to the product handle; names and optional mappings are not used. Named release variants distinguish First Run, Encore, and format-qualified runs. Any matching warehouse with `available: true` makes that edition available; unmatched or ambiguous editions omit the field. Details go to `temp/kdm-catalog/reports/availability-refresh.json`.

Use `pnpm catalog:availability --offline` to apply the saved pages without downloading, or `--catalog path/to/static/kdm-catalog/data.json` to select a different catalog. Failed downloads leave the named snapshots and catalog unchanged. Catalog edits made during the refresh prevent the catalog write.

## Item notes and review decisions

Item `notes` are shown to collectors. Keep product contents, sculpt differences, packaging, production history, and useful release details there. Keep date fallbacks, source comparisons, matching decisions, and instructions for maintaining the catalog in this README or the local reports. Do not put messages to a reviewer or explanations of the merge process in item notes.

The following review decisions were moved out of item notes. Cached publication dates can describe a restock rather than the original release. Earlier known dates take precedence; the established creation-date fallback applies when the shop creation year is at least one year earlier than its publication year.

| Item                                    | Review decision                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `armor-kit-dragon-king`                 | The Naked shop listing was created on 2015-11-23 and tagged Black Friday 2015. Its 2025 publication date is a later listing update. The former 2021-11-26 kit date was replaced by the creation-date fallback before splitting the editions. Naked retains 2015-11-23; the included Plastic edition follows the expansion's 2016-02-16 release. |
| `armor-kit-gorment`                     | The Naked Gorm shop listing was created on 2015-11-23 and tagged Black Friday 2015. Its 2025 publication date is a later listing update. The standalone Gorm entry was merged into Gorment Armor Kit. Naked retains the creation-date fallback; included Plastic follows the expansion's 2016-02-16 release.                                    |
| `armor-kit-lantern`                     | The Naked listing was matched to the existing Lantern Armor Kit. The existing earlier release date was retained instead of the later shop republication date.                                                                                                                                                                                   |
| `armor-kit-leather`                     | The Naked listing was matched to the existing Leather Armor Kit. The existing earlier release date was retained instead of the later shop republication date.                                                                                                                                                                                   |
| `armor-kit-screaming`                   | The Naked listing was matched to the existing Screaming Armor Kit. The existing earlier release date was retained instead of the later shop republication date.                                                                                                                                                                                 |
| `armor-kit-spider-silk`                 | The Naked listing was matched to the existing Spider Silk Armor Kit. Its 2015-11-23 creation date replaced the later republication date; the included Plastic edition follows the expansion's 2016-02-16 release.                                                                                                                               |
| `pinup-ramette-and-nightmare-ram-armor` | The standalone box uses the cached Shopify creation date, 2022-06-27, because it predates the later publication/restock date by more than a year. The two models retain their earlier Pinups of Death IV dates.                                                                                                                                 |
| `shadow-box-holy-lands`                 | Encore has no independently established release date. It inherits the First Run announcement date, 2026-04-01, under the catalog's Encore fallback rule.                                                                                                                                                                                        |
| `apotheosis`                            | Only Male Apotheosis and the Deathmas, Deathmas 2024, Easter, Halloween, and Valentines versions share this item. Female, Pinup, and May 2026 Apotheosis remain separate. Easter's old female tag conflicted with its source note identifying a reworked male sculpt; the combined item is tagged male.                                         |
| `parasite-queen`                        | The cached Screaming God Expansion product description confirms this included monster. It has no standalone release or standalone price in this catalog.                                                                                                                                                                                        |
| `screaming-god`                         | The cached Screaming God Expansion product description confirms this included monster. It has no standalone release or standalone price in this catalog.                                                                                                                                                                                        |
| `kings-coins`                           | The prize listing uses the cached Shopify creation date, 2023-01-30, rather than the later publication date. The prize's $0 price is distinct from the original retail release's unknown MSRP.                                                                                                                                                  |
| `vignette-of-death-collection`          | Regional listings map to the same 2025 bundle. Its contents are fixed to the three physical vignettes released at that time; future vignettes and Sim editions are not added automatically.                                                                                                                                                     |
| `set-promos-of-death`                   | The tentative 2027 release year is stored in releaseWindow. The duplicate note was removed; the year is an estimate rather than an exact release date.                                                                                                                                                                                          |

Armor-kit Naked editions retain the former standalone edition's price and date. Included Plastic editions use `[0]`, are marked `standalone: false`, and follow the earliest applicable physical Core or expansion release. A parent with only a future release window passes that window to the included edition. `[0]` represents no separate component price, not a free standalone shop product. The blanket Naked-edition rule also covers included-only kits; those labels do not establish that a standalone product was sold.

Included Plastic monster editions follow the same zero-price and parent-date convention. Resin, Encore, Bust, and other standalone releases retain their own prices and dates. Physical Core and official expansion editions use Plastic materials, except Core's Resin edition; Sim editions have no physical material.

Repeated release labels and shorthand were cleaned up without changing the underlying product facts. Notes about collectible packaging, print runs, and card differences remain in the catalog. The painting-contest prize model remains unresolved in the local cached-product audit. The Ultimate Starting Survivor Set - Finale Edition has been added from its cached product listing. Sleeves and Kickstarter listings are excluded from that audit's pending work.

The Ultimate Starting Survivor Set - Finale Edition uses the cached `products-page-2.json` listing with handle `starting-survivor-set-copy`, published on 2025-02-14. Its contents follow that listing rather than inheriting the other Ultimate bundle. The unnamed ?Indomitable Survivors (6)? entry is interpreted as the six physical releases available by that date: Longclaw Lenore, Stampede Glaive Xell, Gusk Knives Grimmory, Lordsruin Titus, Greatest Gaxe Morg, and Thumping Timpani Ledla. This selection is inferred from the release chronology.

The regular Ultimate Starting Survivor Set follows the cached `lantern-year-29-bundle` listing: Core 1.6, Gambler's Chest, Frogdog, Black Knight, Flower Knight, Sunstalker, Dragon King, Slenderman, Lonely Tree, Dung Beetle Knight, Gorm, Lion Knight, White Gigalion, and Killennium Butcher. It does not use the earlier assumption that the bundle contains all Vol. 1 expansions. Green Knight Armor Expansion retains `kind: "box"` as requested.

The Oblivion Mosquito monster and Oblivion Mosquito Armor Kit have separate included Plastic editions for the expansion's 2027 release window. These editions use `[0]` for no separate component price and `standalone: false`. Their earlier Naked editions keep their own prices and dates.

Goblin Dragon is confirmed by the catalog owner as part of Abyssal Woods. Its included Plastic edition follows the expansion's 2030 release window; the Naked edition retains its 2023 date and price. Steel Wax Armor Kit is confirmed by the catalog owner as part of Honeycomb Weaver. Its included Plastic edition follows the expansion's 2026 release window and uses [0] with standalone: false; the Naked edition retains its 2024 date and $30 price.

## Shop handles

Kingdom Death product listings use `handle`, matching the cached Shopify product handle. Build shop links as
`https://shop.kingdomdeath.com/products/` plus the handle. An item-level handle applies to every edition.
Without it, only editions with their own handle have a shop link. External listings, including homebrew, retain `url`.
Shared handles identify listings; release variants still determine edition pricing and availability.

When a listing changes handle, add a reviewed mapping for the new handle to the same item and edition, with
`replaceUrl: true`. Keep the old handle mapping without that flag so historical cache and news entries still resolve
without restoring the obsolete handle. Mappings live in `temp/kdm-catalog/shopify-products/kdm-shop-mappings.json`;
this local file is Git-ignored, so keep a copy if you need to preserve historical mappings when clearing temporary files.
A different release needs its own edition. A shared listing that splits into different listings becomes edition-level handles.
Homebrew editions retain their manually assigned availability during shop availability refreshes.

The availability refresh excludes `kings-coin-prize`: Shopify reports it in stock, but it is a promotional prize rather than a purchasable listing. Its edition remains unavailable.
