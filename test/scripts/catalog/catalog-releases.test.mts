import { expect, test } from "vitest";
import { availabilityReleases, productEditions, resolveReleases } from "#scripts/catalog/releases.mts";
import { normalizeItem } from "#scripts/catalog/normalize.mts";
import { planUpdate } from "#scripts/catalog/update.mts";
import type { Catalog, Edition, Product, Variant } from "#scripts/catalog/types.mts";

function variant(id: number, title: string, facts: Partial<Variant> = {}): Variant {
  return { id, title, price: 3000, compare_at_price: null, requires_shipping: true, sku: "", ...facts };
}

function listing(variants: Variant[], facts: Partial<Product> = {}): Product {
  return { id: 1, title: "Example", handle: "example", description: "", variants, ...facts };
}

test.each(["Encore", "Painters: Encore", "Bust: Encore"])("does not infer numbering from Deathgrey material for %s", (label) => {
  const edition: Edition = { id: "encore", label, materials: ["Deathgrey"] };
  normalizeItem({ name: "Example", tags: [], editions: [edition] });
  expect(edition.numbered).toBeUndefined();
});

test("preserves release numbering and explicitly documented numbered Encore exceptions", () => {
  const editions: Edition[] = [
    { id: "first-run", label: "First Run" },
    { id: "deathgrey", label: "Deathgrey" },
    { id: "known-total", label: "Encore", runSize: 200 },
    { id: "confirmed-numbered", label: "Encore", numbered: true },
  ];
  normalizeItem({ name: "Example", tags: [], editions });
  expect(editions.map((edition) => edition.numbered)).toEqual([true, true, true, true]);
});

test("normalizes legacy painter labels without changing permanent IDs", () => {
  const editions: Edition[] = [
    { id: "original-id", label: "Painter's Scale: First Run", releaseDate: "2025-01-01" },
    { id: "encore-id", label: "Painter's Scale: Encore" },
  ];
  normalizeItem({ name: "Example", tags: [], editions });
  expect(editions.map(({ id, label, releaseDate }) => ({ id, label, releaseDate }))).toEqual([
    { id: "original-id", label: "Painters: First Run", releaseDate: "2025-01-01" },
    { id: "encore-id", label: "Painters: Encore", releaseDate: "2025-01-01" },
  ]);
});

test("matches painter release variants to their existing IDs and keeps Deathgrey material", () => {
  const editions: Edition[] = [
    { id: "original-id", label: "Painters: First Run" },
    { id: "grey-id", label: "Painters: Deathgrey" },
    { id: "encore-id", label: "Painters: Encore" },
  ];
  const result = resolveReleases(
    { name: "Example", tags: [], editions },
    listing([variant(1, "First Run"), variant(2, "Deathgrey"), variant(3, "Encore")], {
      description: "<ul><li>Photoresin miniature</li></ul>",
    }),
    { policy: "update", mapping: { category: "content", itemId: "example", editionLabel: "Painters: First Run" } },
  );
  expect(result.releases.map(({ edition, label, materials }) => ({ id: edition?.id, label, materials }))).toEqual([
    { id: "original-id", label: "Painters: First Run", materials: ["Photoresin"] },
    { id: "grey-id", label: "Painters: Deathgrey", materials: ["Deathgrey"] },
    { id: "encore-id", label: "Painters: Encore", materials: ["Photoresin"] },
  ]);
});

test("retains remaster qualifiers when matching release variants", () => {
  const editions: Edition[] = [
    { id: "original-id", label: "Remaster: First Run" },
    { id: "encore-id", label: "Remaster: Encore" },
  ];
  const result = resolveReleases({ name: "Example", tags: [], editions }, listing([variant(1, "First Run"), variant(2, "Encore")]), {
    policy: "update",
    mapping: { category: "content", itemId: "example", editionLabel: "Remaster: First Run" },
  });
  expect(result.releases.map(({ edition }) => edition?.id)).toEqual(["original-id", "encore-id"]);
});

