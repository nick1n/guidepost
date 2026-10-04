import { Parser } from "htmlparser2";
import { isDeepStrictEqual } from "node:util";
import {
  categories,
  type Catalog,
  type Category,
  type Edition,
  type Evidence,
  type Item,
  type Mapping,
  type Product,
  type Variant,
} from "./types.mts";
import { productUrl } from "./shop.mts";
import { normalizeCatalog } from "./normalize.mts";
import { organizeCatalog, editionComparator } from "./order.mts";
import { applyTags, type Tags } from "./tags.mts";

export function normalized(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^(?:kds|kingdomdeathsimulator)/, "");
}

export function productExclusion(handle: string, title = "") {
  if (/(?:^|-)art-?prints?(?:-|$)/i.test(handle) || /\bart\s+prints?\b/i.test(title))
    return "Art prints are excluded from the catalog for now";
}

export function releaseGaps(catalog: Catalog) {
  const missingEditions = Object.entries(catalog.content)
    .filter(([, item]) => !item.editions?.length)
    .map(([itemId, item]) => ({ itemId, name: item.name }));
  const missingDates = Object.entries(catalog.content).flatMap(([itemId, item]) =>
    (item.editions ?? []).filter((edition) => !edition.r && !edition.releaseWindow).map((edition) => ({ itemId, edition: edition.v })),
  );
  return { missingEditions, missingDates };
}

export function contents(html: string) {
  const rows: string[] = [];
  let current: string[] | undefined;
  new Parser({
    onopentag(tag) {
      if (tag === "li") current = [];
    },
    ontext(text) {
      current?.push(text);
    },
    onclosetag(tag) {
      if (tag === "li" && current) {
        rows.push(current.join("").replace(/\s+/g, " ").trim());
        current = undefined;
      }
    },
  }).end(html);
  return rows.filter(Boolean);
}

export function variantLabel(variant: Variant, fallback: string): string {
  if (!variant.requires_shipping) return "Sim";
  const format = fallback.match(/^(Painters|Bust)(?:: (.+))?$/);
  if (format) return format[2] ? `${format[1]}: ${variantLabel(variant, format[2])}` : format[1]!;
  if (/first run/i.test(variant.title)) return "First Run";
  if (/encore/i.test(variant.title)) return "Encore";
  if (/deathgrey.*m2/i.test(variant.title)) return "Deathgrey M2";
  if (/deathgrey/i.test(variant.title)) return "Deathgrey";
  if (/deathpink/i.test(variant.title)) return "Deathpink";
  if (/general/i.test(variant.title)) return "General";
  return fallback;
}

export function observedPrices(variants: Variant[], previous: number[] = []) {
  // Only a prior multi-price array establishes sale amounts. A lone old MSRP is
  // retained in the review diff, rather than recast as a sale after a price rise.
  const maximum = Math.max(
    ...variants.flatMap((v) => [v.price, ...(v.compare_at_price && v.compare_at_price > v.price ? [v.compare_at_price] : [])]),
  );
  const sales = previous.length > 1 ? previous.filter((value) => value < Math.max(...previous) && value < maximum) : [];
  return [...new Set([...sales, ...variants.map((v) => v.price), maximum])].sort((a, b) => a - b);
}

function inferMaterials(product: Product, label: string) {
  if (label === "Sim") return undefined;
  if (/^Deathgrey/.test(label)) return ["Deathgrey"];
  if (label === "Deathpink") return ["Deathpink"];
  const rows = contents(product.description);
  if (rows.some((row) => /photoresin.*miniature|miniature.*photoresin/i.test(row))) return ["Photoresin"];
  if (rows.some((row) => /(?:hard )?plastic.*miniature|miniature.*(?:hard )?plastic/i.test(row))) return ["Plastic"];
  if (rows.some((row) => /resin.*miniature|miniature.*resin/i.test(row))) return ["Resin"];
  return undefined;
}

function match(catalog: Catalog, product: Product, mappings: Record<string, Mapping>) {
  if (mappings[product.handle]) return { mapping: mappings[product.handle], confidence: "curated" };
  const listing = productUrl("/products/" + product.handle);
  const matches = categories.flatMap((category) =>
    Object.entries(catalog[category]).flatMap(([itemId, item]) => {
      const urls = [item.url, ...(item.urls ?? []), ...(item.editions ?? []).map((e) => e.url)].filter((url): url is string => !!url);
      const urlMatches = urls.some((url) => {
        try {
          return productUrl(url) === listing;
        } catch {
          return false;
        }
      });
      const names = [item.name, ...(item.aliases ?? [])].map(normalized);
      return urlMatches || names.includes(normalized(product.title)) ? [{ category, itemId, item, urlMatches }] : [];
    }),
  );
  if (matches.length !== 1) return { confidence: matches.length ? "ambiguous" : "unmatched", candidates: matches.map((x) => x.itemId) };
  const { category, itemId, item, urlMatches } = matches[0]!;
  const edition = item.editions?.filter((e) => {
    try {
      const url = e.url ?? item.url;
      return !!url && productUrl(url) === listing;
    } catch {
      return false;
    }
  });
  const format = edition?.[0]?.v.match(/^(Painters|Bust)(?::|$)/)?.[1];
  const formatMatches = format && edition?.every((release) => release.v === format || release.v.startsWith(format + ": "));
  const gameplay = formatMatches ? [...new Set(edition!.map((release) => release.gameplay ?? item.gameplay === true))] : [];
  return {
    mapping: {
      category,
      itemId,
      ...(edition?.length === 1 || formatMatches ? { edition: edition![0]!.v } : {}),
      ...(gameplay.length === 1 ? { gameplay: gameplay[0] } : {}),
    },
    confidence: urlMatches ? "url" : "name",
  };
}

