/* Generated from src/lib/schema.json. Do not edit. Run pnpm generate:types to regenerate. */

/**
 * Latest HEAD check: true for HTTP 2xx after redirects, false for HTTP or request errors, null when no URL exists. Omitted until checked.
 */
export type ShopReachable = boolean | null;

export interface KingdomDeathCatalog {
  $schema?: string;
  content: Content;
  dice: Dice;
  bundles: Bundles;
  homebrew: Content;
}
export interface Content {
  [k: string]: ContentItem;
}
export interface ContentItem {
  name: string;
  /**
   * Alternative or corrected name.
   */
  alt?: string;
  /**
   * Item description.
   */
  desc?: string;
  kind: "core" | "beta" | "promo" | "expansion" | "white-box" | "set" | "model" | "base" | "terrain" | "accessory";
  gameplay: boolean;
  price?: number;
  currency?: "USD" | "EUR";
  priceMinimum?: boolean;
  versions?: Edition[];
  editions?: Edition[];
  tags: string[];
  requires?: string[];
  url?: string;
  shopReachable?: ShopReachable;
}
export interface Edition {
  v: string;
  $: number[];
  limit?: boolean;
  r?: string;
}
export interface Dice {
  [k: string]: DiceItem;
}
export interface DiceItem {
  name: string;
  price?: number;
  currency?: "USD" | "EUR";
  /**
   * @minItems 2
   * @maxItems 2
   */
  colors: [string, string];
  /**
   * @minItems 2
   * @maxItems 2
   */
  text: [string, string];
  tags: string[];
  url?: string;
  shopReachable?: ShopReachable;
}
export interface Bundles {
  [k: string]: BundleItem;
}
export interface BundleItem {
  name: string;
  price?: number;
  currency?: "USD" | "EUR";
  gameplay: boolean;
  tags: string[];
  includes: string[];
  url?: string;
  shopReachable?: ShopReachable;
}
