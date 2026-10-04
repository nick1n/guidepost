import { shopLinkUrl } from "./shop.mts";
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
    const source =
      editions.find((edition) => edition.v === prefix + "First Run" && edition.r) ??
      editions.find((edition) => edition.v.startsWith(prefix + "Deathgrey") && edition.r);
    if (source) {
      // User-approved fallback for Encore releases without their own date or window.
      for (const edition of editions) if (edition.v === prefix + "Encore" && !edition.r && !edition.releaseWindow) edition.r = source.r;
    }
  }
}

export function normalizeItem(item: Item) {
  for (const edition of item.editions ?? []) {
    if (edition.v === "Deathgrey M2 Edition") edition.v = "Deathgrey M2";
    if (edition.available !== true) delete edition.available;
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
      content.set(text, [...(content.get(text) ?? []), edition.v]);
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
}

export function normalizeCatalog(catalog: Catalog) {
  for (const category of categories) for (const item of Object.values(catalog[category])) normalizeItem(item);
  return catalog;
}
