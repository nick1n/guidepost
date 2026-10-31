# Local-first KDM architecture

This document covers implemented app behavior. See [proposed campaign design](kdm-campaign-design.md) for campaign and synchronization plans.

## Collection scope and existing behavior

The collection supports guest use and offline saves, without gameplay undo.

The `/kdm/collection/` page saves owned, wished, component missing overrides, and numeric `copyNumber` values locally. Copy numbers are integers from 0 to 9999,
independent of a known run size. Entries use compound content/edition keys. Explicit edition IDs are permanent lowercase kebab-case,
unique within each item, and independent of labels or other mutable facts. Edition-less items use `item`, or `bundle` for bundles.
See the [catalog guide](kdm-catalog.md) for authoring rules.

```text
Collection -> OptimisticStore -> DexieStore (CollectionStore)
```

[OptimisticStore](../src/lib/kdm/collection/state/optimistic-store.ts) applies field patches immediately and serializes persistence.
[DexieStore](../src/lib/kdm/collection/state/dexie-store.ts) implements [CollectionStore](../src/lib/kdm/collection/state/collection-store.ts), saving complete owner snapshots
by writing changed rows and removing omitted entries. Revision checks, row changes, and metadata updates share one IndexedDB transaction.
Warm loads are read-only; the `ownerId` index serves reads and entry primary keys serve writes.

[Database](../src/lib/app/database.ts) defines the version-one `guidepost` database with `entries`, `metadata`, and `preferences`
tables. Collection and preference adapters share this schema and database name, with independently owned connections so closing
one session does not interrupt another. The old collection and preference databases are not migrated or read.

Dexie loads after the browser mounts the app. A metadata `liveQuery` subscription reports stale snapshots through the store interface.
`Collection` blocks edits and offers an explicit refresh without replacing its current state. Observations never authorize writing
against a newer revision. `CollectionSession` owns startup and monitoring in one Effect scope, stopping subscriptions before
closing the database connection on teardown. Transactional revision checks also reject competing writes before a notification arrives.

Observer failures block editing without discarding the current snapshot. The layout forwards collection readiness to the session,
which restarts monitoring after retry and keeps the subscription active during normal refreshes. Superseded command results and failures are interrupted before they reach notifications
or another owner's collection.

The root layout provides one `Collection` per app instance through Svelte context. It owns commands, derived totals and coverage,
load/save errors, and pending-write status. Ownership commands record acquisitions; included content coverage is derived. Collection value sums catalog
prices of directly owned products, excluding included-only components.

The root initializes an empty catalog. Quick Start imports generated [core-editions.json](../src/lib/gen/core-editions.json): playable core IDs and labels
in catalog order, excluding Resin. The collection route loads the full catalog without replacing ownership or pending saves.
Helpers receive catalog data explicitly. Collection links disable hover data preloading; the service worker caches catalog and collection
HTML after a visit.

The collection route prerenders a header and loading shell, with no catalog cards or serialized catalog response.
[CatalogSession](../src/lib/kdm/collection/catalog-session.svelte.ts) loads and validates the catalog with a cancellable browser request,
inline retry, and reuse of the catalog in `Collection`. A collection-only fetch preload starts the first download early and is omitted on revisits.
Read-only pending, failed, and error getters expose one private state, separate from saved-collection loading and errors.

The app's [action runner](../src/lib/app/actions.ts) is provided through Svelte context and runs collection commands, navigation, and settings resets.
It reports notifications through injected Effect logging and accepts feature-owned tagged errors without importing their implementations.
Collection success messages stay in [messages.ts](../src/lib/kdm/collection/messages.ts).

Actions inspect the full Effect cause. Any interruption suppresses failure notifications, even when the cause also contains a typed failure.
Expected failures report their typed messages; defects report a generic message and
log the full cause. A database load or monitoring failure offers retry; a failed storage-module download requires a page reload
because no persistence adapter exists yet.

Validated JSON backups replace the snapshot through the optimistic queue. Exports wait for preceding writes and copy confirmed data.
Workbook workflows validate normalized rows against the product-only map, require explicit selections for ambiguous releases, and
merge provided fields in one save. Exports targeting the original mapping reject entries and shared-row values it cannot represent.

[Workbook transfers](../src/lib/kdm/collection/workbook/file.ts) load on demand and run in the browser.
Guidepost exports retain edition IDs and collection state for reimport; unknown or ambiguous identities fail validation.
Original workbook imports ignore unchecked cells, blanks, and copy-number placeholders. Earlier v1/v2 exports remain supported.
Closing the drawer preserves work; unmounting interrupts it, and owner changes invalidate previews and downloads.

