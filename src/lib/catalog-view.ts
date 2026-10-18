import { editionGameplay, editionLabel, editionMaterials } from "./kdm-data.ts";
import { catalogCategories, type Catalog, type Edition, type Item } from "#lib/types/index.ts";
import { collectionKey, type CollectionSnapshot } from "#lib/types/collection.ts";

export type ReviewEdition = Edition;
export type ReviewItem = Item;
export type ReviewCatalog = Catalog;
export type CatalogEntry = ReturnType<typeof reviewEntries>[number];
export type CatalogIndex = ReturnType<typeof reviewIndex>;
export type EditionSelection = { item: CatalogEntry; edition: ReviewEdition };
type Inclusion = Exclude<NonNullable<ReviewItem["includes"]>[number], string>;
type IncludedEdition = EditionSelection & { name: string };
type Owner = { parentId: string; parentEditionId: string; parent: string; parentEdition: string; editionId?: string };

type CoverageNode = {
  selection: EditionSelection;
  children: { key: string; name: string }[];
  equivalents: string[];
  recipes: string[][];
};

type CoverageStatus = {
  available: boolean;
  source: "owned" | "included" | "equivalent" | "upgrade" | "missing";
  via: EditionSelection[];
};

export function reviewTagLabel(tag: string) {
  return tag.replace(/^monster-/, "").replaceAll("-", " ");
}

export function reviewIncludedEditionLabel(parent: Pick<CatalogEntry, "category">, edition: ReviewEdition) {
  return parent.category === "bundles" ? editionLabel(edition) : editionMaterials(edition).join(", ") || editionLabel(edition);
}

export function reviewEntries(catalog: ReviewCatalog) {
  return catalogCategories.flatMap((category) => Object.entries(catalog[category]).map(([id, item]) => ({ ...item, id, category })));
}

export function reviewTagCounts(items: readonly Pick<ReviewItem, "tags">[]) {
  const counts = new Map<string, number>();
  for (const item of items) for (const tag of new Set(item.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return counts;
}

export function reviewTags(items: readonly Pick<ReviewItem, "tags">[]) {
  return [...reviewTagCounts(items)]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "en"));
}

export function reviewShopUrl(item: ReviewItem, edition: ReviewEdition) {
  if (edition.includedOnly) return;
  const handle = item.handle ?? edition.handle;
  return handle ? "https://shop.kingdomdeath.com/products/" + handle : (edition.url ?? item.url);
}

export function reviewShopLink(item: ReviewItem, edition: ReviewEdition) {
  const url = reviewShopUrl(item, edition);
  if (!url) return;

  const state: NonNullable<ReviewEdition["shop"]> | "unknown" =
    edition.shop ?? (["item", "bundle"].includes(edition.id) ? item.shop : undefined) ?? "unknown";
  return { url, state };
}

export function reviewPrice(item: ReviewItem, edition: ReviewEdition) {
  if (edition.includedOnly) return;
  if (edition.prices?.length) return Math.max(...edition.prices);
  // Item-level prices belong to synthetic editions, not to unpriced selectable releases.
  return ["item", "bundle"].includes(edition.id) ? item.price : undefined;
}

export function reviewEditions(item: ReviewItem & { category?: string }): ReviewEdition[] {
  // Items without catalog editions get one trackable edition named for their category or accessory type.
  return item.editions?.length
    ? item.editions
    : [
        {
          id: item.category === "bundles" ? "bundle" : "item",
          label:
            item.category === "bundles"
              ? "Bundle"
              : item.accessoryType === "dice"
                ? "Dice"
                : item.accessoryType === "shirt"
                  ? "Shirt"
                  : "Item",
          format: "physical",
          releaseDate: item.releaseDate,
          releaseWindow: item.releaseWindow,
        },
      ];
}

export function reviewNumberedEditions(item: ReviewItem) {
  return reviewEditions(item).filter((edition) => edition.numbered === true);
}

