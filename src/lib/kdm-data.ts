// Kingdom Death: Monster catalog.
// Prices are stored in cents. Edit / extend freely — the UI is fully data driven.

export const STORE_BASE = "https://shop.kingdomdeath.com"

export type ItemKind = "core" | "beta" | "promo" | "expansion" | "white-box" | "set"

export type Edition = {
  v: string
  $: number[]
  limit?: boolean
  r?: string
}

/** Standard Kingdom Death beta release editions. */
export const BETA_EDITIONS: Edition[] = [
  { v: "First Run", $: [3400], limit: true },
  { v: "Deathgrey", $: [3900], limit: true },
  { v: "Encore", $: [3400] },
]

export type ContentItem = {
  id: string
  name: string
  /** longer / official name, shown as a subtitle when present */
  alt?: string
  kind: ItemKind
  /** true = includes rules / cards / gameplay content, false = models only */
  gameplay: boolean
  price?: number
  /** selectable editions, e.g. ["1.3","1.5","1.6"] */
  versions?: Edition[]
  /** beta release editions (First Run / Deathgrey / Encore) */
  editions?: Edition[]
  tags: string[]
  /** ids of other items required to use this one (core box is always assumed) */
  requires?: string[]
  url?: string
}

export type DiceSet = {
  id: string
  name: string
  price?: number
  colors: [string,string]
  text: [string,string]
  tags: string[]
  url?: string
}

export type Bundle = {
  id: string
  name: string
  price?: number
  gameplay: boolean
  tags: string[]
  includes: string[]
  url?: string
}

