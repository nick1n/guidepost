import { expect, test } from "vitest";
import { applyAvailability, planUpdate } from "#scripts/catalog/update.mts";
import { clearChangedListings, listingSnapshot, normalizeItem } from "#scripts/catalog/normalize.mts";
import type { Catalog, Product, Variant } from "#scripts/catalog/types.mts";

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

test("current listing stock transitions preserve the derived stock tag", () => {
  const data = catalog();
  const edition = data.content.example!.editions![0]!;
  for (const available of [false, true, false]) {
    applyAvailability(data, [product("current", available)]);
    expect(edition.shop).toBe(available ? "in-stock" : "out-of-stock");
    expect(edition.available).toBe(available || undefined);
    expect(data.content.example!.tags.includes("in-stock")).toBe(available);
  }
});

test("historical mappings preserve availability semantics without asserting current stock", () => {
  for (const stock of [undefined, "in-stock", "out-of-stock", "missing"] as const) {
    const data = catalog();
    data.content.example!.editions![0]!.shop = stock;
    const mappings = { old: { category: "content" as const, itemId: "example", edition: "Resin" } };
    applyAvailability(data, [product("old", true)], mappings);
    expect(data.content.example!.editions![0]!.available).toBe(true);
    expect(data.content.example!.editions![0]!.shop).toBe(stock);
    expect(data.content.example!.tags.includes("in-stock")).toBe(stock === "in-stock");
  }
});

test("historical evidence cannot override current listing stock in either order", () => {
  for (const listings of [
    [product("old", true), product("current", false)],
    [product("current", false), product("old", true)],
  ]) {
    const data = catalog();
    applyAvailability(data, listings, { old: { category: "content", itemId: "example", edition: "Resin" } });
    expect(data.content.example!.editions![0]!.shop).toBe("out-of-stock");
    expect(data.content.example!.tags).toEqual(["model"]);
  }
});

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

test("reviewed replacement uses new listing stock despite retained historical mapping", () => {
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
  expect(result.catalog.content.example!.editions![0]!.shop).toBe("out-of-stock");
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

test("partial warehouse evidence cannot assert that the current listing is sold out", () => {
  const data = catalog();
  const edition = data.content.example!.editions![0]!;
  edition.shop = "missing";
  const listing = product("current", false);
  const unknown: Variant = { ...listing.variants[0]!, id: 2 };
  delete unknown.available;
  listing.variants.push(unknown);
  applyAvailability(data, [listing]);
  expect(edition.shop).toBe("missing");
  expect(data.content.example!.tags).toEqual(["model"]);
  unknown.available = true;
  applyAvailability(data, [listing]);
  expect(edition.shop).toBe("in-stock");
  expect(data.content.example!.tags).toEqual(["in-stock", "model"]);
});
