import { bundles, collectionItems, content, dice, editionMaterials, effectivePrice, homebrew } from "./kdm-data";
import type { Bundle, ContentItem, DiceSet, Filters, CollectionState, Currency } from "#lib/types/index.ts";

type CatalogItem = ContentItem | DiceSet | Bundle;
type FilterableItem = Pick<CatalogItem, "id" | "name" | "tags"> & Partial<Pick<ContentItem, "alt" | "desc" | "gameplay" | "kind">>;

export const bundleTags = [...new Set(bundles.flatMap((bundle) => bundle.tags))].sort();

export function getCollectionStats(state: CollectionState) {
  let ownedCount = 0;
  const ownedValue: Partial<Record<Currency, number>> = {};
  let wishlistCount = 0;
  const wishlistValue: Partial<Record<Currency, number>> = {};

  for (const item of collectionItems) {
    const entry = state[item.id];
    const price = "versions" in item || "editions" in item ? effectivePrice(item, entry?.versions, entry?.editions) : (item.price ?? 0);
    const currency = item.currency ?? "USD";
    if (entry?.owned) {
      ownedCount += 1;
      ownedValue[currency] = (ownedValue[currency] ?? 0) + price;
    } else if (entry?.wishlisted) {
      wishlistCount += 1;
      wishlistValue[currency] = (wishlistValue[currency] ?? 0) + price;
    }
  }

  return { ownedCount, totalCount: collectionItems.length, ownedValue, wishlistCount, wishlistValue };
}

export function getVisibleCatalog(filters: Filters, state: CollectionState) {
  const query = filters.query.trim().toLowerCase();
  const matches = (item: FilterableItem) => {
    if (query && !`${item.name} ${item.alt ?? ""} ${item.desc ?? ""} ${item.tags.join(" ")}`.toLowerCase().includes(query)) return false;
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
    content: sort(content.filter(matches), filters.sort),
    dice: sort(dice.filter(matches), filters.sort),
    bundles: sort(bundles.filter(matches), filters.sort),
    homebrew: sort(homebrew.filter(matches), filters.sort),
  };
}

function sort<T extends Pick<CatalogItem, "name" | "price">>(items: T[], key: Filters["sort"]) {
  if (key === "name") return items.toSorted((a, b) => a.name.localeCompare(b.name));
  const direction = key === "price-asc" ? 1 : -1;
  return items.toSorted((a, b) => direction * ((a.price ?? 0) - (b.price ?? 0)));
}

// The review catalog stays separate from the live collection until its migration is ready.
export type ReviewEdition = {
  v: string;
  name?: string;
  $?: number[];
  r?: string;
  releaseWindow?: string;
  available?: true;
  standalone?: false;
  beta?: true;
  gameplay?: boolean;
  materials?: string[];
  size?: string;
  url?: string;
  runSize?: number;
  includesAllSim?: true;
};

export type ReviewItem = {
  name: string;
  kind?: string;
  tags: string[];
  aliases?: string[];
  editions?: ReviewEdition[];
  gameplay?: true;
  gameplayContent?: string;
  notes?: string;
  url?: string;
  price?: number;
  currency?: Currency;
  releaseDate?: string;
  releaseWindow?: string;
  includes?: (string | { item: string; edition?: string; materials?: string[]; parentEditions?: string[] })[];
};

export type ReviewCatalog = Record<"content" | "included-only" | "accessories" | "bundles" | "homebrew", Record<string, ReviewItem>>;

export function reviewTagLabel(tag: string) {
  return tag.replace(/^monster-/, "").replaceAll("-", " ");
}

export function reviewEntries(catalog: ReviewCatalog) {
  return Object.entries(catalog).flatMap(([category, items]) =>
    typeof items === "object" ? Object.entries(items).map(([id, item]) => ({ ...item, id, category })) : [],
  );
}

export function reviewTags(items: readonly Pick<ReviewItem, "tags">[]) {
  const counts = new Map<string, number>();
  for (const item of items) for (const tag of new Set(item.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "en"));
}

export function reviewPrice(item: ReviewItem, edition: ReviewEdition) {
  return edition.$?.length ? Math.max(...edition.$) : item.price;
}

export function reviewEditions(item: ReviewItem): ReviewEdition[] {
  // Accessories and homebrew can be tracked as one item without catalog editions.
  return item.editions?.length ? item.editions : [{ v: "Item", r: item.releaseDate, releaseWindow: item.releaseWindow }];
}