export const content: ContentItem[] = [
  {
    id: "core",
    name: "Kingdom Death: Monster",
    kind: "core",
    gameplay: true,
    price: 44400,
    "versions": [
      { "v": "Sim", $: [2000], "r": "2022-11-25" },
      { "v": "1.3", $: [10000], "r": "2015-09-15" },
      { "v": "1.5", $: [25000], "r": "2017-10-13" },
      { "v": "1.6", "$": [40000, 44400], "r": "2021-11-26" }
    ],
    url: "/products/kingdom-death-monster-1-6",
    tags: [
      "core",
      "monster-phoenix",
      "monster-white-lion",
      "monster-butcher",
      "monster-gold-smoke-knight",
      "monster-kings-man",
      "monster-hand",
      "monster-screaming-antelope",
      "monster-watcher",
      "survivor",
      "male",
      "female",
      "allister",
      "lucy",
      "erza",
      "zachary",
      "novel-proficiency",
      "weapon-proficiency",
    ],
  },
  {
    id: "gamblers-chest",
    name: "Gambler's Chest Expansion",
    kind: "expansion",
    gameplay: true,
    price: 42000,
    "versions": [
      { "v": "Sim", $: [4200], "r": "2022-11-25" },
      { "v": "1.6", "$": [37000, 42000], "r": "2021-11-26" }
    ],
    url: "/products/gamblers-chest",
    tags: [
      "expansion",
      "core",
      "campaign",
      "gamblers-chest",
      "arc-survivor",
      "smog-singers",
      "crimson-crocodile",
      "king",
      "atnas",
      "survivor",
      "male",
      "female",
    ],
  },

  /* ── Monster expansions ───────────────────────────────── */
  {
    id: "expansion-flower-knight",
    name: "Flower Knight Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/flower-knight-expansion-1-6",
    tags: ["expansion", "monster-flower-knight", "knight", "node-2-quarry"],
  },
  {
    id: "expansion-dung-beetle-knight",
    name: "Dung Beetle Knight Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.5", $: [8000], "r": "2021-11-26" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
      { "v": "1.67", $: [8000], "r": "Q4 2026" }
    ],
    url: "/products/dung-beetle-knight-expansion-1-6",
    tags: ["expansion", "monster-dung-beetle-knight", "knight", "node-4-quarry"],
  },
  {
    id: "expansion-gorm",
    name: "Gorm Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/gorm-expansion-1-6",
    tags: ["expansion", "monster-gorm", "node-1-quarry", "gear", "armor"],
  },
  {
    id: "expansion-spidicules",
    name: "Spidicules Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/spidicules-expansion-1-6",
    tags: ["expansion", "monster-spidicules", "node-2-quarry", "silk", "gear"],
  },
  {
    id: "expansion-sunstalker",
    name: "Sunstalker Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/sunstalker-expansion-1-6",
    tags: ["expansion", "monster-sunstalker", "campaign", "node-3-quarry", "pot-sun"],
  },
  {
    id: "expansion-dragon-king",
    name: "Dragon King Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/dragon-king-expansion-1-6",
    tags: ["expansion", "monster-dragon-king", "campaign", "node-4-quarry", "king"],
  },
  {
    id: "expansion-lion-knight",
    name: "Lion Knight Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/lion-knight-expansion-1-6",
    tags: ["expansion", "monster-lion-knight", "knight", "nemesis", "showdown"],
  },
  {
    id: "expansion-lion-god",
    name: "Lion God Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/lion-god-expansion-1-6",
    tags: ["expansion", "monster-lion-god", "nemesis", "scholar", "node-3-quarry"],
  },
  {
    id: "expansion-manhunter",
    name: "Manhunter Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/manhunter-expansion-1-6",
    tags: ["expansion", "monster-manhunter", "nemesis", "gear", "survivor", "male"],
  },
  {
    id: "expansion-slenderman",
    name: "Slenderman Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/slenderman-expansion-1-6",
    tags: ["expansion", "monster-slenderman", "nemesis", "dark"],
  },
  {
    id: "expansion-lonely-tree",
    name: "Lonely Tree Expansion",
    kind: "expansion",
    gameplay: true,
    price: 3500,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/lonely-tree-expansion-1-6",
    tags: ["expansion", "monster-lonely-tree", "special-showdown", "terrain"],
  },
  {
    id: "expansion-green-knight-armor",
    name: "Green Knight Armor Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/green-knight-armor-expansion-1-6",
    requires: ["expansion-dung-beetle-knight", "expansion-gorm", "expansion-spidicules", "expansion-sunstalker"],
    tags: ["expansion", "monster-green-knight", "nemesis", "gear", "armor", "knight"],
  },
  {
    id: "expansion-black-knight",
    name: "Black Knight Expansion",
    kind: "expansion",
    gameplay: true,
    price: 8000,
    "versions": [
      { "v": "Sim", $: [700], "r": "2025-11-25" },
      { "v": "1.6", "$": [6500, 8000], "r": "2021-11-26" },
    ],
    url: "/products/black-knight-expansion-1-6",
    tags: ["expansion", "monster-black-knight", "nemesis", "knight", "gear"],
  },

  /* ── Pinups ───────────────────────────────────────────── */
  {
    id: "pinups-of-death-1",
    name: "Pinups Of Death I",
    kind: "set",
    gameplay: true,
    price: 6000,
    url: "/products/pinups-of-death-1",
    tags: ["pinup", "bundle", "survivor", "female"],
  },
  {
    id: "pinups-of-death-2",
    name: "Pinups Of Death II",
    kind: "set",
    gameplay: true,
    price: 6000,
    url: "/products/pinups-of-death-2",
    tags: ["pinup", "bundle", "survivor", "female"],
  },
  {
    id: "pinups-of-death-3",
    name: "Pinups Of Death III",
    kind: "set",
    gameplay: false,
    price: 6000,
    url: "/products/pinups-of-death-3",
    tags: ["pinup", "bundle", "survivor", "female"],
  },
  {
    id: "pinup-twilight-knight",
    name: "Pinup Twilight Knight",
    kind: "set",
    gameplay: false,
    price: 2000,
    url: "/products/pinup-twilight-knight",
    tags: ["pinup", "twilight-knight", "survivor", "female"],
  },

  /* ── White boxes ──────────────────────────────────────── */
  {
    id: "beyond-the-wall",
    name: "Beyond the Wall",
    kind: "white-box",
    gameplay: true,
    price: 3500,
    url: "/products/beyond-the-wall-1a",
    tags: ["white-box", "gear", "armor", "item", "survivor", "female"],
  },
  {
    id: "vignette-of-death-killennium-butcher",
    name: "Vignette of Death: Killennium Butcher",
    kind: "white-box",
    gameplay: true,
    price: 4000,
    url: "/products/vignette-of-death-killennium-butcher",
    tags: ["core", "white-box", "vignette", "butcher", "survivor", "male", "female", "novel-proficiency"],
  },
  {
    id: "legendary-character-hollow",
    name: "Legendary Character - Hollow",
    kind: "white-box",
    gameplay: true,
    price: 3000,
    url: "/products/legendary-character-hollow",
    tags: ["white-box", "legendary", "character", "savior", "survivor", "female", "hollow"],
  },
  {
    id: "white-box-nico-bird-knight",
    name: "Nico the Bird Knight",
    kind: "white-box",
    gameplay: true,
    price: 3000,
    url: "/products/nico-the-bird-knight",
    tags: ["white-box", "character", "survivor", "female", "bird-knight", "gear"],
  },
  {
    id: "white-box-percival",
    name: "Percival",
    kind: "white-box",
    gameplay: true,
    price: 3000,
    url: "/products/percival",
    tags: ["white-box", "character", "survivor", "male", "gear", "item"],
  },
  {
    id: "white-box-candy-and-cola",
    name: "Candy & Cola",
    kind: "white-box",
    gameplay: true,
    price: 3500,
    url: "/products/candy-and-cola",
    tags: ["white-box", "character", "survivor", "female", "gear", "twilight-knight"],
  },
  {
    id: "white-box-great-game-hunter",
    name: "Great Game Hunter",
    kind: "white-box",
    gameplay: true,
    price: 3000,
    url: "/products/great-game-hunter",
    tags: ["white-box", "character", "survivor", "male", "gear", "hunter"],
  },
  {
    id: "white-box-aya-white-speaker",
    name: "Aya the White Speaker",
    kind: "white-box",
    gameplay: true,
    price: 3000,
    url: "/products/aya-the-white-speaker",
    tags: ["white-box", "character", "survivor", "female", "white-speaker", "gear"],
  },
  {
    id: "white-box-allison-twilight-knight",
    name: "Allison the Twilight Knight",
    kind: "white-box",
    gameplay: true,
    price: 3000,
    url: "/products/allison-the-twilight-knight",
    tags: ["white-box", "character", "survivor", "female", "twilight-knight", "gear"],
  },

  /* ── Betas ────────────────────────────────────────────── */
  {
    id: "beta-pillar-summer-grimmory",
    name: "Summer Grimmory (Beta)",
    alt: "Pillar - Summer Grimmory (Beta)",
    kind: "beta",
    gameplay: true,
    price: 3400,
    editions: BETA_EDITIONS,
    tags: ["white-box", "pillar", "beta", "pot-sun", "trait", "grimmory"],
    requires: ["expansion-sunstalker"],
  },
  {
    id: "beta-edlen",
    name: "Edlen (Beta)",
    kind: "beta",
    gameplay: true,
    price: 3400,
    editions: BETA_EDITIONS,
    tags: ["white-box", "beta", "survivor", "female", "gear", "item", "edlen"],
  },
  {
    id: "beta-pillar-winter-grimmory",
    name: "Winter Grimmory (Beta)",
    alt: "Pillar - Winter Grimmory (Beta)",
    kind: "beta",
    gameplay: true,
    price: 3400,
    editions: BETA_EDITIONS,
    tags: ["white-box", "pillar", "beta", "trait", "grimmory"],
  },

  /* ── Promos ───────────────────────────────────────────── */
  {
    id: "promo-nightmare-ram",
    name: "Nightmare Ram (Promo)",
    kind: "promo",
    gameplay: true,
    price: 2000,
    tags: ["promo", "monster", "special-showdown", "ram"],
  },
  {
    id: "promo-halloween-white-speaker",
    name: "Halloween White Speaker (Promo)",
    kind: "promo",
    gameplay: false,
    price: 2000,
    tags: ["promo", "pinup", "survivor", "female", "white-speaker", "halloween"],
  },
  {
    id: "promo-holiday-white-speaker",
    name: "Holiday White Speaker (Promo)",
    kind: "promo",
    gameplay: false,
    price: 2000,
    tags: ["promo", "pinup", "survivor", "female", "white-speaker", "holiday"],
  },
  {
    id: "promo-gorm-pinup",
    name: "Gorm Pinup (Promo)",
    kind: "promo",
    gameplay: false,
    price: 2000,
    requires: ["expansion-gorm"],
    tags: ["promo", "pinup", "survivor", "female", "monster-gorm"],
  },
]

