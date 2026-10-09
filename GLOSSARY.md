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
