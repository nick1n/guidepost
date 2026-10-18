/* Generated from static/kdm/catalog/data.schema.json. Do not edit. Run pnpm generate:types to regenerate. */

export type Content = Record<string, Item>;
/**
 * News publication date, YYYY-MM-DD. Full post details remain in scripts/news/shop-links.json.
 */
export type Announcement = string;
export type Edition = {
  id: EditionId;
  /**
   * Display label, such as First Run, Encore, Plastic, or Sim. Labels may repeat; the edition ID supplies identity and includedOnly supplies inclusion status.
   */
  label: string;
  /**
   * Available in at least one matching cached shop variant. False by default; omit when unavailable or unknown.
   */
  available?: true;
  /**
   * Beta release. Omit for non-Beta editions.
   */
  beta?: true;
  /**
   * Alternative recipes that provide this edition's content. Each alternative requires every referenced edition. Missing overrides block coverage. Recipes never record ownership of the product.
   *
   * @minItems 1
   */
  completedBy?: CompletionAlternative[];
  /**
   * Permanent readable release ID, unique within its item. Assign once; retain it when labels, names, or other facts change. The item and bundle IDs are reserved for synthetic editions.
   */
  equivalentTo?: string;
  /**
   * Workbook Expansion value.
   */
  expansion?: string;
  /**
   * Delivery format of this release.
   */
  format: "physical" | "digital";
  /**
   * Override of the item gameplay default (false when omitted). Store only when different from the item default.
   */
  gameplay?: boolean;
  /**
   * Kingdom Death shop product handle. Used only when the item has no shared handle.
   */
  handle?: string;
  /**
   * True when this edition is available only as part of another product. Omit for other or unconfirmed releases. Collection views may hide these editions.
   */
  includedOnly?: true;
  /**
   * Grants every current and future simulator edition. Resolve against editions marked simulator when reading the catalog; do not materialize a static list.
   */
  includesAllSim?: true;
  limit?: boolean;
  /**
   * Known materials of this release. Omitted means the material is unspecified.
   *
   * @minItems 1
   */
  materials?: string[];
  /**
   * Release-specific name when it differs from the sculpt item name, such as Plastic Ramette.
   */
  name?: string;
  /**
   * The release is known to have individually numbered copies. Omit otherwise.
   */
  numbered?: true;
  /**
   * Permanent readable release ID, unique within its item. Assign once; retain it when labels, names, or other facts change. The item and bundle IDs are reserved for synthetic editions.
   */
  priceFrom?: string;
  /**
   * Known sale amounts plus current MSRP in cents. Maximum is MSRP; the array makes no active-sale claim. Price evidence and estimates remain in the audit.
   *
   * @minItems 1
   *
   * Items: Amount in cents; inherits the item currency, which defaults to USD.
   */
  prices?: number[];
  /**
   * Exact release date, YYYY-MM-DD. Derive its year from this value; use releaseWindow when only a year or an imprecise date is known.
   */
  releaseDate?: string;
  /**
   * An imprecise release date, including a year alone such as 2024, a quarter in year-first format such as 2026 Q4, or a named source window. No exact date is invented.
   */
  releaseWindow?: string;
  /**
   * Known production or sale limit. Omit unknown counts; preserve supplied First Run and Encore counts. Do not infer counts from units sold.
   */
  runSize?: number;
  shop?: Shop;
  /**
   * This digital release is a Kingdom Death Simulator entitlement. Omit for other releases, including 3D Files.
   */
  simulator?: true;
  /**
   * Physical release size override when it differs from the item default. Sim never has a model size. Omit unknown placeholders.
   */
  size?: string;
  /**
   * External listing URL. Kingdom Death shop product listings use handle instead.
   */
  url?: string;
};
/**
 * Permanent readable release ID, unique within its item. Assign once; retain it when labels, names, or other facts change. The item and bundle IDs are reserved for synthetic editions.
 */
export type EditionId = string;
/**
 * Cached shop state for this listing. Clear it when the listing handle or external URL changes.
 */
