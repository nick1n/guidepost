export const survivors = [
  { name: "Erza", color: "#B4745A", ink: "var(--contrast)", gender: "Female" },
  { name: "Zachary", color: "#7C562B", ink: "var(--foreground)", gender: "Male" },
  { name: "Allister", color: "#A4B3A6", ink: "var(--contrast)", gender: "Male" },
  { name: "Lucy", color: "#307FA7", ink: "var(--contrast)", gender: "Female" },
];

export const attributes = ["Movement", "Speed", "Accuracy", "Strength", "Luck", "Evasion"];
export const abbreviations = ["Mov", "Spd", "Acc", "Str", "Luck", "Eva"];

export function makeTokens(count: number) {
  return Array.from({ length: count }, () => ({ positive: 0, negative: 0 }));
}
export type TokenCount = ReturnType<typeof makeTokens>[number];
export function tokenNet(count: TokenCount) {
  return count.positive - count.negative;
}

export function makeSheet(index = -1) {
  return {
    name: survivors[index]?.name ?? "",
    nameless: false,
    gender: survivors[index]?.gender ?? "Non-binary",
    survival: 1,
    survivalLimit: 1,
    nickname: index == 0 ? "Foolish Coward of Darkness" : "",
    permissions: {
      survival: index !== 2,
      fightingArts: index !== 0,
      abilities: index !== 1,
      consume: true,
      intimacy: true,
      twoHanded: true,
      strengthGear: true,
      weapons: true,
      proficiency: true,
    },
    attributes: [5, 0, 0, 0, 0, 0],
    acted: false,
    dead: false,
    threat: true,
    priority: false,
    statuses: [] as string[],
    tokens: makeTokens(6),
    bleeding: 0,
    armorValues: [0, 0, 0, 0, 1, 0],
    injuries: {} as Record<string, boolean>,
    notes: "",
    gear: ["Fist & Tooth", "Cloth", "Founding Stone", ...Array<null>(10).fill(null)] as (string | null)[],
    armorSet: "No Armor",
    bonuses: [0, 0, 0, 0, 0, 0],
    departure: [0, 0],
    arrival: [0, 0],
    parents: ["", ""],
    affinities: [0, 0, 0],
    fightingArtLimit: 3,
    disorderLimit: 3,
    proficiency: "",
    development: [0, 0, 0, 0],
  };
}
export type Sheet = ReturnType<typeof makeSheet>;
export function isReady(sheet: Sheet) {
  return !sheet.dead && !sheet.acted && !sheet.statuses.includes("Knocked Down") && !sheet.statuses.includes("Retired");
}
export function availableActions(sheet: Sheet) {
  return sheet.permissions.survival &&
    !sheet.dead &&
    !sheet.statuses.includes("Knocked Down") &&
    !sheet.statuses.includes("Retired") &&
    (sheet.survival ?? 0) > 0
    ? 1
    : 0;
}
export function tokenTotal(sheet: Sheet) {
  return sheet.tokens.reduce((sum, count) => sum + count.positive + count.negative, sheet.bleeding || 0);
}
export function statusItems(sheet: Sheet) {
  return [
    sheet.dead ? "Dead" : isReady(sheet) ? "Ready" : "Not Ready",
    sheet.threat && "Threat",
    sheet.acted && "Acted",
    sheet.statuses.includes("Knocked Down") && "Knocked Down",
    sheet.statuses.includes("Blind Spot") && "Blind Spot",
    sheet.priority && "Priority Target",
    sheet.statuses.includes("Retired") && "Retired",
  ].filter((item): item is string => typeof item === "string");
}
export function statusText(sheet: Sheet) {
  return statusItems(sheet).join(", ");
}
export const designs = [
  { name: "Obsidian", subtitle: "The Command Table", className: "obsidian", href: "/showdown1" },
  { name: "Folio", subtitle: "The Survivor Chronicles", className: "folio", href: "/showdown2" },
  { name: "Signal", subtitle: "The Combat Console", className: "signal", href: "/showdown3" },
] as const;

export const permissions = [
  { key: "survival", label: "Use survival actions" },
  { key: "fightingArts", label: "Use fighting arts" },
  { key: "abilities", label: "Use abilities" },
  { key: "consume", label: "Consume" },
  { key: "intimacy", label: "Perform intimacy" },
  { key: "twoHanded", label: "Activate 2H weapons" },
  { key: "strengthGear", label: "Activate +2 Str gear" },
  { key: "weapons", label: "Activate weapons" },
  { key: "proficiency", label: "Use weapon proficiency" },
] as const;

// Small example decks for the prototype, not the complete game card catalog.
export const sampleDecks: Record<string, string[]> = {
  "Fighting Arts": ["Last Man Standing", "Rhythm Chaser", "Extra Sense"],
  Disorders: ["Fear of the Dark", "Immortal", "Aichmophobia"],
  Abilities: ["Analyze", "Courageous", "Tough"],
};
