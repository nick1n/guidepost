import catalog from "../../static/kdm-catalog/data.json";
import type { Catalog, Currency, Edition, Item } from "#lib/types/index.ts";

export const data = catalog as Catalog;
export const content = Object.entries(data.content).map(([id, item]) => ({ id, ...item }));

const priceFormatters = {
  USD: {
    whole: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
    fractional: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  EUR: {
    whole: new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
    fractional: new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
} satisfies Record<Currency, Record<"whole" | "fractional", Intl.NumberFormat>>;

export function formatPrice(cents?: number, currency: Currency = "USD") {
  if (cents == null) return "Not priced";
  const formatter = cents % 100 === 0 ? priceFormatters[currency].whole : priceFormatters[currency].fractional;
  return formatter.format(cents / 100);
}

// default exchange rate: 1 EUR = 1.13 USD.
const EUR_TO_USD = 1.13;

export function formatPriceTotals(totals: Partial<Record<Currency, number>>) {
  const usdCents = (totals.USD ?? 0) + (totals.EUR ?? 0) * EUR_TO_USD;
  return formatPrice(Math.round(usdCents));
}

export const STORE_BASE = "https://shop.kingdomdeath.com";

export function storeUrl(path?: string) {
  if (!path) return;
  return path.startsWith("http") ? path : `${STORE_BASE}${path}`;
}

const standardMaterials = new Set(["Plastic", "Resin", "Photoresin", "Deathgrey", "Metal", "PVC", "Deathpink"]);

export function editionMaterials(edition: Edition) {
  return edition.name ? [edition.name] : (edition.materials ?? (standardMaterials.has(edition.v) ? [edition.v] : []));
}

export function editionGameplay(item: Partial<Item>, edition: Edition) {
  return (Object.hasOwn(edition, "gameplay") ? edition.gameplay : item.gameplay) === true;
}

export function editionUrl(item: Partial<Item>, edition: Edition) {
  return edition.url ?? item.url;
}

export function editionSize(item: Partial<Item>, edition: Edition) {
  return edition.v === "Sim" ? undefined : (edition.size ?? item.size);
}

export function catalogTags(item: Partial<Item>, category: string) {
  const tags = new Set(item.tags ?? []);
  if (item.kind) tags.add(item.kind);
  if (category === "bundles") tags.add("bundle");
  if (category === "homebrew") tags.add("homebrew");
  if (item.accessoryType) tags.add(item.accessoryType);
  for (const material of (item.editions ?? []).flatMap(editionMaterials)) {
    tags.add(material.toLowerCase());
    if (["Photoresin", "Deathgrey", "Deathpink", "White Resin"].includes(material)) tags.add("resin");
  }
  if (item.gameplay !== true && (["model", "set", "armor-kit", "naked"].includes(item.kind ?? "") || category === "bundles"))
    tags.add("models-only");
  return [...tags].sort();
}
