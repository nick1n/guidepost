import { editionGameplay, editionLabel, editionMaterials } from "./kdm-data";
import type { Catalog, Edition, Item } from "#lib/types/index.ts";
import { collectionKey } from "#lib/types/collection.ts";

export type ReviewEdition = Edition;
export type ReviewItem = Item;
export type ReviewCatalog = Catalog;
export type EditionSelection = { item: ReturnType<typeof reviewEntries>[number]; edition: ReviewEdition };
type Owner = { parentId: string; parentEditionId: string; parent: string; parentEdition: string; editionId?: string };

export function reviewTagLabel(tag: string) {
  return tag.replace(/^monster-/, "").replaceAll("-", " ");
}

export function reviewEntries(catalog: ReviewCatalog) {
  const { $schema, ...categories } = catalog;
  return Object.entries(categories).flatMap(([category, items]) => Object.entries(items).map(([id, item]) => ({ ...item, id, category })));
}

export function reviewTags(items: readonly Pick<ReviewItem, "tags">[]) {
  const counts = new Map<string, number>();
  for (const item of items) for (const tag of new Set(item.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "en"));
}

export function reviewShopUrl(item: ReviewItem, edition: ReviewEdition) {
  const handle = item.handle ?? edition.handle;
  return handle ? "https://shop.kingdomdeath.com/products/" + handle : (edition.url ?? item.url);
}

export function reviewPrice(item: ReviewItem, edition: ReviewEdition) {
  return edition.prices?.length ? Math.max(...edition.prices) : item.price;
}

export function reviewEditions(item: ReviewItem & { category?: string }): ReviewEdition[] {
  // Items without catalog editions get one trackable edition named for their category.
  return item.editions?.length
    ? item.editions
    : [
        {
          id: item.category === "bundles" ? "bundle" : "item",
          label: item.category === "bundles" ? "Bundle" : "Item",
          format: "physical",
          releaseDate: item.releaseDate,
          releaseWindow: item.releaseWindow,
        },
      ];
}

export function reviewNumberedEditions(item: ReviewItem) {
  return reviewEditions(item).filter((edition) => edition.numbered === true);
}

export function reviewGameplayFirst(items: ReturnType<typeof reviewEntries>) {
  const gameplay = new Set(
    items.filter((item) => reviewEditions(item).some((edition) => editionGameplay(item, edition))).map((item) => item.id),
  );
  return items.toSorted((a, b) => Number(gameplay.has(b.id)) - Number(gameplay.has(a.id)));
}

export function reviewBadges(item: ReviewItem) {
  const editions = reviewEditions(item);
  return {
    gameplay: editions.some((edition) => editionGameplay(item, edition) && (!edition.beta || edition.gameplay === true)),
    beta: editions.some((edition) => edition.beta),
  };
}

