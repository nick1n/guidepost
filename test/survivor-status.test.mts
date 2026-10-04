import unoConfig from "../uno.config.ts";
import { statuses } from "#lib/constants.ts";
import { iconView } from "#lib/kdm/ui/status/statuses.ts";
import { describe, expect, it } from "vitest";
import {
  availableActions,
  isReady,
  lifeState,
  makeSheet,
  statusItems,
  toggleStatus,
  updateDeath,
  useDodge,
} from "#lib/kdm/showdown/sheet.ts";
import { attackStats } from "#lib/kdm/showdown/rules.ts";

describe("survivor statuses", () => {
  it("stores IDs independently of control labels", () => {
    const sheet = makeSheet();
    expect(sheet.statuses).toEqual(["status:threat"]);
    expect(statuses["status:act"].label).toBe("Act");
    expect(statuses["status:retire"].label).toBe("Retire");
    toggleStatus(sheet, "status:retire");
    expect(sheet.statuses).toContain("status:retire");
    expect(statusItems(sheet)).toContain("Retired");
    expect(statusItems(sheet).some((label) => label.startsWith("status:"))).toBe(false);
  });

  it("restores remaining resources when Act is switched off", () => {
    const sheet = makeSheet();
    sheet.remaining = { movement: 2, activation: 1 };
    toggleStatus(sheet, "status:act");
    expect(sheet.remaining).toEqual({ movement: 0, activation: 0 });
    expect(isReady(sheet)).toBe(false);
    expect(lifeState(sheet).label).toBe("Acted");
    toggleStatus(sheet, "status:act");
    expect(sheet.remaining).toEqual({ movement: 2, activation: 1 });
    expect(sheet.remainingBeforeAct).toBeNull();
    expect(isReady(sheet)).toBe(true);
  });

  it("switches between Dead and Gone without losing other statuses", () => {
    const sheet = makeSheet();
    toggleStatus(sheet, "status:deaf");
    toggleStatus(sheet, "status:dead");
    toggleStatus(sheet, "status:cease-to-exist");
    expect(sheet.statuses).not.toContain("status:dead");
    expect(sheet.statuses).toContain("status:deaf");
    expect(lifeState(sheet).label).toBe("Gone");
    toggleStatus(sheet, "status:dead");
    expect(sheet.statuses).not.toContain("status:cease-to-exist");
    expect(lifeState(sheet).label).toBe("Dead");
    toggleStatus(sheet, "status:dead");
    expect(lifeState(sheet).label).toBe("Ready");
  });

  it.each(["status:dead", "status:cease-to-exist"] as const)("disables actions for %s", (status) => {
    const sheet = makeSheet();
    toggleStatus(sheet, status);
    expect(isReady(sheet)).toBe(false);
    expect(availableActions(sheet)).toBe(0);
    useDodge(sheet);
    expect(sheet.survival).toBe(1);
    expect(sheet.dodgesRemaining).toBe(1);
  });

  it("marks bleeding deaths once and preserves Gone", () => {
    const sheet = makeSheet();
    sheet.bleeding = sheet.life;
    updateDeath(sheet);
    updateDeath(sheet);
    expect(sheet.statuses.filter((status) => status === "status:dead")).toHaveLength(1);
    toggleStatus(sheet, "status:cease-to-exist");
    updateDeath(sheet);
    expect(sheet.statuses).not.toContain("status:dead");
    expect(lifeState(sheet).label).toBe("Gone");
  });

  it("applies the Blind Spot accuracy bonus using its ID", () => {
    const sheet = makeSheet();
    sheet.perfectHitRange = 0;
    const monster = { toughness: 6, luck: 0, evasion: 0 };
    const accuracy = attackStats(sheet, "Founding Stone", monster).acc;
    toggleStatus(sheet, "status:blind-spot");
    expect(attackStats(sheet, "Founding Stone", monster).acc).toBe(accuracy - 1);
    toggleStatus(sheet, "status:blind-spot");
    expect(attackStats(sheet, "Founding Stone", monster).acc).toBe(accuracy);
  });
});

describe("status presentation", () => {
  it("selects control variants and the fixed Blind Spot quick icon", () => {
    expect(iconView("status:blind")).toEqual(["status-icon", "i-lucide:eye"]);
    expect(iconView("status:blind", { active: true })).toEqual(["status-icon", "i-lucide:eye-off"]);
    expect(iconView("status:blind-spot", { active: true })).toEqual(["status-icon", "i-lucide:eye-closed"]);
    expect(iconView("status:blind-spot", { active: true, context: "quick" })).toEqual(["blind-icon", "i-lucide:eye-dashed"]);
    expect(iconView("status:deaf", { active: true, context: "quick" })).toEqual(["status-icon", "i-lucide:ear-off"]);
    expect(iconView("priority", { active: true, context: "quick" })).toEqual(["priority-icon", "i-material-symbols:target"]);
    expect(iconView("status:knocked-down", { active: true, context: "quick" })[0]).toBe("knocked-icon");
  });
  it("safelists every status icon variant", () => {
    for (const info of Object.values(statuses)) {
      expect(unoConfig.safelist).toContain(info.icon);
      if (info.activeIcon) expect(unoConfig.safelist).toContain(info.activeIcon);
      if (info.flagIcon) expect(unoConfig.safelist).toContain(info.flagIcon);
    }
  });
  it("returns the life label, icon, and tone together", () => {
    const sheet = makeSheet();
    expect(lifeState(sheet)).toEqual({ label: "Ready", icon: "ready", tone: "ready" });
    toggleStatus(sheet, "status:act");
    expect(lifeState(sheet)).toEqual({ label: "Acted", icon: null, tone: null });
    toggleStatus(sheet, "status:dead");
    expect(lifeState(sheet)).toEqual({ label: "Dead", icon: "status:dead", tone: "unavailable" });
    toggleStatus(sheet, "status:cease-to-exist");
    expect(lifeState(sheet)).toEqual({ label: "Gone", icon: "status:cease-to-exist", tone: "unavailable" });
  });
});