test("curated selectors group warehouses under the existing edition without reassigning its permanent ID", () => {
  const edition: Edition = { id: "original-release", label: "Renamed release", prices: [2000, 4000] };
  const result = resolveReleases(
    { name: "Example", tags: [], editions: [edition] },
    listing([variant(1, "US Warehouse"), variant(2, "UK Warehouse", { price: 3200 }), variant(3, "Another release")]),
    {
      policy: "update",
      mapping: { category: "content", itemId: "example", variantIds: [1, 2], variantEditionIds: { 1: edition.id!, 2: edition.id! } },
    },
  );
  expect(result.releases).toHaveLength(1);
  expect(result.releases[0]!.edition).toBe(edition);
  expect(edition.id).toBe("original-release");
  expect(result.releases[0]!.variants.map((value) => value.id)).toEqual([1, 2]);
  expect(result.releases[0]!.prices).toEqual([2000, 3000, 3200, 4000]);
});

test("retrieval distinguishes warehouse fallbacks, named physical releases, and digital variants", () => {
  const result = productEditions(
    { name: "Example", tags: [] },
    listing([variant(1, "US Warehouse"), variant(2, "Special sculpt"), variant(3, "Digital", { requires_shipping: false })], {
      description: "PVC miniature.",
    }),
  );
  expect(result.selectors).toEqual({ 1: "pvc", 2: "special-sculpt", 3: "sim" });
  expect(result.editions.map(({ id, label, materials }) => ({ id, label, materials }))).toEqual([
    { id: "pvc", label: "PVC", materials: undefined },
    { id: "special-sculpt", label: "Special sculpt", materials: ["PVC"] },
    { id: "sim", label: "Sim", materials: undefined },
  ]);
});

test("ID mappings survive renamed and duplicate labels without merging distinct releases", () => {
  const editions: Edition[] = [
    { id: "original-id", label: "First Run", prices: [2000] },
    { id: "other-id", label: "Encore", prices: [4000] },
  ];
  const mapping = { category: "content" as const, itemId: "example", variantEditionIds: { 1: "original-id", 2: "other-id" } };
  for (const edition of editions) edition.label = "Box";
  const result = resolveReleases(
    { name: "Example", tags: [], editions },
    listing([variant(1, "US Warehouse"), variant(2, "UK Warehouse")]),
    {
      policy: "update",
      mapping,
    },
  );
  expect(
    result.releases.map(({ edition, prices, variants }) => ({ id: edition?.id, prices, variants: variants.map((v) => v.id) })),
  ).toEqual([
    { id: "original-id", prices: [2000, 3000], variants: [1] },
    { id: "other-id", prices: [3000, 4000], variants: [2] },
  ]);
  const single = resolveReleases({ name: "Example", tags: [], editions }, listing([variant(1, "Encore")]), {
    policy: "update",
    mapping: { category: "content", itemId: "example", editionId: "original-id" },
  });
  expect(single.releases[0]?.edition).toBe(editions[0]);
  expect(single.releases[0]?.label).toBe("Box");
});

test("invalid ID targets and unmapped new variants require review instead of creating editions", () => {
  const item = {
    name: "Example",
    tags: [],
    editions: [
      { id: "box", label: "Box" },
      { id: "included", label: "Box", includedOnly: true as const },
    ],
  };
  for (const editionId of ["missing", "included"])
    expect(() =>
      resolveReleases(item, listing([variant(1, "US Warehouse")]), {
        policy: "update",
        mapping: { category: "content", itemId: "example", editionId },
      }),
    ).toThrow(`missing or included-only edition ID ${editionId}`);
  expect(() =>
    resolveReleases(item, listing([variant(2, "New release")]), {
      policy: "update",
      mapping: { category: "content", itemId: "example", variantEditionIds: { 1: "box" } },
    }),
  ).toThrow("Variant 2 (New release) has no edition ID mapping");
  expect(() =>
    resolveReleases(item, listing([variant(1, "US Warehouse")]), {
      policy: "update",
      mapping: JSON.parse('{"category":"content","itemId":"example","edition":"Box"}'),
    }),
  ).toThrow("Outdated shop mapping");
  expect(item.editions).toHaveLength(2);
});

test("invalid mapping targets stage decisions without mutating catalog entries", () => {
  const catalog: Catalog = {
    content: {
      example: { name: "Example", handle: "example", tags: ["model"], editions: [{ id: "box", label: "Box", format: "physical" }] },
    },
    accessories: {},
    bundles: {},
    homebrew: {},
    "included-only": {},
  };
  const result = planUpdate(
    catalog,
    [{ data: listing([variant(1, "US Warehouse")]), checkedAt: "2026-11-01T00:00:00Z", url: "/products/example" }],
    {
      example: { category: "content", itemId: "example", editionId: "retired-id" },
    },
    [],
    { content: { example: ["model"] }, accessories: {}, bundles: {}, homebrew: {}, "included-only": {} },
  );
  expect(result.unresolved).toEqual([{ handle: "example", reason: "Mapping refers to missing or included-only edition ID retired-id" }]);
  expect(result.sources).toEqual([]);
  expect(result.catalog.content.example).toEqual(catalog.content.example);
});

