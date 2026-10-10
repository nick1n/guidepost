import { Schema } from "effect";
import type { Product } from "./types.mts";

export class ShopDecodeError extends Schema.TaggedError<ShopDecodeError>()("ShopDecodeError", {
  message: Schema.String,
  cause: Schema.Defect(),
}) {}

const extras = Schema.Record(Schema.String, Schema.Unknown);
const record = Schema.decodeUnknownSync(extras);
const price = Schema.Union([Schema.String, Schema.Finite]).check(
  Schema.makeFilter((value) => /^\d+(?:\.\d{1,2})?$/.test(String(value)), {
    expected: "a nonnegative price with at most two decimal places",
  }),
);
const cents = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER));
const variant = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.Finite,
    title: Schema.String,
    requires_shipping: Schema.Boolean,
    price: Schema.Unknown,
    compare_at_price: Schema.optional(Schema.Unknown),
    sku: Schema.optional(Schema.Unknown),
  }),
  [extras],
);
const product = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.Finite,
    title: Schema.String,
    handle: Schema.String,
    body_html: Schema.optional(Schema.Unknown),
    description: Schema.optional(Schema.Unknown),
    variants: Schema.Array(Schema.Unknown),
  }),
  [extras],
);
const decodeVariant = Schema.decodeUnknownSync(variant);
const decodePrice = Schema.decodeUnknownSync(price);
const decodeProduct = Schema.decodeUnknownSync(product);
const decodeDescription = Schema.decodeUnknownSync(Schema.String);
const decodeCents = Schema.decodeUnknownSync(cents);

export function decodeShopProduct(value: unknown, format: "json" | "ajax" = "json"): Product {
  try {
    const response = record(value);
    // Empty compare prices are accepted by both Shopify response formats.
    const payload = record(response.product ?? response);
    const parsed = decodeProduct(payload);
    const amount = (value: unknown) => {
      try {
        const parsed = decodePrice(value);
        return decodeCents(format === "ajax" ? Number(parsed) : Math.round(Number(parsed) * 100));
      } catch (cause) {
        throw new ShopDecodeError({ message: "Invalid shop price: " + String(value), cause });
      }
    };
    const description = (() => {
      try {
        return decodeDescription(parsed.body_html ?? parsed.description ?? "");
      } catch (cause) {
        throw new ShopDecodeError({ message: "Invalid shop product description", cause });
      }
    })();
    return {
      ...parsed,
      description,
      variants: parsed.variants.map((value) => {
        let parsed;
        try {
          parsed = decodeVariant(value);
        } catch (cause) {
          throw new ShopDecodeError({ message: "Invalid shop product variant", cause });
        }
        return {
          ...parsed,
          sku: typeof parsed.sku === "string" ? parsed.sku : "",
          price: amount(parsed.price),
          compare_at_price: parsed.compare_at_price == null || parsed.compare_at_price === "" ? null : amount(parsed.compare_at_price),
        };
      }),
    };
  } catch (cause) {
    if (cause instanceof ShopDecodeError) throw cause;
    throw new ShopDecodeError({ message: "Invalid shop product JSON", cause });
  }
}

const checkedAt = Schema.String.check(
  Schema.makeFilter(
    (value) => {
      const parsed = Date.parse(value);
      return (
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
        Number.isFinite(parsed) &&
        new Date(parsed).toISOString() === value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z")
      );
    },
    { expected: "an ISO UTC timestamp" },
  ),
);
const url = Schema.String.check(
  Schema.makeFilter(
    (value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" && parsed.hostname === "shop.kingdomdeath.com" && !parsed.username && !parsed.password;
      } catch {
        return false;
      }
    },
    { expected: "an HTTPS Kingdom Death shop URL" },
  ),
);
export const ShopResponse = Schema.Struct({ url, checkedAt, data: Schema.Json });
export interface ShopResponse extends Schema.Schema.Type<typeof ShopResponse> {}
export const ShopFailure = Schema.Struct({
  url,
  checkedAt,
  status: Schema.Int.check(
    Schema.isGreaterThanOrEqualTo(100),
    Schema.isLessThanOrEqualTo(599),
    Schema.makeFilter((value) => value < 200 || value >= 300, { expected: "an unsuccessful HTTP status" }),
  ),
});
export interface ShopFailure extends Schema.Schema.Type<typeof ShopFailure> {}
export const ShopCache = Schema.Union([ShopResponse, ShopFailure]);
export type ShopCache = typeof ShopCache.Type;
const decodeCache = Schema.decodeUnknownSync(ShopCache, { onExcessProperty: "error" });

export function decodeShopCache(value: unknown): ShopCache {
  try {
    return decodeCache(value);
  } catch (cause) {
    throw new ShopDecodeError({ message: "Invalid cached shop response", cause });
  }
}
