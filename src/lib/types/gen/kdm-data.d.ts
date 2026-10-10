/* Generated from static/kdm-catalog/data.schema.json. Do not edit. Run pnpm generate:types to regenerate. */

export type Content = Record<string, Item>;
/**
 * News publication date, YYYY-MM-DD. Full post details remain in kingdom-death-news/news-shop-links.json.
 */
export type Announcement = string;
/**
 * Permanent readable release ID, unique within its item. Assign once; retain it when labels, names, or other facts change. The item and bundle IDs are reserved for synthetic editions.
 */
export type EditionId = string;
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
    };
export type Accessories = Record<string, Item>;

/**
 * Review export combining the app catalog, news product links, and collection workbook. IDs remain object keys. Monetary amounts use integer cents. Personal ownership is stored in imports/kdm-import-records.json.
 */
export interface KingdomDeathCombinedReviewCatalog {
  $schema?: string;
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
  /**
   * Default physical model size or scale (mm), retained as supplied text. Edition size overrides this value; Sim never inherits it. Omit unknown sizes.
   */
  size?: string;
  /**
   * Reviewed descriptive tags from the master tag file.
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
export interface Edition {
  id: EditionId;
  /**
   * Selectable release label, such as First Run, Encore, Plastic, or Sim.
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
  /**
   * This digital release is a Kingdom Death Simulator entitlement. Omit for other releases, including 3D Files.
   */
  simulator?: true;
  /**
   * Physical release size override when it differs from the item default. Sim never has a model size. Omit unknown placeholders.
   */
  size?: string;
  /**
   * False when confirmed to be available only as part of another product. Omit for standalone or unconfirmed releases. Collection views may hide these editions.
   */
  standalone?: false;
  /**
   * External listing URL. Kingdom Death shop product listings use handle instead.
   */
  url?: string;
}
