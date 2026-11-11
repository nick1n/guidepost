---
name: dexiejs
description: Maintain Guidepost's Dexie adapters, IndexedDB schema, transactions, live queries, and migrations. Use for persistence implementation or debugging; preserve the CollectionStore and Effect lifecycle boundaries.
---

# Dexie.js

## Project conventions

Before editing, read [implemented architecture](../../../docs/kdm-architecture.md) and [Effect conventions](../../../docs/effect-conventions.md). Preserve adapter-owned connections and Effect-scoped subscriptions. Do not expose tables or subscribe directly from UI components.
Implement Dexie as a production data layer, not as scattered table calls inside UI components.

## Workflow

1. Classify runtime and rendering mode

- Confirm whether the target code runs only in browser or can run on server too.
- Load Dexie only during browser initialization, never during server rendering.
- Read [framework integration](references/framework-integration.md) for connection and subscription ownership.

2. Design schema from query shapes

- List read queries first (filters, sorts, ranges), then derive indexes.
- Use compound and multi-entry indexes when queries require them.
- Keep key strategy explicit (`++id`, custom IDs, or compound primary key).
- Load `references/core-patterns.md` sections 2 and 3.

3. Preserve schema and connection ownership

- Share the database schema in `src/lib/app/database.ts`, while collection and preference adapters own independent connections.
- Keep tables private to the persistence layer. Expose operations through the existing store interfaces, not table handles to components.
- Keep transaction boundaries in the data layer.

4. Add reactive reads

- Keep collection metadata `liveQuery()` subscriptions inside the adapter, with Effect finalizers.
- Report stale snapshots through `CollectionStore.changes`; let `CollectionSession` own monitoring and teardown.
- Block edits and offer refresh without replacing optimistic state or advancing the expected write revision.
- Interrupt subscriptions before closing their connection. Do not add direct component subscriptions or preference observers by analogy.

5. Add writes with invariants

- Use `db.transaction()` for multi-table consistency and read-modify-write logic.
- Avoid unrelated async APIs inside transactions unless deliberately wrapped with `Dexie.waitFor()`.

6. Plan upgrades before release

- Add new versions with `db.version(n).stores(...).upgrade(...)`.
- Make migration code idempotent and safe for partially-updated datasets.

7. Validate behavior

- Test cold start, reload persistence, and multi-tab updates.
- Test migration from previous schema with realistic data.
- Verify SSR/client boundaries are enforced in hybrid frameworks.

## Output Contract

When using this skill, return:

- Runtime boundary strategy and why.
- Final schema and index rationale per query path.
- Data-layer API surface (read/write helpers and transaction rules).
- Reactive read strategy for the selected framework.
- Migration plan and rollback considerations.
- Remaining risks and targeted tests.

## References

- `references/core-patterns.md`
  Core Dexie patterns: schema syntax, CRUD/query, transactions, migrations, reactivity, and performance.

- `references/framework-integration.md`
  Guidepost's browser initialization, adapter connections, and scoped monitoring.

- `references/troubleshooting.md`
  Symptom-to-fix guide for SSR boundary leaks, stale live queries, transaction issues, and migration failures.
