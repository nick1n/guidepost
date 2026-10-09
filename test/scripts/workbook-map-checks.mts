import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { buildWorkbookMap, validateWorkbookMap, type WorkbookImports } from "#scripts/catalog/workbook.mts";
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
      edition: "First Run",
      relatedItems: [
        { category: "content", itemId: "hero", edition: "Encore" },
        { category: "content", itemId: "hero", edition: "Resin" },
      ],
      ownershipScope: "source-row",
      releaseEditions: {
        M: [{ category: "content", itemId: "hero", edition: "First Run" }],
        N: [
          { category: "content", itemId: "hero", edition: "Encore" },
          { category: "content", itemId: "hero", edition: "Resin" },
        ],
      },
    },
    { sheet: "Shirt Catalog", row: 3, name: "Hero Shirt", category: "accessories", itemId: "shirt-hero" },
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
  const changedImports = imports();
  const changedCatalog = catalog();
  changedImports.records[0]!.edition = "Original Run";
  changedImports.records[0]!.releaseEditions!.M![0]!.edition = "Original Run";
  changedCatalog.content.hero!.editions![0]!.label = "Original Run";
  const map = buildWorkbookMap(changedImports, changedCatalog, original);
  assert.equal(map.rows[0]?.primary.editionId, first);
  assert.equal(map.rows[0]?.releaseEditions?.M?.[0]?.editionId, first);
  assert.equal(map.rows[0]?.primary.sourceEdition, "Original Run");
});

test("duplicate rows and unknown references fail before writing", () => {
  const duplicate = imports();
  duplicate.records.push({ ...duplicate.records[0]! });
  assert.throws(() => buildWorkbookMap(duplicate, catalog()), /Duplicate workbook row/);
  const unknown = imports();
  unknown.records[0]!.edition = "Unknown";
  assert.throws(() => buildWorkbookMap(unknown, catalog()), /Unknown workbook edition/);
});

test("a changed row name or source choice requires review instead of reusing an old ID", () => {
  const old = buildWorkbookMap(imports(), catalog());
  const moved = imports();
  moved.records[0]!.name = "Another Hero";
  assert.throws(() => buildWorkbookMap(moved, catalog(), old), /row identity changed/);
  const changedChoice = imports();
  changedChoice.records[0]!.edition = "Encore";
  assert.throws(() => buildWorkbookMap(changedChoice, catalog(), old), /reference changed|another ID/);
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
  const schema = JSON.parse(await readFile("static/kdm-catalog/workbook-map.schema.json", "utf8"));
  assert.equal(validateWorkbookMap(map, schema), map);
  assert.throws(() => validateWorkbookMap({ ...map, rows: [{ ...map.rows[0]!, cells: { I: true } }] }, schema));
});