export function reviewEquivalentEditions(item: ReviewItem, edition: ReviewEdition) {
  const canonical = edition.equivalentTo ?? edition.id;
  return reviewEditions(item).filter((release) => (release.equivalentTo ?? release.id) === canonical);
}

export function reviewEditionReleased(edition: ReviewEdition, today = new Date().toISOString().slice(0, 10)) {
  if (edition.label === "Preorder") return false;
  if (edition.releaseDate) return edition.releaseDate <= today;
  const window = edition.releaseWindow?.match(/^(\d{4})(?:[ -]Q([1-4]))?$/);
  if (!window) return false;
  // An imprecise window confirms a past release only once the entire window has elapsed.
  const year = today.slice(0, 4);
  return window[1]! < year || (window[1] === year && !!window[2] && Number(window[2]) * 3 < Number(today.slice(5, 7)));
}

export function reviewGameplayFirst(items: readonly CatalogEntry[]) {
  const gameplay: CatalogEntry[] = [];
  const models: CatalogEntry[] = [];
  for (const item of items) {
    if (reviewEditions(item).some((edition) => editionGameplay(item, edition))) gameplay.push(item);
    else models.push(item);
  }
  return [...gameplay, ...models];
}

export function reviewBadges(item: ReviewItem) {
  const editions = reviewEditions(item);
  return {
    gameplay: editions.some((edition) => editionGameplay(item, edition) && (!edition.beta || edition.gameplay === true)),
    beta: editions.some((edition) => edition.beta),
  };
}

function matchingEditions(item: CatalogEntry, reference: Inclusion, parent: ReviewEdition | undefined) {
  const editions = reviewEditions(item);
  if (reference.editionId) return editions.filter((edition) => edition.id === reference.editionId);
  const { materials } = reference;
  if (materials?.length) return editions.filter((edition) => materials.every((material) => editionMaterials(edition).includes(material)));
  const edition =
    editions.find((edition) => edition.format === parent?.format && !!edition.simulator === !!parent?.simulator) ??
    editions.find((edition) => edition.format === "physical") ??
    editions[0];
  return edition ? [edition] : [];
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
  const search = new Map(
    entries.map((item) => [
      item.id,
      [item.name, item.id, ...(item.aliases ?? []), ...item.tags, ...item.tags.map(reviewTagLabel)].join(" ").toLowerCase(),
    ]),
  );

  return { entries, byId, byCategory, tags, tagViews, search, ...indexRelationships(entries, byId) };
}

