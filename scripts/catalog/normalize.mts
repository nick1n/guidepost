import { recordAvailability, recordStock, invalidateListingEvidence, syncStockTag } from "./stock.mts";
import { catalogListing, productUrl, shopLinkUrl } from "./shop.mts";
import { categories, type Catalog, type Item } from "./types.mts";

export function catalogUrl(value: string) {
  const parsed = new URL(value, "https://shop.kingdomdeath.com");
  const url = parsed.hostname === "shop.kingdomdeath.com" ? shopLinkUrl(value) : parsed;
  url.searchParams.delete("variant");
  return value.startsWith("/") ? url.pathname + url.search + url.hash : url.href;
}

export function inheritEncoreDates(item: Item) {
  const editions = item.editions ?? [];
  for (const prefix of ["", "Painters: ", "Bust: "]) {
    for (const encore of editions) {
      if (encore.label !== prefix + "Encore" || encore.releaseDate || encore.releaseWindow) continue;
      const candidates = editions.filter((edition) => edition.includedOnly === encore.includedOnly);
      const source =
        candidates.find((edition) => edition.label === prefix + "First Run" && edition.releaseDate) ??
        candidates.find((edition) => edition.label.startsWith(prefix + "Deathgrey") && edition.releaseDate);
      // User-approved fallback stays within the same standalone or included release type.
      if (source) encore.releaseDate = source.releaseDate;
    }
  }
}

// Capture resolved listings before a writer changes handles or external URLs.
export function listingSnapshot(item: Item) {
  const listing = (edition?: NonNullable<Item["editions"]>[number]) => {
    const url = catalogListing(item, edition);
    if (!url) return undefined;
    try {
      return productUrl(url);
    } catch {
      return new URL(url, "https://shop.kingdomdeath.com").href;
    }
  };
  return { item: listing(), editions: new Map((item.editions ?? []).map((edition) => [edition.id ?? edition.label, listing(edition)])) };
}

export function clearChangedListings(item: Item, before: ReturnType<typeof listingSnapshot>) {
  const after = listingSnapshot(item);
  if (before.item !== after.item || item.editions?.length) recordStock(item, undefined);
  for (const edition of item.editions ?? [])
    if (
      before.editions.has(edition.id ?? edition.label) &&
      before.editions.get(edition.id ?? edition.label) !== after.editions.get(edition.id ?? edition.label)
    ) {
      invalidateListingEvidence(edition);
    }
  syncStockTag(item);
}

export function normalizeItem(item: Item) {
  const listings = listingSnapshot(item);
  for (const edition of item.editions ?? []) {
    if (edition.includedOnly) delete edition.prices;
    if (edition.label === "Deathgrey M2 Edition") edition.label = "Deathgrey M2";
    recordAvailability(edition, edition.available === true);
    edition.format ??= ["Sim", "3D Files"].includes(edition.label) ? "digital" : "physical";
    if (edition.label === "Sim") edition.simulator = true;
    if (
      !edition.materials &&
      item.kind !== "accessory" &&
      !item.accessoryType &&
      ["Plastic", "Resin", "Photoresin", "Deathgrey", "Metal", "PVC", "Deathpink"].includes(edition.label)
    )
      edition.materials = [edition.label];
    if (
      edition.runSize !== undefined ||
      /\bfirst[\s-]+run\b|\bdeathgrey\b/i.test(
        [edition.label, edition.name, ...(edition.name ? [edition.name] : (edition.materials ?? []))].join(" "),
      )
    )
      edition.numbered = true;
  }
  // Accept legacy shop URLs at import boundaries, then store only the handle.
  for (const listing of [item, ...(item.editions ?? [])]) {
    if (!listing.url) continue;
    const parsed = new URL(listing.url, "https://shop.kingdomdeath.com");
    if (parsed.hostname === "shop.kingdomdeath.com" && /\/products\//.test(parsed.pathname)) {
      listing.handle = productUrl(listing.url).split("/").at(-1)!;
      delete listing.url;
    }
  }
  const handles = item.editions?.map((edition) => edition.handle ?? item.handle);
  if (handles?.length && handles.every((handle) => handle && handle === handles[0])) {
    item.handle = handles[0];
    for (const edition of item.editions!) delete edition.handle;
  } else if (item.handle && item.editions) {
    // A new listing splits a formerly shared handle into explicit edition handles.
    for (const edition of item.editions) edition.handle ??= item.handle;
    delete item.handle;
  }
  inheritEncoreDates(item);
  if (typeof item.alt === "string") {
    const key = (value: string) =>
      value
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
    const alias = item.alt.trim();
    if (alias && ![item.name, ...(item.aliases ?? [])].some((name) => key(name) === key(alias)))
      item.aliases = [...(item.aliases ?? []), alias];
  }
  delete item.alt;
  const content = new Map<string, string[]>();
  for (const edition of item.editions ?? []) {
    if (typeof edition.gameplayContent === "string" && edition.gameplayContent.trim()) {
      const text = edition.gameplayContent.trim();
      content.set(text, [...(content.get(text) ?? []), edition.label]);
    }
    delete edition.gameplayContent;
  }
  if (content.size) {
    const details = [...content].map(([text, labels]) => (content.size === 1 ? text : `${labels.join(", ")}: ${text}`));
    item.gameplayContent = [...new Set([...(item.gameplayContent ? [item.gameplayContent] : []), ...details])].join("\n\n");
  }
  const gameplay = item.gameplay === true;
  if (!gameplay) delete item.gameplay;
  if (item.url) item.url = catalogUrl(item.url);
  if (item.urls) item.urls = [...new Set(item.urls.map(catalogUrl))];
  for (const edition of item.editions ?? []) {
    if (edition.releaseWindow) edition.releaseWindow = edition.releaseWindow.replace(/^Q([1-4])\s+(\d{4})$/i, "$2 Q$1");
    if (edition.runSize === null) delete edition.runSize;
    delete edition.priceEstimated;
    if (Object.hasOwn(edition, "gameplay")) {
      edition.gameplay = edition.gameplay === true;
      if (edition.gameplay === gameplay) delete edition.gameplay;
    }
    if (edition.url) edition.url = catalogUrl(edition.url);
  }
  const urls = item.editions?.map((edition) => edition.url ?? item.url);
  if (urls?.length && urls.every((url) => url && url === urls[0])) {
    item.url = urls[0];
    for (const edition of item.editions!) delete edition.url;
  } else if (item.url && item.editions) {
    // Materialize the former shared listing before adding a different release.
    for (const edition of item.editions) edition.url ??= item.url;
    delete item.url;
  }
  clearChangedListings(item, listings);
}

export function normalizeCatalog(catalog: Catalog) {
  for (const category of categories) for (const item of Object.values(catalog[category])) normalizeItem(item);
  return catalog;
}
