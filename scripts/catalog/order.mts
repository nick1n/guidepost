import { categories, type Catalog, type Edition, type Item } from "./types.mts";

export function releaseDate(edition: Edition): number[] {
  if (edition.r) return edition.r.split("-").map(Number);
  const window = edition.releaseWindow ?? "";
  const year = window.match(/\b(19\d{2}|20\d{2})\b/);
  if (!year) return [Infinity, 0, 0];
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  let month = months.findIndex((value) => window.toLowerCase().includes(value)) + 1;
  const quarter = window.match(/\bQ([1-4])\b/i);
  if (quarter) month = (Number(quarter[1]) - 1) * 3 + 1;
  if (/valentine/i.test(window)) month = 2;
  if (/halloween/i.test(window)) month = 10;
  if (/black friday|thanksgiving/i.test(window)) month = 11;
  if (/christmas|x-mas/i.test(window)) month = 12;
  return [Number(year[1]), month, 0];
}

function compareDates(left: number[], right: number[]) {
  for (let index = 0; index < 3; index++) if (left[index] !== right[index]) return left[index]! < right[index]! ? -1 : 1;
  return 0;
}

const editionOrder = [
  "Sim",
  "Box",
  "Original",
  "First Run",
  "Deathgrey",
  "Deathgrey M2",
  "Deathpink",
  "Encore",
  "Plastic",
  "Painters",
  "Bust",
];

export function compareEditions(a: Edition, b: Edition) {
  const rank = (label: string) => {
    const index = editionOrder.indexOf(
      label
        .replace(/ Edition$/, "")
        .replace(/ \(\d{4}\)$/, "")
        .split(":")[0]!,
    );
    return index === -1 ? editionOrder.length : index;
  };
  return (
    Number(b.v === "Sim") - Number(a.v === "Sim") ||
    compareDates(releaseDate(a), releaseDate(b)) ||
    rank(a.v) - rank(b.v) ||
    rank(a.v.split(": ")[1] ?? a.v) - rank(b.v.split(": ")[1] ?? b.v)
  );
}

function itemDate(item: Item) {
  const physical = (item.editions ?? []).filter((edition) => edition.v !== "Sim");
  const dates = (physical.length ? physical : (item.editions ?? [])).map(releaseDate).sort(compareDates);
  if (dates[0]?.[0] !== undefined && dates[0][0] !== Infinity) return dates[0]!;
  if (typeof item.releaseYear === "number") return [item.releaseYear, 0, 0];
  return [Infinity, 0, 0];
}

export function editionComparator(_item: Item, _id: string) {
  return compareEditions;
}

export function organizeCatalog(catalog: Catalog) {
  for (const category of categories) {
    const entries = Object.entries(catalog[category]);
    const rank = (item: Item) => (category === "content" ? (item.kind === "core" ? 0 : item.kind === "expansion" ? 1 : 2) : 2);
    // Keep core and expansions first; alphabetize all remaining items by ID.
    entries.sort(([leftId, left], [rightId, right]) => {
      const a = rank(left);
      const b = rank(right);
      if (a !== b) return a - b;
      if (a === 1) {
        return compareDates(itemDate(left), itemDate(right)) || leftId.localeCompare(rightId, "en");
      }
      return leftId.localeCompare(rightId, "en");
    });
    catalog[category] = Object.fromEntries(entries);
  }
  return catalog;
}