/** Relationship resolution and its caches share the lifetime of one catalog index. */
function indexRelationships(entries: readonly CatalogEntry[], byId: ReadonlyMap<string, CatalogEntry>) {
  const sim = entries.filter((item) => item.editions?.some((edition) => edition.simulator === true));

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

  const inclusionCache = new Map<string, ReturnType<typeof findInclusions>>();
  function inclusions(id: string, editionId: string) {
    const key = collectionKey(id, editionId);
    let included = inclusionCache.get(key);
    if (!included) {
      included = findInclusions(id, editionId);
      inclusionCache.set(key, included);
    }
    return included;
  }

  const includedCache = new Map<string, IncludedEdition[]>();
  function includedEditions(id: string, editionId: string, includeNested = true) {
    const cacheKey = JSON.stringify([id, editionId, includeNested]);
    const cached = includedCache.get(cacheKey);
    if (cached) return cached;
    const included: IncludedEdition[] = [];
    const visited = new Set([collectionKey(id, editionId)]);
    function visit(parentId: string, parentEditionId: string) {
      const parentEdition = byId.get(parentId)?.editions?.find((release) => release.id === parentEditionId);
      for (const reference of inclusions(parentId, parentEditionId)) {
        const item = byId.get(reference.item);
        if (!item) continue;
        for (const release of matchingEditions(item, reference, parentEdition)) {
          const key = collectionKey(item.id, release.id);
          if (visited.has(key)) continue;
          visited.add(key);
          included.push({ item, edition: release, name: reference.shortLabel ?? item.name });
          if (includeNested) visit(item.id, release.id);
        }
      }
    }
    visit(id, editionId);
    includedCache.set(cacheKey, included);
    return included;
  }

  type Pricing = {
    total: number;
    missing: number;
    unavailable: number;
    savings: number | undefined;
    percent: number | undefined;
  };
  const pricingCache = new Map<string, Pricing>();
  function bundlePricing(id: string, editionId: string, snapshot?: CollectionSnapshot) {
    const item = byId.get(id);
    if (item?.category !== "bundles" || !inclusions(id, editionId).length) return;
    const cacheKey = collectionKey(id, editionId);
    const cached = !snapshot && pricingCache.get(cacheKey);
    if (cached) return cached;
    const release = reviewEditions(item).find((release) => release.id === editionId);
    if (!release) return;
    const price = reviewPrice(item, release);
    let total = 0;
    let missing = 0;
    let unavailable = 0;
    const ownership = snapshot && coverage(snapshot);
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
    const needed = children.filter((child) => !ownership?.edition(child.item.id, child.edition.id).available);
    const priced = new Set<string>();
    for (const child of needed) {
      const canonical = collectionKey(child.item.id, child.edition.equivalentTo ?? child.edition.id);
      if (priced.has(canonical)) continue;
      priced.add(canonical);
      // A listed box already pays for its descendants. Shared contents are never charged twice.
      if (
        needed.some(
          (parent) =>
            parent !== child &&
            !parent.edition.includedOnly &&
            includedEditions(parent.item.id, parent.edition.id).some(
              (part) => collectionKey(part.item.id, part.edition.equivalentTo ?? part.edition.id) === canonical,
            ),
        )
      )
        continue;
      const product = child.edition.priceFrom
        ? reviewEditions(child.item).find((release) => release.id === child.edition.priceFrom)
        : child.edition;
      if (!product || product.includedOnly) {
        unavailable += 1;
        continue;
      }
      const amount = reviewPrice(child.item, product);
      if (amount === undefined || (child.item.currency ?? "USD") !== (item.currency ?? "USD")) missing += 1;
      else total += amount;
    }
    const savings = !missing && !unavailable && price !== undefined ? total - price : undefined;
    const pricing = {
      total,
      missing,
      unavailable,
      savings,
      percent: savings !== undefined && total > 0 ? Math.round((savings / total) * 100) : undefined,
    };
    if (!snapshot) pricingCache.set(cacheKey, pricing);
    return pricing;
  }

  function ownershipKeys(targets: readonly EditionSelection[]) {
    return [...new Set(targets.map(({ item, edition }) => collectionKey(item.id, edition.id)))];
  }

  let coverageGraph: ReturnType<typeof indexCoverage> | undefined;
  const coverageCache = new WeakMap<CollectionSnapshot, ReturnType<typeof resolveCoverage>>();
  function coverage(snapshot: CollectionSnapshot) {
    let resolved = coverageCache.get(snapshot);
    if (!resolved) {
      coverageGraph ??= indexCoverage(entries, includedEditions);
      resolved = resolveCoverage(coverageGraph, snapshot);
      coverageCache.set(snapshot, resolved);
    }
    return resolved;
  }

  return {
    inclusions,
    includedEditions,
    bundlePricing,
    ownershipKeys,
    coverage,
  };
}

/** Catalog relationships are resolved once; snapshots only evaluate coverage over these keys. */
function indexCoverage(
  entries: readonly CatalogEntry[],
  includedEditions: (id: string, editionId: string, includeNested: boolean) => IncludedEdition[],
) {
  const nodes = new Map<string, CoverageNode>();
  for (const item of entries)
    for (const edition of reviewEditions(item))
      nodes.set(collectionKey(item.id, edition.id), {
        selection: { item, edition },
        children: includedEditions(item.id, edition.id, false).map((child) => ({
          key: collectionKey(child.item.id, child.edition.id),
          name: child.name,
        })),
        equivalents: reviewEquivalentEditions(item, edition).map((candidate) => collectionKey(item.id, candidate.id)),
        recipes: (edition.completedBy ?? []).map((recipe) =>
          recipe.all.map((reference) => collectionKey(reference.item, reference.editionId)),
        ),
      });
  return nodes;
}

