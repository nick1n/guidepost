import type { Edition, Item } from "./types.mts";

// Use only when creating a release. Existing IDs survive label and fact changes.
export function editionId(label: string, editions: readonly Pick<Edition, "id">[] = []) {
  const id = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!id || id === "item" || id === "bundle") throw new Error(`Release label needs a curated edition ID: ${label}`);
  if (editions.some((edition) => edition.id === id)) throw new Error(`Duplicate edition ID: ${id}; review the release identity`);
  return id;
}

const families = [
  "frozen-survivor",
  "indomitable-survivor",
  "legendary-character",
  "pillar",
  "seed-pattern-survivor",
  "wanderer",
  "death-high",
  "sci-fi",
];
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function itemFamily(id: string, item: Item) {
  if (/\bbust\b/i.test(item.name) || /^(?:set-)?bust-/.test(id)) return "bust";
  if (
    /painter['’]?s?\s+scale/i.test(item.name) ||
    /^(?:set-)?painters-scale-/.test(id) ||
    (item.size === "50" && item.tags.includes("painters-scale"))
  )
    return "painters-scale";
  const name = slug(item.name);
  return families.find((family) => name.startsWith(family + "-")) ?? (item.tags.includes("pinup") ? "pinup" : undefined);
}

function familyId(id: string, item: Item) {
  id = id.replace(/^beta-/, "").replace(/-beta$/, "");
  if (item.accessoryType === "dice" || item.accessoryType === "shirt") {
    const type = item.accessoryType;
    const base = id.replace(new RegExp("^" + type + "-"), "").replace(type === "dice" ? /-(?:death-)?dice$/ : /-shirt$/, "");
    return type + "-" + base;
  }
  if (item.kind === "vignette") return "vignette-of-death-" + id.replace(/^set-/, "").replace(/^vignette(?:-of-death)?-/, "");
  if (item.kind === "armor-kit") return "armor-kit-" + id.replace(/^(?:set-|armor-kit-)/, "").replace(/-armor-(?:kit|set)$/, "");
  if (item.kind === "naked" && id.startsWith("set-")) id = id.slice(4);
  const kind = item.kind === "set" || item.kind === "expansion" ? item.kind : undefined;
  let base = kind ? id.replace(new RegExp("^" + kind + "-"), "").replace(kind === "expansion" ? /-expansion$/ : /$^/, "") : id;
  const family = itemFamily(id, item);
  if (family === "bust" || family === "painters-scale") {
    const named = slug(item.name);
    base = base.replace(new RegExp("(?:^|-)" + family + "(?=-|$)", "g"), "").replace(/^-|-$/g, "");
    const namedFamily = families.find((value) => named.startsWith(value + "-"));
    if (namedFamily && !base.startsWith(namedFamily + "-"))
      base = named.replace(new RegExp("(?:^|-)" + family + "(?=-|$)", "g"), "").replace(/^-|-$/g, "");
    base = family + "-" + base;
  } else if (!kind && /\bpinup\b/i.test(item.name) && !/experiment of death/i.test(item.name)) {
    base = "pinup-" + base.replace(/(?:^|-)pinup(?=-|$)/g, "").replace(/^-|-$/g, "");
  } else if (!kind && family && families.includes(family)) {
    // The earlier name audit established these family labels independently of tags.
    if (!base.startsWith(family + "-")) base = slug(item.name);
  }
  return kind ? kind + "-" + base : base;
}

export function prefixedId(id: string, item: Item) {
  const value = familyId(id, item);
  if (/\bSatan X\b/i.test(item.name)) return value;
  return value.replace(/-([ivxlcdm]+)(?=-bundle$|$)/g, (suffix, numeral: string) => {
    if (!/^(?=[mdclxvi])m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/.test(numeral)) return suffix;
    const digits: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    let number = 0;
    for (let index = 0; index < numeral.length; index++) {
      const current = digits[numeral[index]!]!;
      number += current < (digits[numeral[index + 1]!] ?? 0) ? -current : current;
    }
    return "-" + number;
  });
}
