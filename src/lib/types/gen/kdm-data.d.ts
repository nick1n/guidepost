/* Generated from src/lib/schema.json. Do not edit. Run pnpm generate:types to regenerate. */

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
  alt?: string;
  kind: "core" | "beta" | "promo" | "expansion" | "white-box" | "set";
  gameplay: boolean;
  price?: number;
  versions?: Edition[];
  editions?: Edition[];
  tags: string[];
  requires?: string[];
  url?: string;
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
}
export interface Bundles {
  [k: string]: BundleItem;
}
export interface BundleItem {
  name: string;
  price?: number;
  gameplay: boolean;
  tags: string[];
  includes: string[];
  url?: string;
}
