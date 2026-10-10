# Domain glossary

## Catalog

The reference products and editions in `static/kdm-catalog/data.json`. Item IDs and edition IDs identify collection entries;
display labels can change without changing that identity.

## Catalog publication

Replacing prepared catalog files and related mappings, tags, archives, or reports after checking their captured inputs.
The publication module stages outputs, checks for edits, replaces files in order, and reports partial writes. Each file replacement
is separate; a completed report follows the files it describes.

## Review

A prepared catalog change set with input hashes and unresolved matches. Applying a review validates its inputs and proposed catalog
before publication. Its archive retains the complete change set; the merge report records the applied summary.

## Collection browsing

The active catalog category, search, tags, and ownership filter, together with per-category batches and retained card results.
`CollectionBrowsing` owns those transitions and URL restoration. `CollectionCards` owns collapse, deferred rendering, viewport
observation, and held-card scroll anchoring. The collection page owns focus, gestures, and navigation; `Collection` owns collection commands
and persistence.

## Catalog release resolution

Interpreting shop variants as catalog editions, including curated selectors, warehouse grouping, material and price evidence,
and conservative matching for complete availability snapshots. The workflows retain their own publication and availability policies.

## Collection session

The mounted app's storage and monitoring lifetime. `CollectionSession` opens browser storage, retains it for load retries,
and stops subscriptions before closing storage. The layout forwards reactive readiness; `Collection` owns state and commands.

## Workbook contract

The product mapping and normalized collection rows defined in `src/lib/types/workbook.ts`. Tooling and collection transfers use the same
runtime schemas; `pnpm generate:types` derives the editor schema. Catalog identity resolution and transfer workflows own their respective
reference checks.
