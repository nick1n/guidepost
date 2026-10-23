# Local-first KDM architecture

Status: describes implemented collection storage and current app behavior. Campaign and synchronization design is in the [proposed campaign design](kdm-campaign-design.md).

## Collection scope and existing behavior

The collection supports guest use and offline saves. It tracks owned content, editions, wishlist state, and related details without gameplay undo.

The `/kdm/collection/` page saves owned, wished, component missing overrides, and numeric `copyNumber` values locally. Copy numbers are integers from 1 to 9999,
bounded by a known run size. Entries use compound content/edition keys. Explicit edition IDs are permanent lowercase kebab-case,
unique within each item, and independent of labels or other mutable facts. Edition-less items use `item`, or `bundle` for bundles.
See the [catalog guide](kdm-catalog.md) for authoring rules.

```text
Collection -> OptimisticStore -> DexieStore (CollectionStore)
```

[OptimisticStore](../src/lib/kdm/collection/state/optimistic-store.ts) applies field patches immediately and serializes persistence.
[DexieStore](../src/lib/kdm/collection/state/dexie-store.ts) implements [CollectionStore](../src/lib/kdm/collection/state/collection-store.ts), saving complete owner snapshots
by writing changed rows and removing omitted entries. Revision checks, row changes, and metadata updates share one IndexedDB transaction.
Warm loads are read-only; the `ownerId` index serves reads and entry primary keys serve writes.

Dexie loads after the browser mounts the app. A metadata `liveQuery` subscription reports stale snapshots through the store interface.
`Collection` blocks edits and offers an explicit refresh without replacing its current state. Observations never authorize writing
against a newer revision. `CollectionSession` owns startup and monitoring in one Effect scope, stopping subscriptions before
closing the database connection on teardown. Transactional revision checks also reject competing writes before a notification arrives.

Observer failures block editing without discarding the current snapshot. The layout forwards collection readiness to the session,
which restarts monitoring after retry and keeps the subscription active during normal refreshes. Superseded command results and failures are interrupted before they reach notifications
or another owner's collection.

The root layout provides one `Collection` per app instance through Svelte context. It owns commands, derived totals and coverage,
load/save errors, and pending-write status. Components run commands through `collectionActions`; injected notifications use Effect
logging. Ownership commands record selected acquisitions; included content coverage is derived. Collection value sums catalog
prices of directly owned products, excluding included-only components.

The root initializes an empty catalog. Quick Start imports generated [core-editions.json](../src/lib/gen/core-editions.json): playable core IDs and labels
in catalog order, excluding Resin. The collection route loads the full catalog without replacing ownership or pending saves.
Helpers receive catalog data explicitly. Collection links disable hover data preloading; the service worker caches catalog and collection
HTML after a visit.

The action boundary handles the full Effect cause. Interruption remains control flow, including causes that also contain a typed
failure, and produces no failure notification. Expected failures report their typed messages; defects report a generic message and
log the full cause. A database load or monitoring failure offers retry; a failed storage-module download requires a page reload
because no persistence adapter exists yet.

Validated JSON backups replace the snapshot through the optimistic queue. Exports wait for preceding writes and copy confirmed data.
Workbook workflows validate normalized rows against the product-only map, require explicit selections for ambiguous releases, and
merge provided fields in one save. Workbook exports reject unmapped entries and shared-row values they cannot represent.
The mapping loads on demand; XLSX adapters and controls remain future work.

Metadata schema version 1 validates records; it is separate from Dexie's database version and provides no migration.
The collection queue has no durable undo. After release, table/index changes need Dexie upgrades, and incompatible records need a
compatibility or migration policy with preservation tests.

## App and route settings

The root layout provides app-scoped owners for menu state, date preferences, notification history, and showdown display settings.

[DatePreferences](../src/lib/app/date-preferences.svelte.ts) saves the date format on this device and reuses date/time formatters. Catalog calendar dates stay in UTC; notification timestamps use local time.

[HuntPreferences](../src/lib/kdm/hunt/preferences.svelte.ts) applies device settings immediately and queues field patches for
[DexieHuntStore](../src/lib/kdm/hunt/dexie-store.ts). Browser initialization opens the `guidepost-preferences` database, whose
`preferences` table stores the four validated hunt settings under the `hunt` key. A read/write transaction merges each patch with
the stored record to preserve unrelated changes from other tabs. The root layout interrupts the session and closes the connection
on unmount, and guards navigation away while writes are pending. There are no localStorage reads, writes, or migrations for hunt settings.

[NotificationLog](../src/lib/app/notification-log.svelte.ts) keeps the newest 100 entries in memory for the current session.

[ShowdownDisplay](../src/lib/kdm/showdown/display.svelte.ts) shares session-only display settings across showdown themes. Active showdown summaries and alignment callbacks are released when their route unmounts.

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