export function applyAvailability(catalog: Catalog, products: Product[], mappings: Record<string, Mapping> = {}) {
  const observed = new Map<Edition, boolean>();
  const unresolved: { handle: string; edition?: string }[] = [];
  for (const product of products) {
    if (/pre-?order/i.test(product.handle) || productExclusion(product.handle, product.title)) continue;
    const result = match(catalog, product, mappings);
    const mapping = result.mapping;
    if (!mapping) {
      if (product.variants.some((variant) => variant.available === true)) unresolved.push({ handle: product.handle });
      continue;
    }
    const item = catalog[mapping.category][mapping.itemId];
    if (!item?.editions?.length) continue;
    const standard = item.editions.filter((edition) => edition.v !== "Sim" && !/^(Painters|Bust)(?::|$)/.test(edition.v));
    const fallback =
      mapping.edition ??
      (standard.length === 1 ? standard[0]!.v : undefined) ??
      (product.product_type === "whitebox" && standard.some((edition) => edition.v === "Plastic") ? "Plastic" : undefined) ??
      inferMaterials(product, "Plastic")?.[0] ??
      "Box";
    for (const variant of product.variants) {
      if (mapping.variantIds && !mapping.variantIds.includes(variant.id)) continue;
      if (typeof variant.available !== "boolean") continue;
      const label = mapping.variantEditions?.[String(variant.id)] ?? variantLabel(variant, fallback);
      const edition = item.editions.find((edition) => edition.v === label);
      if (!edition) {
        if (variant.available) unresolved.push({ handle: product.handle, edition: label });
        continue;
      }
      // An edition is available if any matching warehouse or product variant is available.
      observed.set(edition, (observed.get(edition) ?? false) || variant.available);
    }
  }
  for (const [edition, available] of observed) {
    if (available) edition.available = true;
    else delete edition.available;
  }
  return { checkedEditions: observed.size, availableEditions: [...observed.values()].filter(Boolean).length, unresolved };
}

