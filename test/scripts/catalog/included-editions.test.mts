import { expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { availabilityFromUrls } from "#scripts/catalog/availability.mts";
import { normalizeItem } from "#scripts/catalog/normalize.mts";
import { availabilityReleases, resolveReleases } from "#scripts/catalog/releases.mts";
import { validateCatalog } from "#scripts/catalog/validate.mts";
import { buildWorkbookMap } from "#scripts/catalog/workbook/map.mts";
import type { WorkbookImports } from "#scripts/catalog/workbook/imports.mts";
import { planUpdate } from "#scripts/catalog/update.mts";
import { categories, type Catalog, type Product } from "#scripts/catalog/types.mts";
import type { Tags } from "#scripts/catalog/tags.mts";

function catalog(): Catalog {
  return {
    content: {
      core: {
        name: "Core",
        tags: ["core"],
        kind: "core",
        editions: [{ id: "1-6", label: "1.6", format: "physical", releaseDate: "2021-11-26" }],
        includes: [{ item: "rulebook", editionId: "1-6-included", parentEditionIds: ["1-6"] }],
      },
    },
    accessories: {
      rulebook: {
        name: "Rulebook",
        tags: ["rulebook"],
        kind: "accessory",
        accessoryType: "other",
        editions: [
          { id: "1-6-included", label: "1.6", format: "physical", releaseDate: "2021-11-26", includedOnly: true },
          { id: "1-6", label: "1.6", format: "physical", prices: [4000], releaseDate: "2021-12-16", handle: "rulebook" },
        ],
      },
    },
    "included-only": {},
    bundles: {},
    homebrew: {},
  };
}

const product: Product = {
  id: 1,
  title: "Rulebook",
  handle: "rulebook",
  description: "",
  variants: [{ id: 10, title: "US Warehouse", price: 4500, compare_at_price: null, requires_shipping: true, sku: "", available: true }],
};
const imports: WorkbookImports = {
  workbook: "Collection.xlsx",
  records: [{ sheet: "KDM Miniatures", row: 2, name: "Rulebook", category: "accessories", itemId: "rulebook", editionId: "1-6" }],
};

test("duplicate labels retain ID-based references, uniqueness checks, and chronological validation", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-included-editions-"));
  try {
    const root = join(workspace, "static/kdm/catalog");
    await mkdir(root, { recursive: true });
    const schemaPath = join(root, "data.schema.json");
    await writeFile(schemaPath, await readFile("static/kdm/catalog/data.schema.json", "utf8"));
    const data = catalog();
    expect((await validateCatalog(data, schemaPath)).editions).toBe(3);
    const fakePrice = structuredClone(data);
    fakePrice.accessories.rulebook!.editions![0]!.prices = [0];
    await expect(validateCatalog(fakePrice, schemaPath)).rejects.toThrow("Catalog schema errors");
    const unconfirmed = structuredClone(data);
    delete unconfirmed.accessories.rulebook!.editions![0]!.includedOnly;
    expect((await validateCatalog(unconfirmed, schemaPath)).editions).toBe(3);
    Object.assign(unconfirmed.accessories.rulebook!.editions![0]!, { includedOnly: false });
    await expect(validateCatalog(unconfirmed, schemaPath)).rejects.toThrow("Catalog schema errors");
    data.accessories.rulebook!.editions!.reverse();
    await expect(validateCatalog(data, schemaPath)).rejects.toThrow("Editions are out of release order");
    data.accessories.rulebook!.editions!.reverse();
    data.accessories.rulebook!.editions![1]!.id = "1-6-included";
    await expect(validateCatalog(data, schemaPath)).rejects.toThrow("Duplicate edition ID");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("shop resolution targets the standalone release regardless of edition order", () => {
  const book = catalog().accessories.rulebook!;
  for (const editions of [book.editions!, book.editions!.toReversed()]) {
    const result = resolveReleases({ ...book, editions }, product, {
      policy: "update",
      mapping: { category: "accessories", itemId: "rulebook", editionId: "1-6" },
    });
    expect(result.releases[0]!.edition?.id).toBe("1-6");
    expect(result.releases[0]!.prices).toEqual([4000, 4500]);
  }
});

test("shop matching rejects ambiguous standalone labels instead of choosing the first edition", () => {
  const book = catalog().accessories.rulebook!;
  book.editions!.push({ id: "another-standalone", label: "1.6", format: "physical" });
  expect(() =>
    resolveReleases(book, product, {
      policy: "update",
      mapping: { category: "accessories", itemId: "rulebook", editionLabel: "1.6" },
    }),
  ).toThrow("Ambiguous edition label");
});

test("shared listings never make included editions purchasable or ambiguous for standalone availability", () => {
  const data = catalog();
  const book = data.accessories.rulebook!;
  book.handle = "rulebook";
  const [included, standalone] = book.editions!;
  Object.assign(included!, { available: true });
  const releases = availabilityReleases(product, book.editions!);
  expect(releases.get(included!)).toEqual([]);
  expect(releases.get(standalone!)).toEqual(product.variants);
  availabilityFromUrls(data, [product]);
  expect(included!.available).toBeUndefined();
  expect(standalone!.available).toBe(true);
});

test("catalog updates preserve included component identity and facts without inventing a price", () => {
  const data = catalog();
  const included = structuredClone(data.accessories.rulebook!.editions![0]!);
  const tags = Object.fromEntries(
    categories.map((category) => [category, Object.fromEntries(Object.entries(data[category]).map(([id, item]) => [id, item.tags]))]),
  ) as Tags;
  const result = planUpdate(
    data,
    [{ data: product, url: "https://shop.kingdomdeath.com/products/rulebook.js", checkedAt: "2026-10-14T00:00:00Z" }],
    {
      rulebook: { category: "accessories", itemId: "rulebook", editionId: "1-6" },
    },
    [],
    tags,
  );
  expect(result.catalog.accessories.rulebook!.editions!.find((edition) => edition.id === included.id)).toEqual(included);
  expect(result.catalog.accessories.rulebook!.editions!.find((edition) => edition.id === included.id)?.prices).toBeUndefined();
  expect(result.catalog.accessories.rulebook!.editions!.find((edition) => edition.id === "1-6")?.prices).toEqual([4000, 4500]);
});

test("workbook edition IDs select standalone and included editions regardless of order", () => {
  const original = catalog();
  const book = original.accessories.rulebook!;
  const orders = [book.editions!, book.editions!.toReversed()];

  for (const editionId of ["1-6", "1-6-included"]) {
    const source = structuredClone(imports);
    source.records[0]!.editionId = editionId;

    for (const editions of orders) {
      const data = structuredClone(original);
      data.accessories.rulebook!.editions = structuredClone(editions);
      const regenerated = buildWorkbookMap(source, data);
      expect(regenerated.rows[0]!.primary.editionId).toBe(editionId);
      expect(buildWorkbookMap(source, data, regenerated).rows[0]!.primary.editionId).toBe(editionId);
    }
  }
});

test("accessory labels describe the containing release without inventing resin construction", () => {
  const book = catalog().accessories.rulebook!;
  book.editions![0]!.label = "Resin";
  normalizeItem(book);
  expect(book.editions![0]!.materials).toBeUndefined();
});

test("Encore date inheritance keeps included and standalone release histories separate", () => {
  const item = {
    name: "Example",
    tags: [],
    editions: [
      { id: "included-first", label: "First Run", releaseDate: "2020-01-01", includedOnly: true as const },
      { id: "first", label: "First Run", releaseDate: "2021-01-01" },
      { id: "included-encore", label: "Encore", includedOnly: true as const },
      { id: "encore", label: "Encore" },
    ],
  };
  normalizeItem(item);
  expect(item.editions.find((edition) => edition.id === "included-encore")?.releaseDate).toBe("2020-01-01");
  expect(item.editions.find((edition) => edition.id === "encore")?.releaseDate).toBe("2021-01-01");
});