export type Shop = "in-stock" | "out-of-stock" | "missing";
export type Inclusion =
  | string
  | {
      item: string;
      /**
       * Permanent readable release ID, unique within its item. Assign once; retain it when labels, names, or other facts change. The item and bundle IDs are reserved for synthetic editions.
       */
      editionId?: string;
      /**
       * @minItems 1
       */
      materials?: string[];
      /**
       * Stable edition IDs on the containing item for which this inclusion applies. Omitted means no edition restriction on the containing item; physical contents still require a physical release.
       *
       * @minItems 1
       */
      parentEditionIds?: EditionId[];
      /**
       * Optional contextual display name for this inclusion within its directly related parent.
       */
      shortLabel?: string;
    };
export type Accessories = Record<string, Item>;

/**
 * Review export combining the app catalog, news product links, and collection workbook. IDs remain object keys. Monetary amounts use integer cents. Personal ownership is stored in imports/kdm-import-records.json.
 */
export interface KingdomDeathCombinedReviewCatalog {
  $schema?: string;
  /**
   * Date of the latest completed shop refresh, YYYY-MM-DD.
   */
  shopUpdated?: string;
  content: Content;
  bundles: Items;
  homebrew: Content;
  accessories: Accessories;
  "included-only": Content;
}
export interface Items {
  [k: string]: Item;
}
export interface Item {
  accessoryType?: "shirt" | "dice" | "other" | "comic";
  /**
   * @minItems 1
   */
  aliases?: string[];
  /**
   * Unique news publication dates, sorted chronologically.
   *
   * @minItems 1
   */
  announcements?: Announcement[];
  /**
   * Color swatches in display order, paired by index with text labels when present.
   *
   * @minItems 1
   */
  colors?: string[];
  currency?: "USD" | "EUR";
  /**
   * Item description.
   */
  description?: string;
  /**
   * Selectable releases, ordered with Sim first and then chronologically by release date or release window; unknown dates last.
   *
   * @minItems 1
   */
  editions?: Edition[];
  /**
   * Gameplay is false by default. Store this field only when true; editions may override it.
   */
  gameplay?: true;
  /**
   * Gameplay content supplied with this item. Release differences, when known, are described here.
   */
  gameplayContent?: string;
  /**
   * Shared Kingdom Death shop product handle. Applies to every edition; omit edition handles when present.
   */
  handle?: string;
  /**
   * Known included items, optionally qualified by their editions/materials and the containing release. Partial list; unspecified editions are not automatically owned.
   *
   * @minItems 1
   */
  includes?: Inclusion[];
  /**
   * Product classification. The beta kind means all editions are Beta; box may contain mixed Beta and non-Beta editions or other boxed products. Bundles may omit kind.
   */
  kind?: string;
  name: string;
  /**
   * Item history and release notes.
   */
  notes?: string;
  /**
   * Item price in cents for products without editions. Products with editions use the edition's prices array.
   */
  price?: number;
  priceMinimum?: boolean;
  /**
   * Release date for an item without selectable editions, YYYY-MM-DD.
   */
  releaseDate?: string;
  /**
   * Imprecise release date for an item without selectable editions, such as a year or a year-first quarter.
   */
  releaseWindow?: string;
  /**
   * Explicitly supplied product release year. Shirt and dice years are stored here rather than in editions; unknown years are omitted.
   */
  releaseYear?: number;
  /**
   * @minItems 1
   */
  requires?: string[];
  shop?: Shop;
  /**
   * Default physical model size or scale (mm), retained as supplied text. Edition size overrides this value; Sim never inherits it. Omit unknown sizes.
   */
  size?: string;
  /**
   * Reviewed tags plus in-stock when at least one edition has shop: in-stock. The in-stock tag is removed when no editions remain in stock.
   *
   * @minItems 1
   */
  tags: string[];
  /**
   * Labels for color swatches in matching order. Repeated labels are allowed for distinct swatches.
   *
   * @minItems 1
   */
  text?: string[];
  /**
   * External listing URL. Kingdom Death shop product listings use handle instead.
   */
  url?: string;
  /**
   * Additional product URLs for an item without editions.
   *
   * @minItems 1
   */
  urls?: string[];
}
export interface CompletionAlternative {
  /**
   * All referenced editions are required for this content coverage recipe.
   *
   * @minItems 1
   */
  all: EditionReference[];
}
export interface EditionReference {
  item: string;
  editionId: EditionId;
}
