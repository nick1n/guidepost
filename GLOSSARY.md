# Domain glossary

## Catalog

Products and editions in `static/kdm-catalog/data.json`. Stable item and edition IDs identify collection entries; display labels can change.

## Catalog publication

Replacing staged catalog files, mappings, tags, archives, and reports after checking captured inputs. Files publish separately;
partial writes are reported, and completion reports publish last.

## Review

A catalog change set with input hashes and unresolved matches. Application validates inputs and proposed data before publication.
The archive retains the full change set; the merge report summarizes applied changes.

## Collection browsing

Catalog category, search, tags, ownership filter, per-category batches, and retained card results.
`CollectionBrowsing` owns those transitions and URL restoration. `CollectionCards` owns collapse, deferred rendering, viewport
observation, and held-card scroll anchoring. The collection page owns focus, gestures, and navigation; `Collection` owns collection commands.

## Catalog release resolution

Matching shop variants to catalog editions using curated selectors, warehouse groups, materials, and prices.
Workflows own their publication and availability policies.

## Collection session

The app's storage and monitoring lifetime. `CollectionSession` opens browser storage, retains it for load retries,
and stops subscriptions before closing storage. The layout forwards reactive readiness; `Collection` owns state and commands.

## Workbook contract

Product mappings and normalized rows in `src/lib/types/workbook.ts`, shared by tooling and collection transfers.
`pnpm generate:types` derives the editor schema; identity and transfer workflows own reference checks.