export function planUpdate(
  before: Catalog,
  evidence: Evidence[],
  mappings: Record<string, Mapping>,
  news: { date: string; shopUrl: string; postUrl: string; itemName: string }[],
  tags: Tags,
) {
  const catalog = structuredClone(before);
  const unresolved: { handle: string; reason: string; candidates?: string[] }[] = [];
  const sources: {
    handle: string;
    itemId: string;
    category: Category;
    checkedAt: string;
    url: string;
    contents: string[];
    variants: Variant[];
    confidence: string;
  }[] = [];
  const warnings: string[] = [];
  const excluded: { handle: string; reason: string }[] = [];
  for (const source of evidence) {
    const product = source.data;
    const exclusion =
      productExclusion(product.handle, product.title) ??
      (mappings[product.handle]?.create?.accessoryType === "art-print" ? "Art prints are excluded from the catalog for now" : undefined);
    if (exclusion) {
      excluded.push({ handle: product.handle, reason: exclusion });
      continue;
    }
    const result = match(catalog, product, mappings);
    if (!result.mapping) {
      unresolved.push({ handle: product.handle, reason: result.confidence, candidates: result.candidates });
      continue;
    }
    const mapping = result.mapping;
    const temporary = /pre-?order/i.test(product.handle);
    let item = catalog[mapping.category][mapping.itemId];
    if (!item && mapping.create) item = catalog[mapping.category][mapping.itemId] = { ...structuredClone(mapping.create), tags: [] };
    if (!item) {
      unresolved.push({ handle: product.handle, reason: "Mapping refers to a missing item" });
      continue;
    }
    const digital = product.variants.every((v) => !v.requires_shipping);
    if (digital && !item.editions && item.url) {
      if (item.urls?.length || item.priceMinimum) {
        unresolved.push({ handle: product.handle, reason: "Existing physical alternatives require a curated edition mapping" });
        continue;
      }
      item.editions = [{ v: "Box", url: item.url, ...(item.price !== undefined ? { $: [item.price] } : {}) }];
    }
    const rows = contents(product.description);
    const fallback =
      mapping.edition ??
      (digital ? "Sim" : (inferMaterials(product, "Plastic")?.[0] ?? (mapping.category === "accessories" ? "General" : "Box")));
    const variantGroups = new Map<string, Variant[]>();
    const selectedVariants = mapping.variantIds ? product.variants.filter((v) => mapping.variantIds!.includes(v.id)) : product.variants;
    if (!selectedVariants.length) {
      unresolved.push({ handle: product.handle, reason: "Mapped variants are absent from the current listing" });
      continue;
    }
    for (const variant of selectedVariants) {
      const label = mapping.variantEditions?.[String(variant.id)] ?? variantLabel(variant, fallback);
      const group = variantGroups.get(label) ?? [];
      group.push(variant);
      variantGroups.set(label, group);
      if (variant.compare_at_price !== null && variant.compare_at_price > 0 && variant.compare_at_price < variant.price)
        warnings.push(
          `${product.handle}: compare-at price ${variant.compare_at_price} is below price ${variant.price}; it is not treated as a sale.`,
        );
    }
    if (mapping.category === "accessories" && ["shirt", "dice", "art-print"].includes(item.accessoryType ?? "")) {
      const prices = [...new Set(selectedVariants.map((v) => v.price))];
      item.price = Math.min(...prices);
      if (prices.length > 1) item.priceMinimum = true;
      else delete item.priceMinimum;
      if (!temporary) item.url ??= "/products/" + product.handle;
    } else {
      item.editions ??= [];
      if (item.url) for (const edition of item.editions) edition.url ??= item.url;
      delete item.url;
      for (const [label, variants] of variantGroups) {
        let edition = item.editions.find((e) => e.v === label);
        if (!edition) {
          edition = { v: label };
          item.editions.push(edition);
        }
        edition.$ = observedPrices(variants, edition.$);
        delete edition.priceEstimated;
        if (!temporary && (!edition.url || mapping.replaceUrl)) edition.url = "/products/" + product.handle;
        const material = /^Deathgrey|^Deathpink/.test(label)
          ? inferMaterials(product, label)
          : (mapping.materials ?? inferMaterials(product, label) ?? edition.materials);
        if (label !== "Sim" && material) {
          if (
            material.length === 1 &&
            material[0] === label &&
            ["Plastic", "Resin", "Photoresin", "Deathgrey", "Metal", "PVC", "Deathpink"].includes(label)
          )
            delete edition.materials;
          else edition.materials = material;
        }
        if (mapping.releaseDate && (!mapping.edition || mapping.edition === label)) {
          edition.r = mapping.releaseDate;
          delete edition.releaseWindow;
        }
        if (mapping.gameplay !== undefined) {
          if (label === "Sim" || /^(Painters|Bust)(?::|$)/.test(label)) {
            if ((item.gameplay === true) !== mapping.gameplay) edition.gameplay = mapping.gameplay;
            else delete edition.gameplay;
          } else if (mapping.gameplay) item.gameplay = true;
          else delete item.gameplay;
        }
      }
      delete item.price;
      delete item.priceMinimum;
      delete item.url;
      delete item.urls;
      delete item.shopReachable;
      for (const edition of item.editions)
        if (Object.hasOwn(edition, "gameplay") && edition.gameplay === item.gameplay) delete edition.gameplay;
      item.editions.sort(editionComparator(item, mapping.itemId));
    }
    const announcements = news
      .filter((row) => {
        try {
          return productUrl(row.shopUrl) === productUrl("/products/" + product.handle);
        } catch {
          return false;
        }
      })
      .map((row) => row.date);
    if (announcements.length) item.announcements = [...new Set([...(item.announcements ?? []), ...announcements])].sort();
    sources.push({
      handle: product.handle,
      itemId: mapping.itemId,
      category: mapping.category,
      checkedAt: source.checkedAt,
      url: source.url,
      contents: rows,
      variants: product.variants,
      confidence: result.confidence,
    });
  }
  applyAvailability(
    catalog,
    evidence.map((source) => source.data),
    mappings,
  );
  normalizeCatalog(catalog);
  for (const category of categories)
    for (const [id, item] of Object.entries(catalog[category])) item.editions?.sort(editionComparator(item, id));
  applyTags(catalog, tags, mappings);
  organizeCatalog(catalog);
  const changes = categories.flatMap((category) =>
    Object.entries(catalog[category]).flatMap(([itemId, item]) =>
      isDeepStrictEqual(before[category][itemId], item)
        ? []
        : [{ category, itemId, before: before[category][itemId] ?? null, after: item }],
    ),
  );
  return { catalog, changes, sources, unresolved, excluded, warnings: [...new Set(warnings)], releaseGaps: releaseGaps(catalog) };
}

export { compareEditions } from "./order.mts";
