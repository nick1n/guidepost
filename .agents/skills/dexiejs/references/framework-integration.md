# Guidepost integration

Read the [implemented architecture](../../../../docs/kdm-architecture.md) before changing persistence wiring.

## Browser startup and connections

The root layout owns browser startup and teardown. Load Dexie inside browser initialization.
`src/lib/app/database.ts` defines the shared database schema. Collection and preference adapters own independent connections;
closing one session must not close another session's connection. Do not replace these with a shared singleton connection.

## Collection monitoring

`DexieStore` implements `CollectionStore`. Its metadata `liveQuery` subscription reports stale snapshots through `CollectionStore.changes`.
Effect finalizers release subscriptions; `CollectionSession` owns scoped startup, monitoring, and teardown.
Interrupt monitoring before closing the connection.

`Collection` blocks edits and offers explicit refresh without replacing optimistic state. Observations do not advance the expected write
revision, and local saves must not report themselves as stale. Keep healthy monitoring active during refresh; restart failed monitoring
only after a successful retry. Observer failures preserve the snapshot and block edits.

Components consume feature state and run commands through the app action runner. They do not import database tables, subscribe to
`liveQuery`, or manage database connections. Preference sessions use transactional patches and have no live cross-tab subscriptions.

## Changes and validation

Keep revision checks, changed rows, removals, and metadata updates in one adapter transaction. Keep unrelated async work outside it.
Test affected startup, stale-tab, retry, owner-change, and teardown behavior through the existing interfaces.
Use the [Effect skill](../../effect/SKILL.md) for adapters and scoped resource handling.
