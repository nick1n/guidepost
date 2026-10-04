import { statusOrder, type SurvivorStatusIcons, type Icon } from "#lib/constants.ts";
import { statusSummary } from "../ui/status/statuses";

import { survivors } from "./fixtures";

export const attributes = ["Movement", "Speed", "Accuracy", "Strength", "Luck", "Evasion"];
export const abbreviations = ["Mov", "Spd", "Acc", "Str", "Luck", "Eva"];
export const survivorTypes = ["Survivor", "Savior", "Scout", "Arc Survivor", "Arc Savior", "Wanderer"] as const;
export type SurvivorType = (typeof survivorTypes)[number];

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
    type: "Survivor" as SurvivorType,
    survival: 1,
    dodgesRemaining: 1,
    survivalLimit: 1,
    life: 5,
    perfectHitRange: 1,
    nickname: index == 1 ? "Foolish Coward of Darkness" : "",
    restrict: {
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
    remaining: { movement: 1, activation: 1 },
    remainingBeforeAct: null as { movement: number; activation: number } | null,
    priority: false,
    statuses: ["status:threat"] as SurvivorStatusIcons[],
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

export function toggleStatus(sheet: Sheet, status: SurvivorStatusIcons) {
  if (status === "status:act") {
    toggleActed(sheet);
    return;
  }
  if (sheet.statuses.includes(status)) {
    sheet.statuses = sheet.statuses.filter((value) => value !== status);
    return;
  }
  const excludedStatus = status === "status:dead" ? "status:cease-to-exist" : status === "status:cease-to-exist" ? "status:dead" : null;
  sheet.statuses = [...sheet.statuses.filter((value) => value !== excludedStatus), status];
}

export function updateDeath(sheet: Sheet) {
  if (sheet.bleeding >= sheet.life && isAlive(sheet)) toggleStatus(sheet, "status:dead");
}

export function toggleActed(sheet: Sheet) {
  if (!sheet.statuses.includes("status:act")) {
    sheet.remainingBeforeAct = { ...sheet.remaining };
    sheet.remaining.movement = 0;
    sheet.remaining.activation = 0;
    sheet.statuses = [...sheet.statuses, "status:act"];
    return;
  }

  sheet.statuses = sheet.statuses.filter((status) => status !== "status:act");
  if (sheet.remainingBeforeAct) {
    sheet.remaining.movement = sheet.remainingBeforeAct.movement;
    sheet.remaining.activation = sheet.remainingBeforeAct.activation;
    sheet.remainingBeforeAct = null;
  }
}

export function isReady(sheet: Sheet) {
  return isAlive(sheet) && !sheet.statuses.includes("status:act") && !sheet.statuses.includes("status:knocked-down");
}
export function isAlive(sheet: Sheet) {
  return !sheet.statuses.includes("status:dead") && !sheet.statuses.includes("status:cease-to-exist");
}
export type LifeState = { label: string; icon: Icon | null; tone: "ready" | "unavailable" | null };

export function lifeState(sheet: Sheet): LifeState {
  if (sheet.statuses.includes("status:cease-to-exist")) return { label: "Gone", icon: "status:cease-to-exist", tone: "unavailable" };
  if (sheet.statuses.includes("status:dead")) return { label: statusSummary("status:dead"), icon: "status:dead", tone: "unavailable" };
  if (isReady(sheet)) return { label: "Ready", icon: "ready", tone: "ready" };
  return { label: sheet.statuses.includes("status:act") ? statusSummary("status:act") : "Not Ready", icon: null, tone: null };
}
export function availableActions(sheet: Sheet) {
  return sheet.restrict.survival && isAlive(sheet) && (sheet.survival ?? 0) > 0 ? sheet.dodgesRemaining : 0;
}
export function useDodge(sheet: Sheet) {
  if (!availableActions(sheet)) return;
  sheet.survival--;
  sheet.dodgesRemaining = 0;
}
export function tokenTotal(sheet: Sheet) {
  return sheet.tokens.reduce((sum, count) => sum + count.positive + count.negative, sheet.bleeding || 0);
}
export function statusItems(sheet: Sheet) {
  const { label } = lifeState(sheet);
  return [
    label,
    ...statusOrder
      .filter((status) => sheet.statuses.includes(status))
      .map(statusSummary)
      .filter((summary) => summary !== label),
    ...(sheet.priority ? ["Priority Target"] : []),
  ];
}
export function statusText(sheet: Sheet) {
  return statusItems(sheet).join(", ");
}
export const restrictions = [
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

export type ListEntry = { id: number; text: string; description: string };
export type Cost = "movement" | "activation";

export function describeCost(cost: readonly Cost[]) {
  return cost.length ? cost.map((item) => `1 ${item}`).join(" and ") : "free";
}

export function canSpendCost(sheet: Sheet, cost: readonly Cost[]) {
  const needed = { movement: 0, activation: 0 };
  for (const item of cost) needed[item]++;
  return sheet.remaining.movement >= needed.movement && sheet.remaining.activation >= needed.activation;
}

export function spendCost(sheet: Sheet, cost: readonly Cost[]) {
  if (!canSpendCost(sheet, cost)) return false;
  for (const item of cost) sheet.remaining[item]--;
  return true;
}