// Rebuild this index when the catalog changes; cached results belong to that snapshot.
export function reviewIndex(catalog: ReviewCatalog) {
  const entries = reviewEntries(catalog);
  // Resolve synthetic editions once on the indexed copies, leaving source items unchanged.
  for (const item of entries) item.editions = reviewEditions(item);
  const byCategory = new Map<string, typeof entries>();
  for (const item of entries) {
    const grouped = byCategory.get(item.category) ?? [];
    grouped.push(item);
    byCategory.set(item.category, grouped);
  }
  const tags = new Map([...byCategory].map(([category, items]) => [category, reviewTags(items)]));
  const tagViews = new Map(
    [...tags].map(([category, values]) => [
      category,
      {
        cloud: values.filter(({ tag, count }) => count >= 5 && !/^\d+$/.test(tag)),
        all: values.filter(({ count }) => count > 1).toSorted((a, b) => reviewTagLabel(a.tag).localeCompare(reviewTagLabel(b.tag), "en")),
        counts: new Map(values.map(({ tag, count }) => [tag, count])),
      },
    ]),
  );
  const byId = new Map(entries.map((item) => [item.id, item]));
  const sim = entries.filter((item) => item.editions?.some((edition) => edition.simulator === true));
  const search = new Map(
    entries.map((item) => [
      item.id,
      [item.name, item.id, ...(item.aliases ?? []), ...item.tags, ...item.tags.map(reviewTagLabel)].join(" ").toLowerCase(),
    ]),
  );

  function findInclusions(id: string, editionId: string) {
    const item = byId.get(id);
    const included = (item?.includes ?? []).flatMap((inclusion) => {
      const reference = typeof inclusion === "string" ? { item: inclusion } : inclusion;
      if (reference.parentEditionIds && !reference.parentEditionIds.includes(editionId)) return [];
      const child = byId.get(reference.item);
      if (!child) return [];
      const childEdition = child.editions?.find((release) => release.id === reference.editionId);
      return [{ ...reference, name: child.name, category: child.category, editionLabel: childEdition && editionLabel(childEdition) }];
    });
    if (item?.editions?.find((release) => release.id === editionId)?.includesAllSim) {
      const explicitSim = new Set(
        included
          .filter((reference) => byId.get(reference.item)?.editions?.find((release) => release.id === reference.editionId)?.simulator)
          .map((reference) => reference.item),
      );
      for (const child of sim)
        if (child.id !== id && !explicitSim.has(child.id))
          for (const release of child.editions ?? []) {
            if (release.simulator)
              included.push({
                item: child.id,
                editionId: release.id,
                name: child.name,
                category: child.category,
                editionLabel: editionLabel(release),
              });
          }
    }
    return included;
  }

  const cache = new Map<string, ReturnType<typeof findInclusions>>();
  function inclusions(id: string, editionId: string) {
    const key = collectionKey(id, editionId);
    let included = cache.get(key);
    if (!included) {
      included = findInclusions(id, editionId);
      cache.set(key, included);
    }
    return included;
  }

  type Included = { item: (typeof entries)[number]; edition: ReviewEdition };
  const includedCache = new Map<string, Included[]>();
  function includedEditions(id: string, editionId: string, includeNested = true) {
    const cacheKey = JSON.stringify([id, editionId, includeNested]);
    const cached = includedCache.get(cacheKey);
    if (cached) return cached;
    const included: Included[] = [];
    const visited = new Set([collectionKey(id, editionId)]);
    function visit(parentId: string, parentEditionId: string) {
      const parentEdition = byId.get(parentId)?.editions?.find((release) => release.id === parentEditionId);
      for (const reference of inclusions(parentId, parentEditionId)) {
        const item = byId.get(reference.item);
        if (!item) continue;
        const editions = reviewEditions(item);
        const matches = reference.editionId
          ? editions.filter((release) => release.id === reference.editionId)
          : reference.materials?.length
            ? editions.filter((release) => reference.materials!.every((material) => editionMaterials(release).includes(material)))
            : [
                editions.find(
                  (release) => release.format === parentEdition?.format && !!release.simulator === !!parentEdition?.simulator,
                ) ??
                  editions.find((release) => release.format === "physical") ??
                  editions[0],
              ];
        for (const release of matches) {
          if (!release) continue;
          const key = collectionKey(item.id, release.id);
          if (visited.has(key)) continue;
          visited.add(key);
          included.push({ item, edition: release });
          if (includeNested) visit(item.id, release.id);
        }
      }
    }
    visit(id, editionId);
    includedCache.set(cacheKey, included);
    return included;
  }

  type Pricing = { total: number; missing: number; savings: number | undefined; percent: number | undefined };
  const pricingCache = new Map<string, Pricing>();
  function bundlePricing(id: string, editionId: string) {
    const item = byId.get(id);
    if (item?.category !== "bundles" || !inclusions(id, editionId).length) return;
    const cacheKey = collectionKey(id, editionId);
    const cached = pricingCache.get(cacheKey);
    if (cached) return cached;
    const release = reviewEditions(item).find((release) => release.id === editionId);
    if (!release) return;
    const price = reviewPrice(item, release);
    let total = 0;
    let missing = 0;
    const children = includedEditions(id, editionId, false);
    for (const reference of inclusions(id, editionId))
      if (
        !children.some(
          (child) =>
            child.item.id === reference.item &&
            (!reference.editionId || child.edition.id === reference.editionId) &&
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
    const pricing = {
      total,
      missing,
      savings,
      percent: savings !== undefined && total > 0 ? Math.round((savings / total) * 100) : undefined,
    };
    pricingCache.set(cacheKey, pricing);
    return pricing;
  }

  function ownershipKeys(targets: readonly EditionSelection[]) {
    return [
      ...new Set(
        targets.flatMap(({ item, edition }) =>
          [{ item, edition }, ...includedEditions(item.id, edition.id)].map(({ item, edition }) => collectionKey(item.id, edition.id)),
        ),
      ),
    ];
  }

  function ownershipCoverage(owned: readonly EditionSelection[]) {
    const grouped = new Map<string, Owner[]>();
    for (const { item, edition } of owned) {
      for (const child of inclusions(item.id, edition.id)) {
        const owners = grouped.get(child.item) ?? [];
        owners.push({
          parentId: item.id,
          parentEditionId: edition.id,
          parent: item.name,
          parentEdition: editionLabel(edition),
          editionId: child.editionId,
        });
        grouped.set(child.item, owners);
      }
    }
    return grouped;
  }

  return {
    entries,
    byId,
    byCategory,
    tags,
    tagViews,
    search,
    inclusions,
    includedEditions,
    bundlePricing,
    ownershipKeys,
    ownershipCoverage,
  };
}
