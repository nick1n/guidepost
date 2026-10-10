import { describe, expect, it } from "vitest";
import { decodeShopCache, decodeShopProduct, ShopDecodeError } from "#scripts/catalog/shop-schema.mts";

const variant = { id: 2, title: "Default", requires_shipping: true, price: "12.50", compare_at_price: "", extra: "retained" };
const product = { id: 1, title: "Product", handle: "product", variants: [variant], vendor: "Kingdom Death" };
const envelope = { url: "https://shop.kingdomdeath.com/products/product.json", checkedAt: "2026-10-10T00:00:00.000Z" };

describe("shop product schema", () => {
  it("normalizes JSON dollars, empty compare prices and missing SKU while preserving extra fields", () => {
    expect(decodeShopProduct({ product: { ...product, body_html: "Body", description: "Fallback" } })).toEqual({
      ...product,
      body_html: "Body",
      description: "Body",
      variants: [{ ...variant, sku: "", price: 1250, compare_at_price: null }],
    });
  });
  it("normalizes Ajax cents and uses description when body_html is null", () => {
    expect(
      decodeShopProduct(
        { ...product, body_html: null, description: "Ajax", variants: [{ ...variant, price: 1250, compare_at_price: 1500, sku: "sku" }] },
        "ajax",
      ).variants[0],
    ).toMatchObject({ price: 1250, compare_at_price: 1500, sku: "sku" });
    expect(decodeShopProduct({ ...product, body_html: null, description: "Ajax" }).description).toBe("Ajax");
  });
  it("accepts a null envelope product as a direct payload and defaults descriptions", () => {
    expect(decodeShopProduct({ ...product, product: null }).description).toBe("");
  });
  it.each([null, [], { ...product, variants: [{}] }, { ...product, description: 12 }, { ...product, id: Infinity }])(
    "rejects malformed product %j",
    (value) => {
      expect(() => decodeShopProduct(value)).toThrow(ShopDecodeError);
    },
  );
  it.each(["-1", "1.234", "", "NaN", Number.MAX_SAFE_INTEGER])("rejects invalid JSON prices %j", (price) => {
    expect(() => decodeShopProduct({ ...product, variants: [{ ...variant, price }] })).toThrow(ShopDecodeError);
  });
  it("preserves feature error messages", () => {
    expect(() => decodeShopProduct({ ...product, variants: [{}] })).toThrow("Invalid shop product variant");
    expect(() => decodeShopProduct({ ...product, variants: [{ ...variant, price: "oops" }] })).toThrow("Invalid shop price");
  });
  it("rejects fractional Ajax cents and malformed compare prices", () => {
    expect(() => decodeShopProduct({ ...product, variants: [{ ...variant, price: "12.50" }] }, "ajax")).toThrow(ShopDecodeError);
    expect(() => decodeShopProduct({ ...product, variants: [{ ...variant, compare_at_price: "oops" }] })).toThrow(ShopDecodeError);
  });
});

describe("shop cache schema", () => {
  it("decodes success JSON and cached HTTP failures", () => {
    expect(decodeShopCache({ ...envelope, data: { product } })).toEqual({ ...envelope, data: { product } });
    expect(decodeShopCache({ ...envelope, checkedAt: "2020-01-01T00:00:00Z", data: null })).toMatchObject({
      checkedAt: "2020-01-01T00:00:00Z",
    });
    expect(decodeShopCache({ ...envelope, status: 404 })).toEqual({ ...envelope, status: 404 });
  });
  it.each([
    { ...envelope },
    { ...envelope, data: {}, status: 404 },
    { ...envelope, status: 200 },
    { ...envelope, status: 600 },
    { ...envelope, status: "404" },
    { ...envelope, status: 404.5 },
    { ...envelope, checkedAt: "2026-02-30T00:00:00.000Z", data: {} },
    { ...envelope, checkedAt: "today", data: {} },
    { ...envelope, url: "https://example.com/products/product", data: {} },
    { ...envelope, data: undefined },
  ])("rejects malformed cache envelope %j", (value) => {
    expect(() => decodeShopCache(value)).toThrow(ShopDecodeError);
  });
});
