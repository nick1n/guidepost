import type { Edition } from "./types.mts";

type Target = Pick<Edition, "shop" | "available">;
type StockItem = { tags: string[]; editions?: { shop?: string }[] };
export type StockState = NonNullable<Edition["shop"]>;

// Omit false availability rather than persisting it.
export function recordAvailability(target: Target, available: boolean) {
  const previous = target.available;
  if (available) target.available = true;
  else delete target.available;
  return previous !== target.available;
}

export function recordStock(target: Target, state: StockState | undefined, availability: "preserve" | "replace" = "preserve") {
  const shopChanged = target.shop !== state;
  if (state === undefined) delete target.shop;
  else target.shop = state;
  const availableChanged = availability === "replace" && recordAvailability(target, state === "in-stock");
  return { shopChanged, availableChanged };
}

export function invalidateListingEvidence(target: Target) {
  recordStock(target, undefined, "replace");
}

// Only explicit edition stock contributes to the derived item tag.
export function hasStock(item: Pick<StockItem, "editions">) {
  return item.editions?.some((edition) => edition.shop === "in-stock") ?? false;
}

export function syncStockTag(item: StockItem) {
  const inStock = hasStock(item);
  let retained = false;
  const tags = item.tags.filter((tag) => {
    if (tag !== "in-stock") return true;
    if (!inStock || retained) return false;
    retained = true;
    return true;
  });
  if (inStock && !retained) tags.push("in-stock");
  const changed = tags.length !== item.tags.length || tags.some((tag, index) => tag !== item.tags[index]);
  if (changed) item.tags = tags;
  return changed;
}
