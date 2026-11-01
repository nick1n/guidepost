---
name: kdm-catalog-update
description: Review Kingdom Death store updates, find catalog matches, and check new and existing article items for missing tags. Trigger with `$kdm-catalog-update` in a thread for this repository to use cached evidence; append `Refresh the shop first` to fetch current data, or supply handles with new-item or existing-match decisions. Proposes matches, additions, and tag updates for confirmation before applying.
---

# KDM catalog update

Turn store evidence into reviewed catalog additions, durable shop mappings, and tag updates for existing products. Find matches before proposing new items.

## Invocation and scope

- `$kdm-catalog-update`: review saved evidence for new or unresolved listings and missing tags on products in the relevant news articles, then request confirmation of proposed decisions.
- `$kdm-catalog-update. Refresh the shop first.`: fetch current evidence through the catalog CLI before reviewing.
- `$kdm-catalog-update` followed by handles and decisions: use that list as the scope. Examples: `new model`, `new beta`,
  `matches item-id / edition-id`, or `new painters edition of item-id`. URLs and pasted `Resolve: ...: unmatched` lines also work.

Treat explicit user decisions as authorization for those decisions. Do not ask again whether a user-confirmed new item is new or
whether an explicitly supplied match is correct. Research the remaining details and ask only about unresolved choices.
A classification such as `new model` does not authorize merging another item, changing established identities, or inventing missing facts.

Default to additions, their existing matches, and tag review of all products in the relevant news articles. A user-supplied list limits
both item and tag review to that list unless the user requests the broader article review. A full monthly update, including unrelated
price and availability changes, needs that broader scope from the user. This skill is interactive; it does not schedule unattended
updates or commit/push changes.

## Load the project contract

Locate the repository root from this skill's location. Read these current files rather than relying on another thread's history:

