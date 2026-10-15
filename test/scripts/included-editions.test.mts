import { expect, test } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { availabilityFromUrls } from "#scripts/catalog/availability.mts";
import { normalizeItem } from "#scripts/catalog/normalize.mts";
import { availabilityReleases, resolveReleases } from "#scripts/catalog/releases.mts";
import { validateCatalog } from "#scripts/catalog/validate.mts";
import { buildWorkbookMap, type WorkbookImports } from "#scripts/catalog/workbook.mts";
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
          { id: "1-6-included", label: "1.6", format: "physical", prices: [0], releaseDate: "2021-11-26", includedOnly: true },
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
  records: [{ sheet: "KDM Miniatures", row: 2, name: "Rulebook", category: "accessories", itemId: "rulebook", edition: "1.6" }],
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

test.each(["update", "observe"] as const)("%s shop resolution targets the standalone release regardless of edition order", (policy) => {
  const book = catalog().accessories.rulebook!;
  for (const editions of [book.editions!, book.editions!.toReversed()]) {
    const result = resolveReleases({ ...book, editions }, product, {
      policy,
      mapping: { category: "accessories", itemId: "rulebook", edition: "1.6" },
    });
    expect(result.releases[0]!.edition?.id).toBe("1-6");
    expect(result.releases[0]!.prices).toEqual([4500]);
  }
});

test("shop matching rejects ambiguous standalone labels instead of choosing the first edition", () => {
  const book = catalog().accessories.rulebook!;
  book.editions!.push({ id: "another-standalone", label: "1.6", format: "physical" });
  expect(() =>
    resolveReleases(book, product, {
      policy: "update",
      mapping: { category: "accessories", itemId: "rulebook", edition: "1.6" },
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

test("catalog updates preserve included component identity, price, and facts", () => {
  const data = catalog();
  const included = structuredClone(data.accessories.rulebook!.editions![0]!);
  const tags = Object.fromEntries(
    categories.map((category) => [category, Object.fromEntries(Object.entries(data[category]).map(([id, item]) => [id, item.tags]))]),
  ) as Tags;
  const result = planUpdate(
    data,
    [{ data: product, url: "https://shop.kingdomdeath.com/products/rulebook.js", checkedAt: "2026-10-14T00:00:00Z" }],
    {
      rulebook: { category: "accessories", itemId: "rulebook", edition: "1.6" },
    },
    [],
    tags,
  );
  expect(result.catalog.accessories.rulebook!.editions!.find((edition) => edition.id === included.id)).toEqual(included);
  expect(result.catalog.accessories.rulebook!.editions!.find((edition) => edition.id === "1-6")?.prices).toEqual([4500]);
});

test("new workbook label references prefer standalone editions, while previous maps retain either ID", () => {
  const data = catalog();
  const previous = buildWorkbookMap(imports, data);
  expect(previous.rows[0]!.primary.editionId).toBe("1-6");
  data.accessories.rulebook!.editions!.reverse();
  expect(buildWorkbookMap(imports, data, previous).rows[0]!.primary.editionId).toBe("1-6");
  const includedMap = {
    ...previous,
    rows: previous.rows.map((row) => ({ ...row, primary: { ...row.primary, editionId: "1-6-included" } })),
  };
  expect(buildWorkbookMap(imports, data, includedMap).rows[0]!.primary.editionId).toBe("1-6-included");
});

test("unmapped duplicate workbook choices fail and missing mapped IDs require review", () => {
  const data = catalog();
  const previous = buildWorkbookMap(imports, data);
  data.accessories.rulebook!.editions!.push({ id: "another-standalone", label: "1.6", format: "physical" });
  expect(() => buildWorkbookMap(imports, data)).toThrow("Ambiguous edition label");
  expect(buildWorkbookMap(imports, data, previous).rows[0]!.primary.editionId).toBe("1-6");
  data.accessories.rulebook!.editions = data.accessories.rulebook!.editions!.filter((edition) => edition.id !== "1-6");
  expect(() => buildWorkbookMap(imports, data, previous)).toThrow("Mapped edition disappeared");
});

test("a unique included workbook reference remains supported", () => {
  const data = catalog();
  data.accessories.rulebook!.editions = data.accessories.rulebook!.editions!.filter((edition) => edition.includedOnly);
  expect(buildWorkbookMap(imports, data).rows[0]!.primary.editionId).toBe("1-6-included");
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
