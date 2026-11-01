import { expect, it } from "vitest";
import { planUpdate } from "#scripts/catalog/update.mts";
import type { Catalog, Item, Mapping, Product } from "#scripts/catalog/types.mts";

const product = (titles = ["US Warehouse"]): Product => ({
  id: 1,
  title: "Example",
  handle: "example",
  description: "",
  variants: titles.map((title, index) => ({ id: index + 1, title, price: 3000, compare_at_price: null, requires_shipping: true, sku: "" })),
});

function update(item: Item, data = product(), mapping?: Mapping, category: "content" | "bundles" = "content") {
  const catalog: Catalog = { content: {}, bundles: {}, accessories: {}, homebrew: {}, "included-only": {} };
  catalog[category].example = item;
  const tags = { content: {}, bundles: {}, accessories: {}, homebrew: {}, "included-only": {}, [category]: { example: item.tags } };
  return planUpdate(
    catalog,
    [{ data, url: "/products/example", checkedAt: "2026-11-01T00:00:00Z" }],
    mapping ? { example: mapping } : {},
    [],
    tags,
  );
}

it("item-only mappings retain existing bust run identities", () => {
  const item: Item = {
    name: "Example",
    tags: ["model"],
    editions: [
      { id: "bust-original", label: "Bust: First Run", handle: "example", prices: [2000] },
      { id: "bust-encore", label: "Bust: Encore", handle: "example", prices: [2500] },
    ],
  };
  const result = update(item, product(["First Run / US Warehouse", "Encore / US Warehouse"]), { category: "content", itemId: "example" });
  expect(result.unresolved).toEqual([]);
  expect(result.catalog.content.example?.editions?.map((edition) => edition.id)).toEqual(["bust-original", "bust-encore"]);
});

it("uses the existing listing identity for unnamed warehouse variants", () => {
  const result = update({ name: "Example", tags: ["model"], handle: "example", editions: [{ id: "original-plastic", label: "Plastic" }] });
  expect(result.unresolved).toEqual([]);
  expect(result.catalog.content.example?.editions?.map((edition) => edition.id)).toEqual(["original-plastic"]);
});

it("requires review before interpreting an aggregate material edition as a new run", () => {
  const result = update(
    { name: "Example", tags: ["model"], handle: "example", editions: [{ id: "resin", label: "Photoresin" }] },
    product(["Encore"]),
  );
  expect(result.unresolved).toContainEqual(
    expect.objectContaining({ handle: "example", reason: expect.stringMatching(/edition.*review|review.*edition/i) }),
  );
  expect(result.catalog.content.example?.editions?.map((edition) => edition.id)).toEqual(["resin"]);
});

it("requires review when a shared listing cannot distinguish existing materials", () => {
  const result = update({
    name: "Example",
    tags: ["model"],
    handle: "example",
    editions: [
      { id: "plastic", label: "Plastic" },
      { id: "resin", label: "Resin" },
    ],
  });
  expect(result.unresolved).toHaveLength(1);
  expect(result.catalog.content.example?.editions).toHaveLength(2);
});

it("keeps edition-less bundles on their synthetic bundle identity", () => {
  const result = update(
    { name: "Example", tags: ["bundle"], price: 2000, handle: "example" },
    product(),
    { category: "bundles", itemId: "example" },
    "bundles",
  );
  expect(result.unresolved).toEqual([]);
  expect(result.catalog.bundles.example?.editions).toBeUndefined();
  expect(result.catalog.bundles.example?.price).toBe(3000);
});

it("groups announcement dates by normalized shop handle without mixing products", () => {
  const catalog: Catalog = {
    content: {
      example: {
        name: "Example",
        tags: ["model"],
        handle: "example",
        announcements: ["2020-01-01"],
        editions: [{ id: "box", label: "Box" }],
      },
      other: { name: "Other", tags: ["model"], handle: "other", editions: [{ id: "box", label: "Box" }] },
    },
    accessories: {},
    bundles: {},
    homebrew: {},
    "included-only": {},
  };
  const links = [
    ["/products/example?variant=1", "2026-01-01"],
    ["https://shop.kingdomdeath.com/collections/all/products/example", "2024-01-01"],
    ["http://shop.kingdomdeath.com/en-us/products/example.json", "2025-01-01"],
    ["/products/example.js", "2025-01-01"],
    ["https://example.org/products/example", "1900-01-01"],
    ["/collections/all", "1900-01-01"],
    ["/products/other", "2022-01-01"],
  ] as const;
  const result = planUpdate(
    catalog,
    [product(), { ...product(), id: 2, title: "Other", handle: "other" }].map((data) => ({
      data,
      url: "/products/" + data.handle,
      checkedAt: "2026-11-01T00:00:00Z",
    })),
    {},
    links.map(([shopUrl, date]) => ({ shopUrl, date, postUrl: "https://kingdomdeath.com/news/example", itemName: "Announcement" })),
    {
      content: { example: ["model"], other: ["model"] },
      accessories: {},
      bundles: {},
      homebrew: {},
      "included-only": {},
    },
  );
  expect(result.catalog.content.example?.announcements).toEqual(["2020-01-01", "2024-01-01", "2025-01-01", "2026-01-01"]);
  expect(result.catalog.content.other?.announcements).toEqual(["2022-01-01"]);
  expect(catalog.content.example?.announcements).toEqual(["2020-01-01"]);
  expect(result.warnings).toEqual([]);
});
