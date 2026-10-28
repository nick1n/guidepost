import { expect, test } from "vitest";
import { availabilityReleases, productEditions, resolveReleases } from "#scripts/catalog/releases.mts";
import { normalizeItem } from "#scripts/catalog/normalize.mts";
import type { Edition, Product, Variant } from "#scripts/catalog/types.mts";

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
    { policy: "update", mapping: { category: "content", itemId: "example", edition: "Painters: First Run" } },
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
    mapping: { category: "content", itemId: "example", edition: "Remaster: First Run" },
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