export const dice: DiceSet[] = [
  {
    id: "black-and-red-dice",
    name: "Black and Red Dice",
    price: 2000,
    colors: ["#151313", "#8f1f22"],
    text: ["Black", "Red"],
    tags: ["dice"],
    url: "/products/black-and-red-dice",
  },
  {
    id: "black-friday-death-dice",
    name: "Black Friday Death Dice",
    price: 2000,
    colors: ["#6f6a68", "#151313"],
    text: ["Grey", "Black"],
    tags: ["dice", "black-friday", "promo"],
  },
  {
    id: "black-out-death-dice",
    name: "Black Out Dice",
    price: 2000,
    colors: ["#151313", "#0b0a09"],
    text: ["Black", "Black"],
    tags: ["dice"],
  },
  {
    id: "Classic-death-dice",
    name: "Classic Death Dice",
    price: 2000,
    colors: ["#fdfffe", "#151313"],
    text: ["White", "Black"],
    tags: ["dice"],
  },
  {
    id: "gold-smoke-knight-dice",
    name: "Gold Smoke Knight Dice",
    price: 2000,
    colors: ["#c9a227", "#151313"],
    text: ["Gold", "Black"],
    tags: ["dice", "gold-smoke-knight"],
  },
  {
    id: "sunstalker-dice",
    name: "Sunstalker Dice",
    price: 12000,
    colors: ["#f0c26b", "#2b2b6b"],
    text: ["Yellow", "Foil"],
    tags: ["dice", "monster-sunstalker"],
  },
]

