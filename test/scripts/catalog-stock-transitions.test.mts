import { recordStock } from "#scripts/catalog/stock.mts";
import { expect, test } from "vitest";
import { planUpdate } from "#scripts/catalog/update.mts";
import { clearChangedListings, listingSnapshot, normalizeItem } from "#scripts/catalog/normalize.mts";
import type { Catalog, Product } from "#scripts/catalog/types.mts";

function catalog(): Catalog {
  return {
    content: {
      example: {
        name: "Example",
        handle: "current",
        tags: ["model", "in-stock"],
        editions: [{ id: "resin", label: "Resin", available: true, shop: "in-stock" }],
      },
    },
    accessories: {},
    bundles: {},
    homebrew: {},
    "included-only": {},
  };
}

function product(handle: string, available: boolean): Product {
  return {
    id: 1,
    title: "Example",
    handle,
    description: "",
    variants: [{ id: 1, title: "Resin", price: 3000, compare_at_price: null, requires_shipping: true, sku: "", available }],
  };
}

test("listing replacement clears both availability and stock while equivalent normalization retains them", () => {
  const item = catalog().content.example!;
  item.url = "/products/current?variant=1";
  delete item.handle;
  normalizeItem(item);
  expect(item.editions![0]!.available).toBe(true);
  expect(item.editions![0]!.shop).toBe("in-stock");
  const before = listingSnapshot(item);
  item.handle = "replacement";
  clearChangedListings(item, before);
  expect(item.editions![0]!.available).toBeUndefined();
  expect(item.editions![0]!.shop).toBeUndefined();
  expect(item.tags).toEqual(["model"]);
});

test("reviewed listing replacement invalidates stock without trusting individual availability", () => {
  const before = catalog();
  const evidence = [product("old", true), product("replacement", false)].map((data) => ({
    data,
    checkedAt: "2026-10-01T00:00:00Z",
    url: "https://shop.kingdomdeath.com/products/" + data.handle + ".js",
  }));
  const result = planUpdate(
    before,
    evidence,
    {
      old: { category: "content", itemId: "example", edition: "Resin" },
      replacement: { category: "content", itemId: "example", edition: "Resin", replaceUrl: true },
    },
    [],
    { content: { example: ["model"] }, accessories: {}, bundles: {}, homebrew: {}, "included-only": {} },
  );
  expect(result.catalog.content.example!.handle).toBe("replacement");
  expect(result.catalog.content.example!.editions![0]!.shop).toBeUndefined();
  expect(result.catalog.content.example!.editions![0]!.available).toBeUndefined();
  expect(result.catalog.content.example!.tags).toEqual(["model"]);
});

test("new edition identities retain freshly observed evidence when a writer assigns their listing", () => {
  const item = catalog().content.example!;
  delete item.editions;
  const before = listingSnapshot(item);
  item.editions = [{ id: "new-resin", label: "Resin", available: true, shop: "in-stock", handle: "new-release" }];
  delete item.handle;
  clearChangedListings(item, before);
  expect(item.editions[0]!.available).toBe(true);
  expect(item.editions[0]!.shop).toBe("in-stock");
  expect(item.tags).toContain("in-stock");
});

test("recording stock reports independent changes and makes availability policy explicit", () => {
  const target: Parameters<typeof recordStock>[0] = {
    available: true,
    shop: "in-stock",
  };
  expect(recordStock(target, "out-of-stock")).toEqual({ shopChanged: true, availableChanged: false });
  expect(target.available).toBe(true);
  expect(recordStock(target, "out-of-stock", "replace")).toEqual({ shopChanged: false, availableChanged: true });
  expect(target.available).toBeUndefined();
  expect(recordStock(target, undefined, "replace")).toEqual({ shopChanged: true, availableChanged: false });
  expect(target.shop).toBeUndefined();
  expect(recordStock(target, "in-stock", "replace")).toEqual({ shopChanged: true, availableChanged: true });
  expect(recordStock(target, "in-stock", "replace")).toEqual({ shopChanged: false, availableChanged: false });
});

test("individual product metadata preserves snapshot availability and stock for unchanged listings", () => {
  for (const available of [false, true]) {
    for (const state of [undefined, "in-stock", "out-of-stock", "missing"] as const) {
      const before = catalog();
      const edition = before.content.example!.editions![0]!;
      edition.shop = state;
      if (state !== "in-stock") delete edition.available;
      const data = product("current", available);
      data.variants[0]!.price = 4500;
      const result = planUpdate(
        before,
        [{ data, checkedAt: "2026-10-13T00:00:00Z", url: "https://shop.kingdomdeath.com/products/current.js" }],
        { current: { category: "content", itemId: "example", edition: "Resin" } },
        [],
        { content: { example: ["model"] }, accessories: {}, bundles: {}, homebrew: {}, "included-only": {} },
      );
      const updated = result.catalog.content.example!.editions![0]!;
      expect(updated.shop).toBe(state);
      expect(updated.available).toBe(edition.available);
      expect(updated.prices).toEqual([4500]);
    }
  }
});

test("metadata importing creates releases without deriving availability from their individual variants", () => {
  for (const available of [false, true]) {
    const before = catalog();
    const data = product("current", available);
    data.variants.push({ ...data.variants[0]!, id: 2, title: "Encore" });
    const result = planUpdate(
      before,
      [{ data, checkedAt: "2026-10-13T00:00:00Z", url: "https://shop.kingdomdeath.com/products/current.js" }],
      { current: { category: "content", itemId: "example", edition: "Resin" } },
      [],
      { content: { example: ["model"] }, accessories: {}, bundles: {}, homebrew: {}, "included-only": {} },
    );
    const created = result.catalog.content.example!.editions!.find((edition) => edition.label === "Encore");
    expect(created?.prices).toEqual([3000]);
    expect(created).not.toHaveProperty("available");
    expect(created).not.toHaveProperty("shop");
  }
});