export function reviewNumberedEditions(item: ReviewItem) {
  return reviewEditions(item).filter(
    (edition) =>
      edition.runSize !== undefined ||
      /\bfirst[\s-]+run\b|\bdeathgrey\b/i.test([edition.v, edition.name, ...editionMaterials(edition)].join(" ")),
  );
}

// Rebuild this index when the catalog changes; cached results belong to that snapshot.
export function reviewIndex(catalog: ReviewCatalog) {
  const entries = reviewEntries(catalog);
  const byId = new Map(entries.map((item) => [item.id, item]));
  const sim = entries.filter((item) => item.editions?.some((edition) => edition.v === "Sim"));
  const search = new Map(
    entries.map((item) => [
      item.id,
      [item.name, item.id, ...(item.aliases ?? []), ...item.tags, ...item.tags.map(reviewTagLabel)].join(" ").toLowerCase(),
    ]),
  );

  function findInclusions(id: string, edition: string) {
    const item = byId.get(id);
    const included = (item?.includes ?? []).flatMap((inclusion) => {
      const reference = typeof inclusion === "string" ? { item: inclusion } : inclusion;
      if (reference.parentEditions && !reference.parentEditions.includes(edition)) return [];
      const child = byId.get(reference.item);
      if (!child) return [];
      return [{ ...reference, name: child.name, category: child.category }];
    });
    if (item?.editions?.find((release) => release.v === edition)?.includesAllSim) {
      const explicitSim = new Set(included.filter((reference) => reference.edition === "Sim").map((reference) => reference.item));
      for (const child of sim)
        if (child.id !== id && !explicitSim.has(child.id))
          included.push({ item: child.id, edition: "Sim", name: child.name, category: child.category });
    }
    return included;
  }

  const cache = new Map<string, ReturnType<typeof findInclusions>>();
  function inclusions(id: string, edition: string) {
    const key = `${id}:${edition}`;
    let included = cache.get(key);
    if (!included) {
      included = findInclusions(id, edition);
      cache.set(key, included);
    }
    return included;
  }

  function includedEditions(id: string, edition: string, includeNested = true) {
    const included: { item: (typeof entries)[number]; edition: ReviewEdition }[] = [];
    const visited = new Set([`${id}:${edition}`]);
    function visit(parentId: string, parentEdition: string) {
      for (const reference of inclusions(parentId, parentEdition)) {
        const item = byId.get(reference.item);
        if (!item) continue;
        const editions = reviewEditions(item);
        const matches = reference.edition
          ? editions.filter((release) => release.v === reference.edition)
          : reference.materials?.length
            ? editions.filter((release) => reference.materials!.every((material) => editionMaterials(release).includes(material)))
            : [editions.find((release) => release.v === parentEdition) ?? editions.find((release) => release.v !== "Sim") ?? editions[0]];
        for (const release of matches) {
          if (!release) continue;
          const key = `${item.id}:${release.v}`;
          if (visited.has(key)) continue;
          visited.add(key);
          included.push({ item, edition: release });
          if (includeNested) visit(item.id, release.v);
        }
      }
    }
    visit(id, edition);
    return included;
  }

  function bundlePricing(id: string, edition: string) {
    const item = byId.get(id);
    if (item?.category !== "bundles" || !inclusions(id, edition).length) return;
    const release = reviewEditions(item).find((release) => release.v === edition);
    if (!release) return;
    const price = reviewPrice(item, release);
    let total = 0;
    let missing = 0;
    const children = includedEditions(id, edition, false);
    for (const reference of inclusions(id, edition))
      if (
        !children.some(
          (child) =>
            child.item.id === reference.item &&
            (!reference.edition || child.edition.v === reference.edition) &&
            (!reference.materials?.length || reference.materials.every((material) => editionMaterials(child.edition).includes(material))),
        )
      )
        missing += 1;
    for (const child of children) {
      const amount = reviewPrice(child.item, child.edition);
      if (amount === undefined || (child.item.currency ?? "USD") !== (item.currency ?? "USD")) missing += 1;
      else total += amount;
    }
    const savings = !missing && price !== undefined ? total - price : undefined;
    return { total, missing, savings, percent: savings !== undefined && total > 0 ? Math.round((savings / total) * 100) : undefined };
  }

  return { entries, search, inclusions, includedEditions, bundlePricing };
}

export function reviewInclusions(catalog: ReviewCatalog, id: string, edition: string) {
  return reviewIndex(catalog).inclusions(id, edition);
}