test("automatic discovery distinguishes a newly named run from an existing listing fallback", () => {
  const catalog: Catalog = {
    content: { example: { name: "Example", handle: "example", tags: ["model"], editions: [{ id: "original-id", label: "First Run" }] } },
    accessories: {},
    bundles: {},
    homebrew: {},
    "included-only": {},
  };
  const result = planUpdate(
    catalog,
    [
      {
        data: listing([variant(1, "US Warehouse"), variant(2, "Encore")]),
        checkedAt: "2026-11-01T00:00:00Z",
        url: "/products/example",
      },
    ],
    {},
    [],
    { content: { example: ["model"] }, accessories: {}, bundles: {}, homebrew: {}, "included-only": {} },
  );
  expect(result.unresolved).toEqual([]);
  expect(result.catalog.content.example?.editions?.map(({ id, label }) => ({ id, label }))).toEqual([
    { id: "original-id", label: "First Run" },
    { id: "encore", label: "Encore" },
  ]);
});

test("direct metadata planning preserves retired aliases without importing their facts", () => {
  const catalog: Catalog = {
    content: {
      example: {
        name: "Example",
        handle: "example",
        tags: ["model"],
        editions: [{ id: "box", label: "Box", format: "physical", prices: [3000] }],
      },
    },
    accessories: {},
    bundles: {},
    homebrew: {},
    "included-only": {},
  };
  const data = listing([variant(1, "US Warehouse", { price: 100 })], { handle: "preorder-example" });
  const result = planUpdate(
    catalog,
    [{ data, checkedAt: "2026-11-01T00:00:00Z", url: "/products/preorder-example" }],
    {
      "preorder-example": { category: "content", itemId: "example", editionId: "box", retired: "Released as /products/example." },
    },
    [],
    { content: { example: ["model"] }, accessories: {}, bundles: {}, homebrew: {}, "included-only": {} },
  );
  expect(result.catalog).toEqual(catalog);
  expect(result.sources).toEqual([]);
  expect(result.unresolved).toEqual([]);
  expect(result.excluded).toEqual([{ handle: "preorder-example", reason: "Retired listing: Released as /products/example." }]);
});

test("snapshot matching rejects a shared listing that cannot distinguish two materials", () => {
  const plastic: Edition = { id: "plastic", label: "Plastic" };
  const resin: Edition = { id: "resin", label: "Resin" };
  const product = listing([variant(1, "US Warehouse"), variant(2, "UK Warehouse")]);
  const ambiguous = availabilityReleases(product, [plastic, resin]);
  expect(ambiguous.get(plastic)).toEqual([]);
  expect(ambiguous.get(resin)).toEqual([]);
  expect(availabilityReleases(product, [resin]).get(resin)).toEqual(product.variants);
});

test("update creation uses material evidence", () => {
  const edition: Edition = { id: "original-box", label: "Box" };
  const item = { name: "Example", tags: [], editions: [edition] };
  const product = listing([variant(1, "US Warehouse")], { description: "<ul><li>Photoresin miniature</li></ul>" });
  const proposed = resolveReleases(item, product, { policy: "update" }).releases[0]!;
  expect(proposed.label).toBe("Photoresin");
  expect(proposed.edition).toBeUndefined();
  expect(edition.id).toBe("original-box");
});

test("retrieved individual product editions contain metadata without snapshot stock or availability", () => {
  for (const available of [false, true]) {
    const result = productEditions(
      { name: "Example", tags: [] },
      listing([variant(1, "First Run / US Warehouse", { available }), variant(2, "Encore", { available })], {
        description: "Photoresin miniature.",
      }),
    );
    expect(result.editions.map((edition) => edition.label)).toEqual(["First Run", "Encore"]);
    for (const edition of result.editions) {
      expect(edition).not.toHaveProperty("available");
      expect(edition).not.toHaveProperty("shop");
      expect(edition.prices).toEqual([3000]);
      expect(edition.materials).toEqual(["Photoresin"]);
    }
  }
});