export const bundles: Bundle[] = [
  {
    id: "expansion-of-death-vol-1-6",
    name: "Expansion of Death Vol 1.6",
    price: 105500,
    url: "/products/expansion-of-death-vol-1-6",
    tags: ["bundle", "expansion"],
    gameplay: true,
    includes: [
      "expansion-dragon-king",
      "expansion-dung-beetle-knight",
      "expansion-flower-knight",
      "expansion-gorm",
      "expansion-green-knight-armor",
      "expansion-lion-god",
      "expansion-lion-knight",
      "expansion-lonely-tree",
      "expansion-manhunter",
      "expansion-slenderman",
      "expansion-spidicules",
      "expansion-sunstalker",
    ],
  },
  {
    id: "pinups-of-death-collection",
    name: "Pinups of Death Collection",
    price: 16000,
    tags: ["bundle", "pinup"],
    gameplay: true,
    includes: ["pinups-of-death-1", "pinups-of-death-2", "pinups-of-death-3", "pinup-twilight-knight"],
  },
  {
    id: "white-box-starter-bundle",
    name: "White Box Starter Bundle",
    price: 18000,
    tags: ["bundle", "white-box"],
    gameplay: true,
    includes: [
      "beyond-the-wall",
      "white-box-percival",
      "white-box-nico-bird-knight",
      "white-box-aya-white-speaker",
      "white-box-allison-twilight-knight",
      "white-box-candy-and-cola",
      "white-box-great-game-hunter",
    ],
  },
  {
    id: "black-friday-bundle",
    name: "Black Friday Bundle",
    price: 24000,
    tags: ["bundle", "black-friday", "promo"],
    gameplay: true,
    includes: [
      "promo-nightmare-ram",
      "promo-halloween-white-speaker",
      "promo-holiday-white-speaker",
      "promo-gorm-pinup",
      "black-friday-death-dice",
      "black-out-death-dice",
    ],
  },
  {
    id: "dice-of-death-bundle",
    name: "Dice of Death Bundle",
    price: 15000,
    tags: ["bundle", "dice"],
    gameplay: false,
    includes: [
      "black-and-red-dice",
      "black-out-death-dice",
      "white-death-dice",
      "gold-smoke-knight-dice",
      "phoenix-dice",
      "sunstalker-dice",
      "lantern-dice",
    ],
  },
]

/* ── helpers ──────────────────────────────────────────── */

export const nameById: Record<string, string> = Object.fromEntries([
  ...content.map((c) => [c.id, c.name]),
  ...dice.map((d) => [d.id, d.name]),
])

export function formatPrice(cents?: number) {
  if (cents == null) return "—"
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function storeUrl(path?: string) {
  if (!path) return undefined
  return path.startsWith("http") ? path : `${STORE_BASE}${path}`
}

/** Price of a content item, summing every selected version or beta edition. */
export function effectivePrice(item: ContentItem, versionIds: string[] = [], editionIds: string[] = []) {
  const versionTotal = item.versions && versionIds.length
    ? item.versions
      .filter((version) => versionIds.includes(version.v))
      .reduce((sum, version) => sum + (version.$[0] ?? 0), 0)
    : 0
  const editionTotal = item.editions && editionIds.length
    ? item.editions
      .filter((edition) => editionIds.includes(edition.v))
      .reduce((sum, edition) => sum + (edition.$[0] ?? 0), 0)
    : 0

  if (versionIds.length || editionIds.length) return versionTotal + editionTotal
  // An owned item with no explicit selection still uses its catalog default price.
  return item.price ?? 0
}

export const allContentTags = Array.from(new Set(content.flatMap((c) => c.tags))).sort()
export const allDiceTags = Array.from(new Set(dice.flatMap((d) => d.tags))).sort()
