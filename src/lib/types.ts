export type ItemKind = "core" | "beta" | "promo" | "expansion" | "white-box" | "set";

export type Edition = {
  v: string;
  $: number[];
  limit?: boolean;
  r?: string;
};

export type ContentItem = {
  id: string;
  name: string;
  alt?: string;
  kind: ItemKind;
  gameplay: boolean;
  price?: number;
  versions?: Edition[];
  editions?: Edition[];
  tags: string[];
  requires?: string[];
  url?: string;
};

export type DiceSet = {
  id: string;
  name: string;
  price?: number;
  colors: [string, string];
  text: [string, string];
  tags: string[];
  url?: string;
};

export type Bundle = {
  id: string;
  name: string;
  price?: number;
  gameplay: boolean;
  tags: string[];
  includes: string[];
  url?: string;
};

export type Catalog = {
  content: Record<string, Omit<ContentItem, "id">>;
  dice: Record<string, Omit<DiceSet, "id">>;
  bundles: Record<string, Omit<Bundle, "id">>;
  homebrew: Record<string, Omit<ContentItem, "id">>;
};

export type SortKey = "name" | "price-desc" | "price-asc";
export type GameplayFilter = "any" | "gameplay" | "models";
export type KindFilter = "any" | "core" | "expansion" | "white-box" | "beta" | "promo" | "set";
export type StatusFilter = "any" | "owned" | "unowned" | "wishlisted";

export type Filters = {
  query: string;
  sort: SortKey;
  gameplay: GameplayFilter;
  kind: KindFilter;
  status: StatusFilter;
  tags: string[];
};
