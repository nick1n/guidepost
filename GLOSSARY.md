# Domain glossary

Terms for the KDM catalog and personal collection. Ownership records acquisitions; coverage describes the content those acquisitions provide.

## Catalog

**Catalog**:
The reference collection of KDM products, components, editions, and their relationships.

**Item**:
A catalog identity grouping a product or component and its editions. An item can represent a separately sold product or an included-only component.

**Edition**:
A particular release of an item, distinguished by facts such as format, production run, or rules version. Its identity remains stable when its label or other descriptive facts change.
_Avoid_: Label as identity.

**Product**:
A catalog offering that can be acquired in its own right, including a box, bundle, model, or digital release.

**Included-only component**:
Content supplied within another product, with no standalone sale represented in the catalog.

**Inclusion**:
A relationship stating that a parent product supplies a specified child item or edition. Listed inclusions may describe only part of the parent's contents.

**Equivalence**:
A reviewed relationship allowing one edition to satisfy another edition's content coverage. It does not establish ownership of the other edition or supply that edition's additional contents.

**Upgrade recipe**:
A combination of referenced editions that together satisfy a target edition's content coverage. Every reference in one recipe is required; separate recipes are alternatives.

**Shop stock**:
The observed state of an edition's current shop listing: in stock, out of stock, or missing from the shop snapshot. Absent stock evidence is unknown.

**Availability**:
Whether an edition is recorded as currently obtainable through its listing. Availability is independent of the collector's ownership and content coverage.
_Avoid_: Availability as a synonym for coverage.

## Collection

**Collection entry**:
A collector's recorded ownership, wish, missing override, or copy number for one item and edition.

**Product ownership**:
An explicitly recorded acquisition of an edition. It is not inferred from inclusion, equivalence, or upgrade coverage.
_Avoid_: Owned as a synonym for covered content.

**Coverage**:
Whether an edition's content is supplied by recorded acquisitions, inclusions, equivalences, or upgrade recipes, subject to missing overrides. Coverage alone does not record ownership or supply additional contents.

**Missing override**:
A collector's declaration that a particular edition's content is absent despite sources that would otherwise cover it. It blocks that edition and the contents it supplies, while independent sources may still cover those contents.

**Wish**:
A collector's recorded desire to acquire an edition, separate from ownership and coverage.

**Copy number**:
The serial number assigned to a particular copy of a numbered release.
_Avoid_: Quantity owned, copy count.

**Listed-content progress**:
Coverage of the contents explicitly listed for a product. It does not establish completeness of contents absent from that list.

## Catalog workflows

**Catalog review**:
A proposed catalog change set with its source evidence and unresolved matches.

**Catalog publication**:
Applying a prepared catalog change set and its related mappings, tags, archives, and reports.

**Release resolution**:
Matching a shop listing's variants to catalog editions using reviewed release characteristics.

**Workbook mapping**:
A correspondence between rows and release choices in a particular workbook snapshot and stable catalog item and edition identities. Row locations identify that snapshot's source cells, not permanent product identities.

## Campaign (proposed)

**Content selection**:
Gameplay chosen for a campaign from content covered by a user's collection at selection time. The selection retains its edition and rules version independently of later collection changes.

**Command**:
A request to change campaign gameplay, expressing the player's intent.

**Event**:
An accepted gameplay change resulting from a command.

**Action**:
The complete group of events from one accepted gameplay command, forming one atomic undo step.

**Campaign rules version**:
The rules version recorded for a campaign, independent of subsequent changes to the players' collections.

**Sequential undo**:
Reversal of only the latest active action in the shared campaign timeline, regardless of actor or phase. Reaching an earlier action requires undoing every later action first.
