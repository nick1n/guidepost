import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { expect, it } from "vitest";
import { decodeWorkbookMap } from "#lib/types/workbook.ts";

const schema = JSON.parse(await readFile("static/kdm-catalog/workbook-map.schema.json", "utf8"));
const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
const target = { category: "content", contentId: "hero", editionId: "first-run" };
const row = { sheet: "KDM Miniatures", row: 2, name: "Hero", primary: target };
const metadata = {
  $schema: "./workbook-map.schema.json",
  formatVersion: 1,
  source: { id: "kdm-collection-sheets", workbook: "Products.xlsx" },
};

it("accepts the published mapping in both tooling and editor validation", async () => {
  const map = JSON.parse(await readFile("static/kdm-catalog/workbook-map.json", "utf8"));
  expect(validate(map), JSON.stringify(validate.errors)).toBe(true);
  expect(decodeWorkbookMap(map)).toEqual(map);
});

it.each([
  ["valid product", { ...metadata, rows: [row] }, true],
  ["valid shared ownership", { ...metadata, rows: [{ ...row, related: [target], ownershipScope: "source-row" }] }, true],
  ["valid shirt", { ...metadata, rows: [{ ...row, sheet: "Shirt Catalog", primary: { ...target, editionId: "item" } }] }, true],
  ["missing source", { $schema: metadata.$schema, formatVersion: 1, rows: [row] }, false],
  ["first row", { ...metadata, rows: [{ ...row, row: 1 }] }, false],
  ["unknown sheet", { ...metadata, rows: [{ ...row, sheet: "Products" }] }, false],
  ["missing ownership scope", { ...metadata, rows: [{ ...row, related: [target] }] }, false],
  ["empty related", { ...metadata, rows: [{ ...row, related: [], ownershipScope: "source-row" }] }, false],
  ["empty release columns", { ...metadata, rows: [{ ...row, releaseEditions: {} }] }, false],
  ["empty release choices", { ...metadata, rows: [{ ...row, releaseEditions: { M: [] } }] }, false],
  [
    "duplicate alternatives",
    {
      ...metadata,
      rows: [{ ...row, releaseEditions: { M: [target, { editionId: "first-run", category: "content", contentId: "hero" }] } }],
    },
    false,
  ],
  ["invalid edition ID", { ...metadata, rows: [{ ...row, primary: { ...target, editionId: "First Run" } }] }, false],
  ["explicit shirt edition", { ...metadata, rows: [{ ...row, sheet: "Shirt Catalog" }] }, false],
  ["personal cell", { ...metadata, rows: [{ ...row, note: "Private" }] }, false],
  ["unknown nested field", { ...metadata, rows: [{ ...row, primary: { ...target, owned: true } }] }, false],
] as const)("keeps runtime and generated schema aligned for %s", (_name, map, valid) => {
  expect(validate(map)).toBe(valid);
  if (valid) expect(() => decodeWorkbookMap(map)).not.toThrow();
  else expect(() => decodeWorkbookMap(map)).toThrow();
});

it("rejects repeated locators even when their product names differ", () => {
  expect(() => decodeWorkbookMap({ ...metadata, rows: [row, { ...row, name: "Another product" }] })).toThrow();
});
