import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCatalog } from "#scripts/catalog/validate.mts";
import { catalogTemp, catalogCache } from "#scripts/catalog/paths.mts";
import { refreshAvailability } from "#scripts/catalog/commands/refresh-catalog-availability.mts";
import { expect, test } from "vitest";
import { applyTags, checkTags, sortCatalogTags, syncStockTag, tagSchema, type Tags } from "#scripts/catalog/tags.mts";
import { clearChangedListings, listingSnapshot } from "#scripts/catalog/normalize.mts";
import type { Catalog, Item } from "#scripts/catalog/types.mts";

const catalog = (): Catalog => ({ content: {}, accessories: {}, bundles: {}, homebrew: {}, "included-only": {} });

test("stock tags follow any explicit edition and disappear after the last stock observation", () => {
  const item: Item = {
    name: "Example",
    tags: ["model"],
    editions: [
      { label: "Resin", shop: "in-stock" },
      { label: "Plastic", shop: "in-stock" },
    ],
  };
  syncStockTag(item);
  expect(item.tags).toEqual(["model", "in-stock"]);
  item.tags.push("in-stock");
  item.editions![0]!.shop = "out-of-stock";
  syncStockTag(item);
  expect(item.tags).toEqual(["model", "in-stock"]);
  item.editions![1]!.shop = "missing";
  syncStockTag(item);
  expect(item.tags).toEqual(["model"]);
  item.editions![1]!.shop = "in-stock";
  syncStockTag(item);
  delete item.editions![1]!.shop;
  syncStockTag(item);
  expect(item.tags).toEqual(["model"]);
  item.shop = "in-stock";
  item.editions![1]!.available = true;
  syncStockTag(item);
  expect(item.tags).toEqual(["model"]);
  delete item.editions;
  syncStockTag(item);
  expect(item.tags).toEqual(["model"]);
});

test("master assignments cannot override derived stock tags and derived tags participate in frequency sorting", () => {
  const data = catalog();
  data.content.a = { name: "A", tags: [], editions: [{ label: "Resin", shop: "in-stock" }] };
  data.content.b = { name: "B", tags: [], editions: [{ label: "Resin", shop: "in-stock" }] };
  data.content.c = { name: "C", tags: [] };
  const tags: Tags = {
    content: { a: ["z-rare"], b: ["b"], c: ["c", "in-stock"] },
    accessories: {},
    bundles: {},
    homebrew: {},
    "included-only": {},
  };
  applyTags(data, tags);
  expect(data.content.a!.tags).toEqual(["in-stock", "z-rare"]);
  expect(data.content.c!.tags).toEqual(["c"]);
  expect(() => checkTags(data, tags)).not.toThrow();
  const before = structuredClone(data);
  sortCatalogTags(data);
  expect(data).toEqual(before);
  expect(tagSchema(["z", "in-stock", "a"]).$defs.tag.enum).toEqual(["a", "in-stock", "z"]);
});

test("changing the last stocked listing immediately clears its derived tag", () => {
  const item: Item = {
    name: "Example",
    tags: ["model", "in-stock"],
    handle: "old",
    editions: [{ id: "resin", label: "Resin", shop: "in-stock" }],
  };
  const before = listingSnapshot(item);
  item.handle = "replacement";
  clearChangedListings(item, before);
  expect(item.tags).toEqual(["model"]);
});

test("validation rejects missing and spurious derived stock tags", async () => {
  for (const inStock of [true, false]) {
    const data = catalog();
    data.content.example = {
      name: "Example",
      kind: "model",
      tags: inStock ? ["model"] : ["model", "in-stock"],
      editions: [{ id: "resin", label: "Resin", format: "physical", materials: ["Resin"], shop: inStock ? "in-stock" : "out-of-stock" }],
    };
    await expect(validateCatalog(data)).rejects.toThrow("Derived in-stock tag must match explicit edition shop states: content/example");
  }
});

test("offline refresh publishes tag-only repairs when cached stock and date are unchanged", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-stock-repair-"));
  try {
    const directory = join(workspace, "static/kdm/catalog");
    const path = join(directory, "data.json");
    const folder = join(catalogCache(directory), "shopify-products");
    await mkdir(directory, { recursive: true });
    await mkdir(folder, { recursive: true });
    const page = join(folder, "products-page-1.json");
    await writeFile(
      page,
      JSON.stringify({
        products: [
          {
            id: 1,
            title: "Example",
            handle: "example",
            description: "",
            variants: [
              { id: 1, title: "Resin", price: "30.00", compare_at_price: null, requires_shipping: true, sku: "", available: true },
            ],
          },
        ],
      }),
    );
    const date = new Date("2026-10-01T00:00:00Z");
    await utimes(page, date, date);
    await writeFile(join(folder, "products-page-2.json"), JSON.stringify({ products: [] }));
    await utimes(join(folder, "products-page-2.json"), date, date);
    const data = catalog();
    data.shopUpdated = "2026-10-01";
    data.content.example = {
      name: "Example",
      tags: ["model"],
      handle: "example",
      editions: [{ label: "Resin", available: true, shop: "in-stock" }],
    };
    await writeFile(path, JSON.stringify(data));
    const result = await refreshAvailability({ catalog: path, offline: true });
    expect(result.changed).toBe(0);
    expect(result.shopChanged).toBe(0);
    expect(result.tagsChanged).toBe(1);
    expect(JSON.parse(await readFile(path, "utf8")).content.example.tags).toEqual(["in-stock", "model"]);
    expect((await refreshAvailability({ catalog: path, offline: true })).tagsChanged).toBe(0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("offline refresh publishes sort-only tag repairs when cached stock and date are unchanged", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-stock-sort-repair-"));
  try {
    const directory = join(workspace, "static/kdm/catalog");
    const path = join(directory, "data.json");
    const folder = join(catalogCache(directory), "shopify-products");
    await mkdir(folder, { recursive: true });
    await mkdir(directory, { recursive: true });
    const page = join(folder, "products-page-1.json");
    await writeFile(
      page,
      JSON.stringify({
        products: [
          {
            id: 1,
            title: "Example",
            handle: "example",
            description: "",
            variants: [
              { id: 1, title: "Resin", price: "30.00", compare_at_price: null, requires_shipping: true, sku: "", available: true },
            ],
          },
        ],
      }),
    );
    const date = new Date("2026-10-01T00:00:00Z");
    await utimes(page, date, date);
    await writeFile(join(folder, "products-page-2.json"), JSON.stringify({ products: [] }));
    await utimes(join(folder, "products-page-2.json"), date, date);
    const data = catalog();
    data.shopUpdated = "2026-10-01";
    data.content.example = {
      name: "Example",
      tags: ["model", "in-stock"],
      handle: "example",
      editions: [{ label: "Resin", available: true, shop: "in-stock" }],
    };
    await writeFile(path, JSON.stringify(data));
    const result = await refreshAvailability({ catalog: path, offline: true });
    expect(result.changed).toBe(0);
    expect(result.shopChanged).toBe(0);
    expect(result.tagsChanged).toBe(1);
    expect(JSON.parse(await readFile(path, "utf8")).content.example.tags).toEqual(["in-stock", "model"]);
    expect((await refreshAvailability({ catalog: path, offline: true })).tagsChanged).toBe(0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