- [AGENTS.md](../../../AGENTS.md) for conventions and required checks.
- [README.md](../../../README.md#catalog) for commands.
- [Catalog guide](../../../docs/kdm-catalog.md) for identity, editions, inclusions, and reviewed exceptions.
- [Catalog workflows](../../../docs/catalog-workflows.md) for evidence, staging, publication, and tag maintenance.

Preserve the current working tree. Capture the catalog and maintenance-file baseline before edits so validation can distinguish this
task from pre-existing changes. Read and write text explicitly as UTF-8, including temporary scripts.

## Gather evidence and find matches

1. Inspect `temp/kdm-catalog/reports/kdm-update-review.json` and the saved news and shop caches. Check evidence dates and whether the
   review still matches its inputs. Run `pnpm catalog:update` when a current review is needed. It stages a report and refreshes the
   tracked news export, but does not apply the catalog or acknowledge news imports.
2. Default to cached evidence. Use `pnpm catalog:update --fetch` when the user requests a refresh or current store discovery. Missing
   caches require reporting the missing input and offering that command; do not silently fetch. Let the CLI enforce request spacing.
3. Examine every in-scope unresolved listing and relevant automatically proposed name matches. An `unmatched` result means the
   automatic matcher found no match, not that the product is necessarily new.
4. Search all catalog categories and editions, aliases, current and historical handles, and reviewed shop mappings. Compare the cached
   description, contents, sculpt identity, scale wording, release variants, and gameplay. Similar names are candidates, not proof.
5. Prefer established mappings and exact listing identities. For newly inferred matches, distinguish an existing release, a new edition
   of an existing item, a replacement listing, a distinct new item, a set/bundle, or an excluded listing. Explain ambiguous alternatives.

Use readable descriptions in the review and complete cached product responses for missing details. Product `.js` prices are cents;
paginated shop prices are dollars before normalization. Inspect the cache shape before interpreting its values.
Only the complete two-page shop snapshot supplies stock and availability, regardless of individual product responses.

## Review tags across the update

Review all product listings in the relevant news articles, including already matched products and restocks. Use the articles represented
by the pending update, or the latest article when there are no pending announcements, unless the user names another article or limits
the scope to a list. Exclude community-showcase mentions and products excluded by the catalog rules.

Do not limit this review to `unresolved` or `changes` in the CLI report: unchanged, correctly matched items may still lack semantic tags.
A report with zero changes or zero unimported announcements does not establish that the tags are complete.

Read the cached article text and product descriptions, compare existing editions and analogous catalog items, and check the vocabulary
in `scripts/catalog/data/tags.schema.json`. Look for explicit gameplay contents (such as gear and Seed Patterns), painter's scale,
materials, named characters, settings, and supported monster-family associations. Article headings can supply evidence, such as an
explicit monster grouping; record that evidence alongside the proposed tag changes.

Do not copy marketing tags wholesale, infer monster roles, treat art cards as gameplay, or add seasonal tags merely because an item
appeared in a holiday sale. Costume family tags describe their inspiration without making the survivors monsters. Preserve reviewed
owner decisions; flag conflicting evidence rather than silently undoing them. Propose any needed new vocabulary or tag removals
explicitly instead of broadening or replacing the reviewed tag assignments automatically.

Include these tag-only proposals in the same decision review as item additions and matches. After approval, update both the catalog
and `scripts/catalog/data/tags.json` so subsequent imports retain the changes. Keep catalog tags sorted by global frequency and master
tag arrays alphabetical through the existing helpers.

## Prepare the decision review

Draft complete proposed records, mappings, and tag changes under `temp/kdm-catalog/` before asking for confirmation. Do not change
live catalog records, reviewed mappings/tags, schemas, or the import ledger to make an unconfirmed proposal appear resolved.
Use existing catalog helpers for normalization and ordering when preparing drafts; no new import pipeline is needed.

For each listing, show a compact decision table with its handle, proposed action, category/item ID, edition IDs and labels, and brief
matching evidence. Include proposed tags and relevant release facts: materials, gameplay/Beta, date or window, prices, and inclusions.
For tag-only changes, show the item, proposed additions/removals, and supporting evidence without repeating unchanged release facts.
Link the draft when the full records are too large for chat. Separate supported facts from unknowns and decisions needing the user.

Apply the catalog guide to the proposal, especially these common matching decisions:

- Matching standard models, busts, and painter's releases can share an item; distinct themes and sculpts require review.
- Named sets can reference existing canonical content through `includes`. Model-only releases do not confer gameplay or ownership of
  individual products. Reuse identical included content instead of duplicating editions for packaging differences.
- Assign permanent IDs once, using `scripts/catalog/identity.mts` for new edition IDs and collision checks. Display labels must fit the
  current schema. Do not rename existing IDs or broaden the schema just to accommodate an uncertain product classification.
- Preserve earlier documented release dates and existing price history. Leave unknown facts absent; a base diameter is not model scale
  or proof of a painter's release. Apply reviewed catalog exceptions rather than replacing them with inferred facts.

**Confirm proposed matches, new items, and tag updates before changing catalog sources.** This is the review step requested for this workflow.
Ask one bundled confirmation covering only decisions not already authorized, with corrections by handle and an option to defer.
Use the available user-input tool, or end with the concrete review and confirmation question. When pausing, name and link this skill
and quote the confirmation rule so the user knows why work is waiting. Silence is not approval.

If user-supplied decisions already authorize the entire scope and the evidence resolves the remaining facts, proceed without another
approval round. If a supplied decision conflicts with a permanent identity or reviewed fact, explain the conflict before changing it.

## Apply confirmed decisions

Recheck the captured inputs before writing. If they changed, rebuild affected drafts from the current working tree, preserving user
edits. Ask again only when the proposed meaning or scope changes.

Update `static/kdm/catalog/data.json`, `scripts/catalog/data/shop-mappings.json`, and reviewed tags together as needed. Map release
variants to permanent edition IDs, preserve historical mappings, and distinguish replaced listings from new releases.
Use `organizeCatalog`/`orderItemFields` and the tag helpers to preserve the project's ordering contracts. Expect global tag-frequency
changes to reorder some existing tag arrays; unrelated facts and Unicode text must stay intact.

Rerun `pnpm catalog:update` offline after source edits so the review reflects current mappings, tags, and records. Inspect the full diff,
not just unresolved counts. Resolve all in-scope listings; report any deferred or unrelated unresolved products honestly.

For an approved full monthly update, resolve all blockers, verify that the regenerated review stays within the approved scope, then run
`pnpm catalog:apply`. It applies every staged change and acknowledges the captured news posts. Changed-input failures require a fresh
review, never patched hashes or bypassed guards.

For a list limited to selected items, apply only those approved source changes. Do not apply the entire monthly review, trim away its
unresolved entries, or acknowledge a whole news post after importing only part of it. Leave the remaining monthly work staged and the
news ledger unacknowledged. Refresh stock for approved items only from the two-page snapshot using existing stock/availability helpers;
run a catalog-wide availability refresh only when that broader change is authorized.

Run the required checks in AGENTS.md, including catalog validation and project checks; format touched files with project Prettier.
Run the catalog encoding regression test when rewriting catalog text. If tooling needs a Node equivalent because `pnpm` is unavailable,
run the actual script commands and report that substitution. Finish with added/matched items, tag updates, unresolved or deferred work,
and checks. If the article-wide tag review found no additions, report that it was completed rather than omitting it.