/** Only recorded acquisitions supply contents. Equivalent and upgraded coverage never become sources. */
function collectSupplies(nodes: ReadonlyMap<string, CoverageNode>, snapshot: CollectionSnapshot) {
  const supplied = new Map<string, EditionSelection[]>();
  for (const [rootKey, root] of nodes) {
    if (!snapshot[rootKey]?.owned) continue;
    const visited = new Set<string>();
    const pending = [rootKey];
    while (pending.length) {
      const key = pending.pop()!;
      if (visited.has(key) || snapshot[key]?.missing) continue;
      visited.add(key);
      const sources = supplied.get(key) ?? [];
      sources.push(root.selection);
      supplied.set(key, sources);
      pending.push(...nodes.get(key)!.children.map((child) => child.key));
    }
  }
  return supplied;
}

function resolveCoverage(nodes: ReadonlyMap<string, CoverageNode>, snapshot: CollectionSnapshot) {
  const supplied = collectSupplies(nodes, snapshot);
  const cache = new Map<string, CoverageStatus>();
  const visiting = new Set<string>();
  function status(key: string): CoverageStatus {
    const cached = cache.get(key);
    if (cached) return cached;
    const node = nodes.get(key);
    if (!node || visiting.has(key) || snapshot[key]?.missing) return { available: false, source: "missing", via: [] };
    visiting.add(key);
    const result = resolveStatus(key, node);
    visiting.delete(key);
    cache.set(key, result);
    return result;
  }
  function resolveStatus(key: string, node: CoverageNode): CoverageStatus {
    const sources = supplied.get(key);
    if (sources?.length) return { available: true, source: snapshot[key]?.owned ? "owned" : "included", via: sources };

    const equivalents = node.equivalents.filter((candidate) => !snapshot[candidate]?.missing);
    const equivalent = equivalents.find((candidate) => candidate !== key && supplied.has(candidate));
    if (equivalent) return { available: true, source: "equivalent", via: [nodes.get(equivalent)!.selection] };

    for (const recipe of equivalents.flatMap((candidate) => nodes.get(candidate)!.recipes)) {
      if (!recipe.every((key) => status(key).available)) continue;
      const via = recipe.map((key) => nodes.get(key)!.selection);
      return { available: true, source: "upgrade", via };
    }
    return { available: false, source: "missing", via: [] };
  }
  function edition(id: string, editionId: string) {
    return status(collectionKey(id, editionId));
  }
  function contents(id: string, editionId: string) {
    const children = (nodes.get(collectionKey(id, editionId))?.children ?? []).map(({ key, name }) => {
      const child = nodes.get(key)!.selection;
      const status = edition(child.item.id, child.edition.id);
      const ownedEditions = reviewEditions(child.item).filter((release) => edition(child.item.id, release.id).available);
      return { ...child, name, status, exactOwned: status.available, owned: ownedEditions.length > 0, ownedEditions };
    });
    return {
      children,
      exactCount: children.filter((child) => child.exactOwned).length,
      count: children.filter((child) => child.owned).length,
    };
  }
  function owners(id: string, editionId: string): Owner[] {
    const key = collectionKey(id, editionId);
    const node = nodes.get(key);
    if (!node || snapshot[key]?.missing) return [];
    const roots = new Map<string, EditionSelection>();
    for (const equivalent of node.equivalents)
      for (const root of supplied.get(equivalent) ?? []) {
        if (root.item.id === id) continue;
        roots.set(collectionKey(root.item.id, root.edition.id), root);
      }
    return [...roots.values()].map((root) => ({
      parentId: root.item.id,
      parentEditionId: root.edition.id,
      parent: root.item.name,
      parentEdition: editionLabel(root.edition),
      editionId,
    }));
  }
  return { edition, contents, owners };
}
