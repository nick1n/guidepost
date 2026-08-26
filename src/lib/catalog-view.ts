import { bundles, content, dice, effectivePrice, homebrew } from "./kdm-data";
import type { Bundle, ContentItem, DiceSet, Filters, CollectionState } from "#lib/types.ts";

type CatalogItem = ContentItem | DiceSet | Bundle;
type FilterableItem = Pick<CatalogItem, "id" | "name" | "tags"> & Partial<Pick<ContentItem, "alt" | "gameplay" | "kind">>;

export const bundleTags = Array.from(new Set(bundles.flatMap((bundle) => bundle.tags))).sort();

export function getCollectionStats(state: CollectionState) {
  let ownedCount = 0;
  let ownedValue = 0;
  let wishlistCount = 0;
  let wishlistValue = 0;

  for (const item of [...content, ...dice, ...homebrew]) {
    const entry = state[item.id];
    const price = "versions" in item || "editions" in item ? effectivePrice(item, entry?.versions, entry?.editions) : (item.price ?? 0);
    if (entry?.owned) {
      ownedCount += 1;
      ownedValue += price;
    } else if (entry?.wishlisted) {
      wishlistCount += 1;
      wishlistValue += price;
    }
  }

  return { ownedCount, totalCount: content.length + dice.length + homebrew.length, ownedValue, wishlistCount, wishlistValue };
}

export function getVisibleCatalog(filters: Filters, state: CollectionState) {
  const query = filters.query.trim().toLowerCase();
  const matches = (item: FilterableItem) => {
    if (query && !`${item.name} ${item.alt ?? ""} ${item.tags.join(" ")}`.toLowerCase().includes(query)) return false;
    if (filters.tags.length && !filters.tags.every((tag) => item.tags.includes(tag))) return false;
    if (filters.kind !== "any" && item.kind !== filters.kind) return false;
    if (filters.gameplay === "gameplay" && item.gameplay === false) return false;
    if (filters.gameplay === "models" && item.gameplay === true) return false;
    const entry = state[item.id];
    return !(
      (filters.status === "owned" && !entry?.owned) ||
      (filters.status === "unowned" && entry?.owned) ||
      (filters.status === "wishlisted" && !entry?.wishlisted)
    );
  };

  return {
    visibleContent: sort(content.filter(matches), filters.sort),
    visibleDice: sort(dice.filter(matches), filters.sort),
    visibleBundles: sort(bundles.filter(matches), filters.sort),
    visibleHomebrew: sort(homebrew.filter(matches), filters.sort),
  };
}

function sort<T extends Pick<CatalogItem, "name" | "price">>(items: T[], key: Filters["sort"]) {
  if (key === "name") return [...items].sort((a, b) => a.name.localeCompare(b.name));
  const direction = key === "price-asc" ? 1 : -1;
  return [...items].sort((a, b) => direction * ((a.price ?? 0) - (b.price ?? 0)));
}
