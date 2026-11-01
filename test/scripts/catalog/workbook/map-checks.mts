import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeWorkbookMap } from "#lib/types/workbook.ts";
import { buildWorkbookMap, normalizeWorkbookMap } from "#scripts/catalog/workbook/map.mts";
import type { WorkbookImports } from "#scripts/catalog/workbook/imports.mts";
import type { Catalog } from "#scripts/catalog/types.mts";

const first = "first-run";
const encore = "encore";
const resin = "resin";
const catalog = (): Catalog => ({
  content: {
    hero: {
      name: "Hero",
      tags: [],
      editions: [
        { label: "First Run", id: first },
        { label: "Encore", id: encore },
        { label: "Resin", id: resin },
      ],
    },
  },
  accessories: { "shirt-hero": { name: "Hero Shirt", tags: [], accessoryType: "shirt" } },
  bundles: {},
  "included-only": {},
  homebrew: {},
});
const imports = (): WorkbookImports => ({
  workbook: "KDM Collection Sheets.xlsx",
  records: [
    {
      sheet: "KDM Miniatures",
      row: 8,
      name: "Hero",
      category: "content",
      itemId: "hero",
      editionId: first,
      relatedItems: [
        { category: "content", itemId: "hero", editionId: encore },
        { category: "content", itemId: "hero", editionId: resin },
      ],
      ownershipScope: "source-row",
      releaseEditions: {
        M: [{ category: "content", itemId: "hero", editionId: first }],
        N: [
          { category: "content", itemId: "hero", editionId: encore },
          { category: "content", itemId: "hero", editionId: resin },
        ],
      },
    },
    { sheet: "Shirt Catalog", row: 3, name: "Hero Shirt", category: "accessories", itemId: "shirt-hero", editionId: "item" },
  ],
});

test("release columns keep every alternative edition ID and row ownership scope", () => {
  const map = buildWorkbookMap(imports(), catalog());
  assert.deepEqual(
    map.rows[0]?.releaseEditions?.N?.map((target) => target.editionId),
    [encore, resin],
  );
  assert.equal(map.rows[0]?.ownershipScope, "source-row");
  assert.equal(map.rows[1]?.primary.editionId, "item");
});

test("a renamed edition label keeps its mapped edition ID", () => {
  const original = buildWorkbookMap(imports(), catalog());
  const changedCatalog = catalog();
  changedCatalog.content.hero!.editions![0]!.label = "Original Run";
  const map = buildWorkbookMap(imports(), changedCatalog, original);
  assert.equal(map.rows[0]?.primary.editionId, first);
  assert.equal(map.rows[0]?.releaseEditions?.M?.[0]?.editionId, first);
  assert.deepEqual(map, original);
  assert.deepEqual(buildWorkbookMap(imports(), changedCatalog), original);
  const legacyMap = {
    ...original,
    rows: original.rows.map((row) => ({ ...row, primary: { ...row.primary, sourceEdition: "Old source label" } })),
  };
  assert.deepEqual(buildWorkbookMap(imports(), changedCatalog, legacyMap), original);
});

test("duplicate rows and unknown references fail before writing", () => {
  const duplicate = imports();
  duplicate.records.push({ ...duplicate.records[0]! });
  assert.throws(() => buildWorkbookMap(duplicate, catalog()), /Duplicate workbook row/);
  const unknown = imports();
  unknown.records[0]!.editionId = "unknown";
  assert.throws(() => buildWorkbookMap(unknown, catalog()), /Unknown workbook edition/);
});

test("a changed row name or source choice requires review instead of reusing an old ID", () => {
  const old = buildWorkbookMap(imports(), catalog());
  const moved = imports();
  moved.records[0]!.name = "Another Hero";
  assert.throws(() => buildWorkbookMap(moved, catalog(), old), /row identity changed/);
  const changedChoice = imports();
  changedChoice.records[0]!.editionId = encore;
  assert.throws(() => buildWorkbookMap(changedChoice, catalog(), old), /edition changed/);
});

test("generated map cannot contain personal cells or comments", async () => {
  const source = imports();
  Object.assign(source.records[0]!, {
    cells: { I: true, J: "wish" },
    productCells: { AH: "private note" },
    comments: { I: "personal comment" },
  });
  const map = buildWorkbookMap(source, catalog());
  const serialized = JSON.stringify(map);
  for (const value of ["private note", "personal comment", "wish", "cells", "comments", "productCells"])
    assert.equal(serialized.includes(value), false);
  assert.deepEqual(decodeWorkbookMap(map), map);
});

test("normalization validates stable references, strips source labels, and rejects personal fields", () => {
  const original = buildWorkbookMap(imports(), catalog());
  const value = structuredClone(original);
  Object.assign(value.rows[0]!, { cells: { I: true }, comments: "private comment" });
  assert.throws(() => normalizeWorkbookMap(value, catalog()));
  const clean = structuredClone(original);
  Object.assign(clean.rows[0]!.primary, { sourceEdition: "Former label" });
  const renamed = catalog();
  renamed.content.hero!.editions![0]!.label = "Box";
  assert.deepEqual(normalizeWorkbookMap(clean, renamed), original);
  renamed.content.hero!.editions![0]!.id = "replacement";
  assert.throws(() => normalizeWorkbookMap(clean, renamed), /Unknown workbook edition/);
});

test("normalization enforces duplicate targets and release membership using stable IDs", () => {
  const duplicate = buildWorkbookMap(imports(), catalog());
  Object.assign(duplicate.rows[0]!, {
    related: [...duplicate.rows[0]!.related!, { ...duplicate.rows[0]!.primary, sourceEdition: "Another label" }],
  });
  assert.throws(() => normalizeWorkbookMap(duplicate, catalog()), /Duplicate workbook target/);
  const alternatives = buildWorkbookMap(imports(), catalog());
  Object.assign(alternatives.rows[0]!.releaseEditions!, {
    N: [...alternatives.rows[0]!.releaseEditions!.N!, { ...alternatives.rows[0]!.releaseEditions!.N![0]!, sourceEdition: "Other label" }],
  });
  assert.throws(() => normalizeWorkbookMap(alternatives, catalog()), /Duplicate workbook release target/);
  const missing = buildWorkbookMap(imports(), catalog());
  Object.assign(missing.rows[0]!, { related: [missing.rows[0]!.related![0]!] });
  assert.throws(() => normalizeWorkbookMap(missing, catalog()), /absent from row choices/);
});
