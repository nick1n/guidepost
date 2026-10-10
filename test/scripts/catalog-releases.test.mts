import { expect, test } from "vitest";
import { availabilityReleases, productEditions, resolveReleases } from "#scripts/catalog/releases.mts";
import type { Edition, Product, Variant } from "#scripts/catalog/types.mts";

function variant(id: number, title: string, facts: Partial<Variant> = {}): Variant {
  return { id, title, price: 3000, compare_at_price: null, requires_shipping: true, sku: "", ...facts };
}

function listing(variants: Variant[], facts: Partial<Product> = {}): Product {
  return { id: 1, title: "Example", handle: "example", description: "", variants, ...facts };
}

test("curated selectors group warehouses under the existing edition without reassigning its permanent ID", () => {
  const edition: Edition = { id: "original-release", label: "Renamed release", prices: [2000, 4000] };
  const result = resolveReleases(
    { name: "Example", tags: [], editions: [edition] },
    listing([variant(1, "US Warehouse"), variant(2, "UK Warehouse", { price: 3200 }), variant(3, "Another release")]),
    {
      policy: "update",
      mapping: { category: "content", itemId: "example", variantIds: [1, 2], variantEditions: { 1: edition.label, 2: edition.label } },
    },
  );
  expect(result.releases).toHaveLength(1);
  expect(result.releases[0]!.edition).toBe(edition);
  expect(edition.id).toBe("original-release");
  expect(result.releases[0]!.variants.map((value) => value.id)).toEqual([1, 2]);
  expect(result.releases[0]!.prices).toEqual([2000, 3000, 3200]);
});

test("retrieval distinguishes warehouse fallbacks, named physical releases, and digital variants", () => {
  const result = productEditions(
    { name: "Example", tags: [] },
    listing([variant(1, "US Warehouse"), variant(2, "Special sculpt"), variant(3, "Digital", { requires_shipping: false })], {
      description: "PVC miniature.",
    }),
  );
  expect(result.selectors).toEqual({ 1: "PVC", 2: "Special sculpt", 3: "Sim" });
  expect(result.editions.map(({ id, label, materials }) => ({ id, label, materials }))).toEqual([
    { id: "pvc", label: "PVC", materials: undefined },
    { id: "special-sculpt", label: "Special sculpt", materials: ["PVC"] },
    { id: "sim", label: "Sim", materials: undefined },
  ]);
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

test("observed availability uses known standard editions while update creation uses material evidence", () => {
  const edition: Edition = { id: "original-box", label: "Box" };
  const item = { name: "Example", tags: [], editions: [edition] };
  const product = listing([variant(1, "US Warehouse")], { description: "<ul><li>Photoresin miniature</li></ul>" });
  expect(resolveReleases(item, product, { policy: "observe" }).releases[0]!.edition).toBe(edition);
  const proposed = resolveReleases(item, product, { policy: "update" }).releases[0]!;
  expect(proposed.label).toBe("Photoresin");
  expect(proposed.edition).toBeUndefined();
  expect(edition.id).toBe("original-box");
});
