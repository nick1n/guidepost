import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { planUpdate } from "#scripts/catalog/update.mts";
import { validateCatalog } from "#scripts/catalog/validate.mts";
import { organizeCatalog } from "#scripts/catalog/order.mts";
import type { Catalog, Item, Product } from "#scripts/catalog/types.mts";

let workspace: string;
let schemaPath: string;
beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), "kdm-gameplay-"));
  schemaPath = join(workspace, "data.schema.json");
  await writeFile(schemaPath, await readFile("static/kdm/catalog/data.schema.json", "utf8"), "utf8");
});
afterAll(() => rm(workspace, { recursive: true, force: true }));

function catalog(facts: Partial<Item> = {}): Catalog {
  return {
    content: {
      example: {
        name: "Example",
        kind: "box",
        tags: ["gameplay"],
        handle: "example",
        editions: [{ id: "box", label: "Box", format: "physical" }],
        ...facts,
      },
    },
    "included-only": {},
    accessories: {},
    bundles: {},
    homebrew: {},
  };
}

function review(before: Catalog, contents: string, gameplay?: boolean) {
  const product: Product = {
    id: 1,
    title: "Example",
    handle: "example",
    description: `<ul><li>${contents}</li></ul>`,
    variants: [{ id: 1, title: "Default Title", price: 3400, compare_at_price: null, requires_shipping: true, sku: "" }],
  };
  return planUpdate(
    before,
    [{ data: product, checkedAt: "2026-11-17T00:00:00Z", url: "/products/example" }],
    { example: { category: "content", itemId: "example", editionId: "box", ...(gameplay !== undefined ? { gameplay } : {}) } },
    [],
    { content: { example: before.content.example!.tags }, "included-only": {}, accessories: {}, bundles: {}, homebrew: {} },
  );
}

test("rejects a gameplay tag with no gameplay-bearing release", async () => {
  await expect(validateCatalog(catalog(), schemaPath)).rejects.toThrow(/gameplay tag.*release/i);
});

test("rejects a Beta tag without a Beta edition even when gameplay is enabled", async () => {
  await expect(validateCatalog(organizeCatalog(catalog({ tags: ["beta", "gameplay"], gameplay: true })), schemaPath)).rejects.toThrow(
    /beta tag.*edition/i,
  );
});

test("accepts mixed releases with explicit model-only overrides and separate rulebook classification", async () => {
  const value = catalog({
    gameplay: true,
    tags: ["beta", "gameplay"],
    editions: [
      { id: "box", label: "Box", format: "physical", beta: true },
      { id: "painters", label: "Painters", format: "physical", gameplay: false },
    ],
  });
  value.accessories["example-rulebook"] = { name: "Rulebook", kind: "accessory", tags: ["gameplay"] };
  await expect(validateCatalog(organizeCatalog(value), schemaPath)).resolves.toMatchObject({ schemas: "passed" });
});

test("does not treat a Beta sculpt tag as evidence of Beta gameplay", async () => {
  await expect(validateCatalog(catalog({ tags: ["beta"], kind: "model" }), schemaPath)).resolves.toMatchObject({ schemas: "passed" });
});

test("stages unclassified Beta contents as a decision even on an otherwise unchanged listing", () => {
  const before = catalog({ gameplay: true });
  const result = review(before, "2 x Beta gear cards");
  expect(result.unresolved).toEqual([{ handle: "example", reason: expect.stringMatching(/beta.*box/i), candidates: ["example"] }]);
  expect(result.catalog).toEqual(before);
});

test("catches a missing physical gameplay flag when the Sim edition already has gameplay", () => {
  const before = catalog({
    editions: [
      { id: "sim", label: "Sim", format: "digital", simulator: true, gameplay: true, handle: "kds-example" },
      { id: "box", label: "Box", format: "physical", handle: "example" },
    ],
  });
  delete before.content.example!.handle;
  expect(review(before, "2 x Rare gear cards").unresolved).toEqual([
    { handle: "example", reason: expect.stringMatching(/gameplay.*box/i), candidates: ["example"] },
  ]);
});

test("accepts reviewed Beta releases and preserves explicit model-only decisions", () => {
  const beta = catalog({ gameplay: true, kind: "beta", editions: [{ id: "box", label: "Box", format: "physical", beta: true }] });
  expect(review(beta, "2 x Beta gear cards").unresolved).toEqual([]);
  const model = catalog({ editions: [{ id: "box", label: "Box", format: "physical", gameplay: false }] });
  expect(review(model, "2 x Beta gear cards").unresolved).toEqual([]);
  expect(review(catalog(), "2 x Rare gear cards", true).unresolved).toEqual([]);
});

test.each([
  "Character art card",
  "Prototype Beta sculpt miniature",
  "Kingdom Death 30mm base and insert",
  "3 Monster trait cards with new artwork. These replace the original cards.",
])("does not infer gameplay from %s", (contents) => expect(review(catalog({ tags: ["female"] }), contents).unresolved).toEqual([]));
