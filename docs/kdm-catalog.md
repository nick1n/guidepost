# KDM catalog guide

The catalog combines the previous app catalog, workbook, and cached news. Data and schema live in `static/kdm/catalog/`;
archives live in `local-data/kdm-catalog/archives/kdm-data.json` and `local-data/kdm-catalog/archives/kdm-data.schema.json`. See [README](../README.md#catalog) for commands.

| File                                                                                                              | Purpose                                     |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [Catalog](../static/kdm/catalog/data.json), [schema](../static/kdm/catalog/data.schema.json)                      | Product facts and relationships             |
| [Workbook map](../static/kdm/catalog/workbook-map.json), [schema](../static/kdm/catalog/workbook-map.schema.json) | Source rows and catalog edition IDs         |
| [News export](../scripts/news/shop-links.json)                                                                    | Cached announcement dates and product links |

Optional, Git-ignored `local-data/kdm-catalog/kdm-tags.json` supplies exact reviewed assignments; otherwise updates use catalog tags.
Apply edits before deleting it. Vocabulary lives in `local-data/kdm-catalog/kdm-tags.schema.json` under `$defs.tag.enum`.
VS Code flags invalid tags, empty arrays, and duplicates; merging checks missing and unknown item IDs.
Catalog tags sort by global frequency with alphabetical ties; master tag arrays stay alphabetical.

```bash
pnpm catalog:tags
pnpm catalog:tags --apply
pnpm catalog:validate
```

`catalog:tags` stages a review; `--apply` applies it and syncs the master file. No shop requests are made.
`catalog:tags-schema` refreshes schema structure while preserving vocabulary and custom definitions; new item IDs need no schema regeneration.

For news updates:

```bash
pnpm scrape:news --fetch
pnpm catalog:update --sim --fetch
pnpm catalog:update --apply-review temp/kdm-catalog/reports/kdm-update-review.json
pnpm catalog:validate
```

Reports stay in Git-ignored `temp/kdm-catalog/reports/`; retained inputs and archives belong under `local-data/kdm-catalog/`. Updates stage reviews; unknown products need curated mappings and tags.
Commands default to cached evidence and never download missing entries. `--fetch` refreshes caches; `--offline` selects the default and
cannot accompany it. Use `--date YYYY-MM-DD` to select an article. Shop requests start at least 35 seconds apart, cache for 24 hours,
and never retry automatically. A 404/410 preserves facts; other failures stop preparation.
Changes to catalog, schemas, news, or master tags invalidate a review.

The news scraper collects announcement links. Product `.js` caches retain complete storefront responses, with prices in cents;
Sim `products.json` prices are dollars and normalize to cents. Source tags are evidence, not reviewed assignments.
Offline updates prefer `.js` caches and also accept existing `.json` product caches.
Stock and availability use only the complete two-page shop snapshot: `products.json?limit=250&page=1` and `page=2`.
`catalog:availability` reads the saved `products-page-1.json` and `products-page-2.json` by default.
With `--fetch`, it downloads exactly those two pages and publishes their caches only after both succeed.
Individual product responses and HEAD checks never supply stock or availability.
Run `catalog:availability` after importing new editions to assign snapshot stock.

Reviewed fallback: undated Encore without a release window inherits First Run's date, or Deathgrey's if First Run has none.
Known Encore dates stay unchanged.

## Product, content, and ownership

Use `includes` to reference shared canonical content. A simple product may represent its own contents; do not create
editions solely to duplicate packaging or suppress prices. Genuine non-sale components use `includedOnly: true` without `prices`.

Inclusions and upgrades provide content coverage, never product ownership. Lists may be partial; reviewed bundle lists remain fixed until
reviewed again. Runtime rules live in [ownership and coverage](kdm-architecture.md#product-ownership-and-content-coverage).

Current data rules:

- Use inclusion `shortLabel` only when the parent makes part of the canonical name redundant, such as `Model`, `Armor`, or `Gameplay content`. It applies only within that relationship. Keep canonical names for unrelated contents and named variants.
- `included-only` contains items whose editions are all explicitly marked `includedOnly: true`. Mixed items retain their existing category and that flag on included-only editions. Parent `includes` references remain valid across categories.
- Edition labels describe the release and may repeat. Use `includedOnly: true` only for confirmed components available as part of another product; the UI derives that distinction. Included-only editions have no `prices` field because they are not separately sold. Shop matching excludes them. Workbook regeneration retains mapped IDs; a new legacy label reference prefers a unique standalone edition, otherwise requires an unambiguous included edition.

- Content IDs are object keys. Explicit edition IDs are permanent lowercase kebab-case, unique within their item. Keep IDs when labels
  or facts change; never reuse retired IDs. Creation tooling suggests initial IDs and rejects collisions. Reserve `item` and `bundle`
  for synthetic editions. Beta editions use ordinary IDs and `beta: true`; all-Beta items use `kind: "beta"`, mixed items `kind: "box"`.
  Keep established product prefixes. Named boxed collections are sets; couples and grouped expansion miniatures are models.
- Matching models, busts, and painter's scale releases share an item with separate editions. Single artist releases use Painters or Bust;
  multiple releases qualify labels, such as Painters: First Run. Distinct themes, remasters, and unmatched models remain separate.
  Morgan's bust belongs to Morgan the Savior; White Speaker painter's scale belongs to White Speaker Koshka (formerly White Speaker).
  Senior Death High Allister and Thief Variant remain separate.
- Gameplay defaults to false. Item `gameplay` appears only when true; editions store an override only when different. `gameplayContent` and notes belong on the item. Alternative names use `aliases`; `alt` is removed.
- Edition availability defaults to false. Store `available: true` only when at least one matching variant or warehouse in the two-page shop snapshot is available. Metadata imports preserve existing stock and availability when the listing is unchanged; new editions wait for `catalog:availability`.
- `shop` stores `in-stock`, `out-of-stock`, or `missing` on editions, or on items without editions. Shared `shopUpdated` is a `YYYY-MM-DD` refresh date.
  Clear the affected `shop` and edition `available` fields after manually changing its handle or external URL.
  Missing shop evidence displays as stock unknown, independently of `available`. Only current-listing variants in the two-page snapshot
  update stock states and availability. Historical mappings and individual product responses cannot override that snapshot.
  The `in-stock` tag is derived from edition shop states and removed when none remain in stock.
  Tag and metadata updates use existing shop states; `catalog:availability` updates them from the snapshot.
  [stock.mts](../scripts/catalog/stock.mts) owns stock, availability, link-health, and listing-invalidation operations. Tag sorting and validation
  share its stock predicate; workflow code chooses whether a stock observation also replaces availability.
- Prices are integer cents. Edition `prices` arrays contain recorded sale amounts and current MSRP, with the maximum representing MSRP. Missing prices are unknown; `[0]` is a known zero price. Lunar Aya's Sim price remains the user-authorized $7 estimate, documented in the report.
- For reviewed bundle comparisons, an unpriced edition may set `priceFrom` to one standalone edition ID on the same item.
  The target must have its own `prices`, match the format and simulator status, and have neither `includedOnly` nor `priceFrom`.
  Do not combine `prices` with `priceFrom`. This reference does not establish content equivalence or product ownership and does not
  supply a price to the edition's own card or collection value. Without an explicit reference, missing prices stay unknown;
  matching labels, materials, and `equivalentTo` never provide a price. Item-level `price` applies only to synthetic item/bundle editions.
- Shared shop handles live on the item; resolve external URLs with `edition.url ?? item.url`. Omit variant selectors and temporary
  preorder URLs. Physical sizes may inherit the item default; Sim has no model size.
- Exact dates remain edition `releaseDate`, formatted YYYY-MM-DD. Imprecise dates use `releaseWindow`; future quarters use YYYY Qn. Unknown run counts are omitted. Released expansion dates use the public shop launch announcement when only a month was documented.
- Every explicit edition records `format: "physical"` or `format: "digital"`. Sim entitlements also record `simulator: true`; digital 3D Files do not grant simulator access. Known `materials` and `numbered: true` are explicit facts. A release-specific `name` can supply alternate display wording.
- `includes` remains on the item. Child `editionId` selects a stable release ID on the referenced child item, and `parentEditionIds` selects releases on the containing item. IDs can repeat across different items. Sim references require explicit parent editions, which can include physical keys that grant digital access. Physical expansion contents are scoped to physical editions. Reverse membership is derived. Satan Pledge preserves its 184 exact release references.
- Simulator keys share the `kingdom-death-simulator` content item. Dwelling Key and Illusionist Key include Core's Sim edition. Master Dwelling Key's `includesAllSim: true` dynamically grants all current and future `simulator: true` editions, without physical ownership.
- Both catalog and master tag files share category and item ordering. Content starts with core, then expansions sorted by release date, then all remaining items alphabetically by ID without family blocks. Homebrew puts CCG-tagged items first, sorting each group alphabetically by ID. Other categories sort alphabetically by ID. Editions sort with Sim first, then by release date or release window, oldest first. Undated editions come last. Equal dates use the established release-label order as a tie-breaker.
- Item fields are alphabetical. Edition fields start with `id`, then `label`; inclusion-object fields start with `item`, followed by alphabetical fields. Catalog write commands preserve this property order; array contents and their established ordering remain unchanged.

The schema retains ID-pattern rules and basic field validation without conditional branches. The CLI additionally checks references, cycles, edition labels, real dates, normalization, and ordering.

## Workbook mapping

The original workbook remains in `local-data/kdm-catalog/imports/KDM Collection Sheets.xlsx`.
Never infer ownership from ambiguous material or run choices.

Run `pnpm catalog:workbook` to regenerate [workbook-map.json](../static/kdm/catalog/workbook-map.json) from the local
`local-data/kdm-catalog/imports/kdm-import-records.json` and live catalog. The 705 mapped rows retain their sheet, row, and product name as
source anchors, plus primary, related, and release-column references to stable edition IDs. M, N, and O alternatives remain separate;
general personal values stay scoped to the source row. The map contains product references only, never owned, wished, copy, comment,
or raw cell values. Sheet and row numbers locate this workbook snapshot rather than serving as permanent IDs. Regeneration rejects
changed row identities and unresolved references for review. Validated normalized-row import/export workflows exist in
[collection-transfer.ts](../src/lib/kdm/collection/state/collection-transfer.ts); XLSX parsing, writing, and controls are deferred. Exports reject unmapped entries and values
that a shared row cannot represent. JSON backups preserve a complete collection snapshot.

Validation checks optional import records and their schema when present. Keep records and the workbook to regenerate or verify the map.
Shop mappings are optional; unresolved products stay in review. An explicit `--mappings` path must exist.
Retained import records belong under Git-ignored `local-data/kdm-catalog/imports/`; Shopify snapshots belong in `.cache/kdm-catalog/shopify-products/`, and reviewed shop mappings live in `local-data/kdm-catalog/kdm-shop-mappings.json`. Reports remain under `temp/kdm-catalog/reports/`. Custom workspaces use the same `static/kdm/catalog/`, `local-data/`, `.cache/`, and `temp/` layout.

## Availability refresh

`pnpm catalog:availability --fetch` downloads `/products.json?limit=250&page=N` into
`.cache/kdm-catalog/shopify-products/products-page-N.json`, at least 35 seconds apart. After all pages succeed, it updates edition
`available` fields, `shop` states, and the shared `shopUpdated` date. Handles or legacy URLs identify listings; names and optional mappings are unused.
Release variants distinguish First Run, Encore, and format-qualified runs. Any matching warehouse in stock makes an edition available;
unmatched or ambiguous editions omit the field. Details go to `temp/kdm-catalog/reports/availability-refresh.json`.

Without `--fetch`, the command applies saved pages and uses their oldest modification date for `shopUpdated`.
`--catalog path/to/static/kdm/catalog/data.json` selects another catalog.
Failed downloads preserve snapshots and catalog; concurrent catalog edits prevent publication.

## Item notes and review decisions

Item `notes` describe contents, sculpt differences, packaging, production history, and useful release details for collectors.
Keep maintenance instructions, source comparisons, and matching decisions here or in local reports.

Cached publication dates may describe restocks. Earlier known releases take precedence; use the reviewed creation-date fallback when
creation year is at least one year earlier than publication year.

| Item                                    | Review decision                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `armor-kit-dragon-king`                 | The retained Naked edition uses the 2015-11-23 creation date and Black Friday 2015 tag, replacing 2021-11-26; the 2025 publication is a listing update. The duplicate included Plastic edition was removed after its contents were confirmed equivalent.                                                |
| `armor-kit-gorment`                     | Standalone Gorm merged into Gorment. The retained Naked edition uses the 2015-11-23 creation date and Black Friday 2015 tag, rather than the 2025 listing update. The duplicate included Plastic edition was removed after its contents were confirmed equivalent.                                      |
| `armor-kit-lantern`                     | Naked matches Lantern Armor Kit and retains its earlier release date.                                                                                                                                                                                                                                   |
| `armor-kit-leather`                     | Naked matches Leather Armor Kit and retains its earlier release date.                                                                                                                                                                                                                                   |
| `armor-kit-screaming`                   | Naked matches Screaming Armor Kit and retains its earlier release date.                                                                                                                                                                                                                                 |
| `armor-kit-spider-silk`                 | Naked matches Spider Silk Armor Kit and uses its 2015-11-23 creation date. The duplicate included Plastic edition was removed after its contents were confirmed equivalent.                                                                                                                             |
| `pinup-ramette-and-nightmare-ram-armor` | Standalone box uses creation date 2022-06-27, more than a year before publication/restock. Both models retain earlier Pinups of Death IV dates.                                                                                                                                                         |
| `shadow-box-holy-lands`                 | Undated Encore inherits First Run's 2026-04-01 announcement under the reviewed fallback.                                                                                                                                                                                                                |
| `apotheosis`                            | Only Male Apotheosis and the Deathmas, Deathmas 2024, Easter, Halloween, and Valentines versions share this item. Female, Pinup, and May 2026 Apotheosis remain separate. Easter's old female tag conflicted with its source note identifying a reworked male sculpt; the combined item is tagged male. |
| `parasite-queen`                        | The cached Screaming God Expansion description confirms inclusion, with no standalone release or price.                                                                                                                                                                                                 |
| `screaming-god`                         | The cached Screaming God Expansion description confirms inclusion, with no standalone release or price.                                                                                                                                                                                                 |
| `kings-coins`                           | The prize listing uses the cached Shopify creation date, 2023-01-30, rather than the later publication date. The prize's $0 price is distinct from the original retail release's unknown MSRP.                                                                                                          |
| `vignette-of-death-collection`          | Regional listings map to the same 2025 bundle. Its contents are fixed to the three physical vignettes released at that time; future vignettes and Sim editions are not added automatically.                                                                                                             |
| `set-promos-of-death`                   | Tentative 2027 release uses `releaseWindow`, not an exact date.                                                                                                                                                                                                                                         |

The catalog owner confirmed identical models in 19 reviewed Naked/Plastic armor-kit pairs. Keep the sold Naked edition with its
price and date; if both editions were included-only, keep Plastic. Inclusions and local workbook targets use the retained ID.
Resin remains distinct. Included-only components retain reviewed parent dates or windows and omit prices; a Naked label alone
does not establish a standalone sale. Do not extend this normalization to unreviewed pairs.

Unreviewed sold/included Plastic pairs remain separate; cached listings do not establish sculpt identity, and Pinup Apotheosis has an
unresolved `remaster` difference. See `temp/kdm-catalog/reports/plastic-included-pairs-review.json` (Git-ignored).

Included Plastic monster editions follow the same parent-date convention and omit prices. Resin, Encore, Bust, and other standalone releases retain their own prices and dates. Physical Core and official expansion editions use Plastic materials, except Core's Resin edition; Sim editions have no physical material.

The painting-contest prize model remains unresolved in the cached-product audit. Sleeves and Kickstarter listings remain excluded.

The Ultimate Starting Survivor Set - Finale Edition uses the cached `products-page-2.json` listing with handle `starting-survivor-set-copy`, published on 2025-02-14. Its contents follow that listing rather than inheriting the other Ultimate bundle. The unnamed "Indomitable Survivors (6)" entry is interpreted as the six physical releases available by that date: Longclaw Lenore, Stampede Glaive Xell, Gusk Knives Grimmory, Lordsruin Titus, Greatest Gaxe Morg, and Thumping Timpani Ledla. This selection is inferred from the release chronology.

The regular Ultimate Starting Survivor Set follows the cached `lantern-year-29-bundle` listing: Core 1.6, Gambler's Chest, Frogdog, Black Knight, Flower Knight, Sunstalker, Dragon King, Slenderman, Lonely Tree, Dung Beetle Knight, Gorm, Lion Knight, White Gigalion, and Killennium Butcher. Green Knight Armor Expansion retains reviewed `kind: "box"`.

The Oblivion Mosquito monster and Armor Kit have included Plastic editions for the expansion's 2027 release window. Both use `includedOnly: true` and omit prices. The monster's separate Naked edition remains; the armor kit's duplicate Naked edition was removed because its contents match the retained Plastic edition.

Goblin Dragon is confirmed by the catalog owner as part of Abyssal Woods. Its included Plastic edition follows the expansion's 2030 release window; its distinct Naked edition retains its 2023 date and, because it is included-only, has no price. Steel Wax Armor Kit is confirmed by the catalog owner as part of Honeycomb Weaver. Its retained Plastic edition follows the expansion's 2026 release window and uses `includedOnly: true` without prices; the duplicate Naked edition was removed because its contents match Plastic.

Core 1.3 and Resin boxes include the same 1.3 rulebook and share its `1-3-included` edition reference. The former `resin-included` rulebook ID is retired and must not be reused.

Gameplay components are included-only and versioned by physical ruleset; Core rulebooks are separate. Legendary Card Pack I upgrades Core
gameplay and rulebooks from 1.5 to 1.6, plus gameplay from 1.3 to 1.6 for Dung Beetle Knight, Dragon King, Lonely Tree, Lion Knight,
Sunstalker, and Flower Knight. Each update requires its corresponding older content.

Gorm, Green Knight Armor, Lion God, Manhunter, Slenderman, and Spidicules share 1.3/1.6 gameplay through `equivalentTo`. No 1.7 or Sim upgrades
are inferred.

Pack I also supplies Allison the Twilight Knight, White Speaker Koshka, Holiday White Speaker Nico, Pinups of Death II, and Beyond the Wall
gameplay without prerequisites or miniatures. Their gameplay-bearing physical editions share these components. This owner-reviewed inclusion
supersedes the cached Pinups of Death II exclusion.

Boxed 1.5 and 1.6 rulebooks use the matching standalone `1-5` and `1-6` IDs. Retired duplicate included IDs must not be reused.

## Shop handles

Kingdom Death product listings use `handle`, matching the cached Shopify product handle. Build shop links as
`https://shop.kingdomdeath.com/products/` plus the handle. An item-level handle applies to every edition.
Without it, only editions with their own handle have a shop link. External listings, including homebrew, retain `url`.
Shared handles identify listings; release variants still determine edition pricing and availability.

When a listing changes handle, add a reviewed mapping for the new handle to the same item and edition, with
`replaceUrl: true`. Keep the old handle mapping without that flag so historical cache and news entries still resolve
without restoring the obsolete handle. Mappings live in `local-data/kdm-catalog/kdm-shop-mappings.json`;
this local file is Git-ignored, so keep a copy if you need to preserve historical mappings when clearing temporary files.
A different release needs its own edition. A shared listing that splits into different listings becomes edition-level handles.
Homebrew editions retain their manually assigned availability during shop availability refreshes.

CCG projects use digital `Digital Files` editions and `prices: [0]`. Unfinished projects keep `upcoming` without availability.

`kings-coin-prize` remains unavailable despite Shopify stock because it is a promotional prize.