Exports preserve the three-tab template and cover physical model products, shirts, dice, and original workbook bundles.
The product projection owns eligibility, release grouping, and classification.
Shared model rows retain separate edition states and whether the included model was supplied. Unchanged imports preserve acquisitions;
unchecking a supplied model records a missing-component override, and checking it again clears that override without creating standalone ownership.
See [workbook mapping](kdm-catalog.md#workbook-mapping) for row-sharing rules.

Metadata schema version 1 validates records; it is separate from Dexie's database version and provides no migration.
The collection queue has no durable undo. After release, table/index changes need Dexie upgrades, and incompatible records need a
compatibility or migration policy with preservation tests.

## Collection browsing

[CollectionBrowsing](../src/lib/kdm/collection/collection-browsing.svelte.ts) owns catalog category, search, tags, ownership filters,
item selection, per-category batches, retained card results, and URL restoration. It initializes panels from the synchronized hash,
so direct links render the requested view first. Item links resolve stable IDs within their category; unknown IDs show an empty state.
Browsing controls exit item mode; ownership and edition controls preserve it.
[CollectionCards](../src/lib/kdm/collection/collection-cards.svelte.ts) owns collapse, deferred rendering, viewport observation,
and held-card scroll anchoring. The collection page creates and synchronizes one hash route, passing it to the
[catalog screen](../src/lib/kdm/collection/ui/Catalog.svelte) for browsing transitions. The screen owns focus, gestures,
and card disposal; `Collection` owns collection commands.

## App and route settings

The root layout provides app-scoped Svelte contexts and owns browser startup, pending-write unload guards, and teardown.
App modules live under `src/lib/app/preferences/`, `menu/`, and `notifications/`; feature settings stay with their feature.

[AppPreferences](../src/lib/app/preferences/preferences.svelte.ts) and [HuntPreferences](../src/lib/kdm/hunt/preferences.svelte.ts)
expose getter-only values and explicit commands. Both use [PreferenceSession](../src/lib/app/preferences/preference-session.svelte.ts)
for immediate in-memory edits, startup buffering, sequential writes, and storage cleanup. Each session starts once.

`ready` means initialization finished, even after a load failure. `loadError` and `saveError` expose failures, also recorded in the
notification log. Failed writes retain choices in memory without automatic retry. `saveError` clears only after every failed field
is explicitly saved successfully; unrelated writes cannot clear it. `hasPendingChanges` counts queued or active writes.
A storage-module startup failure requires a reload.

Both adapters use [Database](../src/lib/app/database.ts), with `app` and `hunt` records in the shared `guidepost` database's
`preferences` table. Loads are read-only; transactional patches preserve other tabs'
unrelated fields. There are no live cross-tab subscriptions or localStorage migrations.

The shared [preference adapter](../src/lib/app/preferences/dexie-store.ts) owns opening, loading, transactional patches, and closing.
App and hunt adapters supply their record keys, defaults, decoders, and feature-owned errors. Each keeps its own connection.

The shared [record decoder](../src/lib/app/preferences/record.ts) derives optional stored fields from each feature's schema.
It accepts plain records, defaults absent known fields, and rejects malformed present values, including `undefined`.
Saves preserve unknown fields. Field renames or meaning changes need explicit migration rules.

[DatePreferences](../src/lib/app/preferences/date-preferences.svelte.ts) defaults to ISO formatting and caches formatters.
Catalog calendar dates stay in UTC; timestamps use local time. [GlassPreferences](../src/lib/app/preferences/glass-preferences.svelte.ts)
follows the system when its override is `null`. Only user interaction can clear an override that matches the system.

[NotificationLog](../src/lib/app/notifications/notification-log.svelte.ts) retains the newest 100 notices for the session.
[ShowdownDisplay](../src/lib/kdm/showdown/display.svelte.ts) shares session-only settings across themes and releases route-owned
summaries and alignment callbacks on unmount.

[CurrencyPreferences](../src/lib/app/currency/preferences.svelte.ts) reads the app's saved totals currency, defaulting to USD.
The total stays pending until the saved preference and initial rate-cache read resolve, so startup cannot display USD before a
saved currency. Usable cached rates display during revalidation; missing rates wait for the request before falling back.
Collection totals convert from their listed USD/EUR amounts through ECB rates supplied by Frankfurter; product prices keep their
listed currency. The collection owns cancellable rate requests on mount, focus, visibility, and reconnect. Exchange-rate failures
preserve the last snapshot. Before any download, a built-in EUR/USD estimate of EUR 1 = USD 1.13 allows offline conversion in either
direction. This fallback never receives a fetch timestamp or suppresses a network refresh. Other currencies need saved rates,
otherwise totals list the original currency amounts separately. The currency setting shows the rate date or identifies the default estimate.

The exchange-rate adapter validates network and cached responses and stores the snapshot with its successful fetch time in
`guidepost-exchange-rates-v1` Cache Storage. Freshness lasts 24 hours regardless of the rates' published date. Cache failures leave
rates usable in memory. The service worker preserves this cache across app updates, and the adapter works before worker activation.
No scheduled background refresh is used.

## Product ownership and content coverage

Product checkboxes, badges, filters, counts, and value use recorded `owned` values. Included rows use derived `coverage` from acquisitions,
inclusions, equivalences, and `completedBy` recipes. Each recipe requires all references; alternatives are independent. Coverage never records
ownership or supplies new contents. Inclusion lists may be partial, so progress counts only listed contents.

`toggleEditionOwned()` and `setEditionOwned()` clear the product's missing override. Checking also clears its wish and exact included
descendants' missing overrides in one save. For bundles, checking also records ownership of the exact included editions, including nested
contents, and clears their wishes while preserving copy numbers. Other products do not record child acquisitions.
Unchecking a bundle also clears ownership and missing overrides on its exact included descendants in the same save, preserving
copy numbers and wishes. Unchecking other products preserves descendants and their overrides.
Missing components do not change product ownership.

`toggleIncludedOwned()` clears component ownership when unchecked, keeping `missing: true` only if another source still covers it.
Checking removes the override, restoring coverage or recording an acquisition if needed. Missing overrides block the exact edition
and its supplied descendants; independent sources can still supply those descendants.

Saved edits omit false defaults and absent copy numbers, deleting empty entries. Patches retain false values to clear fields;
loading never rewrites snapshots. JSON backups preserve overrides; workbook exports reject unrepresentable values.

Bundle savings price uncovered listed contents, deduplicating shared contents and descendants of listed boxes. Unknown prices or unavailable
standalone products prevent savings calculations. An edition uses its own price, or an explicit reviewed `priceFrom` reference to
one priced standalone edition on the same item. Missing prices never trigger a search through equivalent or similar releases.
Price references apply only to bundle comparisons and do not grant ownership or content equivalence.
