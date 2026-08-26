import catalog from "./kdm-data.json";
import type { Bundle, Catalog, ContentItem, DiceSet, Filters } from "#lib/types.ts";

export const STORE_BASE = "https://shop.kingdomdeath.com";

const data = catalog as unknown as Catalog;

export const content: ContentItem[] = Object.entries(data.content).map(([id, item]) => ({ id, ...item }));
export const dice: DiceSet[] = Object.entries(data.dice).map(([id, item]) => ({ id, ...item }));
export const bundles: Bundle[] = Object.entries(data.bundles).map(([id, item]) => ({ id, ...item }));
export const homebrew: ContentItem[] = Object.entries(data.homebrew).map(([id, item]) => ({ id, ...item }));

export const defaultFilters: Filters = {
  query: "",
  sort: "price-desc",
  gameplay: "any",
  kind: "any",
  status: "any",
  tags: [],
};

export const nameById: Record<string, string> = Object.fromEntries([...content, ...dice, ...homebrew].map((item) => [item.id, item.name]));
export const priceById: Record<string, number> = Object.fromEntries(
  [...content, ...dice, ...homebrew].map((item) => [item.id, item.price ?? 0]),
);

export function formatPrice(cents?: number) {
  if (cents == null) return "—";
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function storeUrl(path?: string) {
  if (!path) return undefined;
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

export const allContentTags = Array.from(new Set(content.flatMap((item) => item.tags))).sort();
export const allDiceTags = Array.from(new Set(dice.flatMap((item) => item.tags))).sort();
export const allHomebrewTags = Array.from(new Set(homebrew.flatMap((item) => item.tags))).sort();
