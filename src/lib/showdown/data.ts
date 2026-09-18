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

export function makeSheet() {
  return {
    survival: 1,
    attributes: [5, 0, 0, 0, 0, 0],
    acted: false,
    dead: false,
    threat: true,
    priority: false,
    statuses: [] as string[],
    tokens: makeTokens(6),
    bleeding: 0,
  };
}
export type Sheet = ReturnType<typeof makeSheet>;
export function isReady(sheet: Sheet) {
  return !sheet.dead && !sheet.acted && !sheet.statuses.includes("Knocked Down") && !sheet.statuses.includes("Retired");
}
export function availableActions(sheet: Sheet) {
  return !sheet.dead && !sheet.statuses.includes("Knocked Down") && !sheet.statuses.includes("Retired") && (sheet.survival ?? 0) > 0
    ? 1
    : 0;
}
export function tokenTotal(sheet: Sheet) {
  return sheet.tokens.reduce((sum, count) => sum + count.positive + count.negative, sheet.bleeding || 0);
}
export function statusText(sheet: Sheet) {
  return [
    sheet.dead ? "Dead" : isReady(sheet) ? "Alive & Ready" : "Alive",
    sheet.threat && "Threat",
    sheet.acted && "Acted",
    sheet.statuses.includes("Knocked Down") && "Knocked Down",
    sheet.statuses.includes("Blind Spot") && "Blind Spot",
    sheet.priority && "Priority Target",
    sheet.statuses.includes("Retired") && "Retired",
  ]
    .filter(Boolean)
    .join(", ");
}
export const designs = [
  { name: "Obsidian", subtitle: "The Command Table", className: "obsidian", href: "/showdown1" },
  { name: "Folio", subtitle: "The Survivor Chronicles", className: "folio", href: "/showdown2" },
  { name: "Signal", subtitle: "The Combat Console", className: "signal", href: "/showdown3" },
] as const;
