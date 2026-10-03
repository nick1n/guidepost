import catalog from "./kdm-data.json";
import type { Bundle, Catalog, ContentItem, DiceSet, Filters, Currency } from "#lib/types/index.ts";

const data = catalog as unknown as Catalog;

export const content: ContentItem[] = Object.entries(data.content).map(([id, item]) => ({ id, ...item }));
export const dice: DiceSet[] = Object.entries(data.dice).map(([id, item]) => ({ id, ...item }));
export const bundles: Bundle[] = Object.entries(data.bundles).map(([id, item]) => ({ id, ...item }));
export const homebrew: ContentItem[] = Object.entries(data.homebrew).map(([id, item]) => ({ id, ...item }));
export const collectionItems = [...content, ...dice, ...homebrew];

export const defaultFilters: Filters = {
  query: "",
  sort: "price-desc",
  gameplay: "any",
  kind: "any",
  status: "any",
  tags: [],
};

export const nameById: Record<string, string> = Object.fromEntries(collectionItems.map((item) => [item.id, item.name]));
export const priceById: Record<string, number> = Object.fromEntries(collectionItems.map((item) => [item.id, item.price ?? 0]));

const priceFormatters = {
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  EUR: new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }),
} satisfies Record<Currency, Intl.NumberFormat>;

export function formatPrice(cents?: number, currency: Currency = "USD") {
  if (cents == null) return "Not priced";
  return priceFormatters[currency].format(cents / 100);
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

export function effectivePrice(item: ContentItem, versionIds: string[] = [], editionIds: string[] = []) {
  const versionTotal =
    item.versions && versionIds.length ? item.versions.filter((v) => versionIds.includes(v.v)).reduce((sum, v) => sum + v.$[0], 0) : 0;
  const editionTotal =
    item.editions && editionIds.length ? item.editions.filter((e) => editionIds.includes(e.v)).reduce((sum, e) => sum + e.$[0], 0) : 0;
  if (versionIds.length || editionIds.length) return versionTotal + editionTotal;
  return item.price ?? 0;
}

export function ownershipDefaults(item: ContentItem) {
  return { version: item.versions?.at(-1)?.v, edition: item.editions?.at(-1)?.v };
}

export const allContentTags = [...new Set(content.flatMap((item) => item.tags))].sort();
export const allDiceTags = [...new Set(dice.flatMap((item) => item.tags))].sort();
export const allHomebrewTags = [...new Set(homebrew.flatMap((item) => item.tags))].sort();

type Release = { v: string; materials?: string[]; gameplay?: boolean | null; size?: string; url?: string };
type Facts = {
  gameplay?: boolean | null;
  size?: string;
  kind?: string;
  accessoryType?: string;
  tags?: string[];
  editions?: Release[];
  url?: string;
};
const standardMaterials = new Set(["Plastic", "Resin", "Photoresin", "Deathgrey", "Metal", "PVC", "Deathpink"]);

export function editionMaterials(edition: Release) {
  return edition.v === "Sim" ? [] : (edition.materials ?? (standardMaterials.has(edition.v) ? [edition.v] : []));
}

export function editionGameplay(item: Facts, edition: Release) {
  return (Object.hasOwn(edition, "gameplay") ? edition.gameplay : item.gameplay) === true;
}

export function editionUrl(item: Facts, edition: Release) {
  return edition.url ?? item.url;
}

export function editionSize(item: Facts, edition: Release) {
  return edition.v === "Sim" ? undefined : (edition.size ?? item.size);
}

export function catalogTags(item: Facts, category: string) {
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
