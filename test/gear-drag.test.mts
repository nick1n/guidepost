import { describe, expect, it } from "vitest";
import { canDropGear, dropGear, trinketSpace } from "../src/lib/components/showdown/gear-drag.ts";

describe("gear dragging", () => {
  it.each([3, 6])("adds a row when moving gear to %i occupied trinket slots", (occupied) => {
    const slots = ["Fist & Tooth", "Founding Stone", ...Array<null>(8).fill(null), ...Array<string>(occupied).fill("Cloth")];
    const target = trinketSpace(slots);
    expect(dropGear({ slots, slot: 1, item: "Founding Stone" }, slots, target)).toBe(true);
    expect(slots).toHaveLength(10 + occupied + 3);
    expect(slots[1]).toBeNull();
    expect(slots.slice(10, target)).toEqual(Array(occupied).fill("Cloth"));
    expect(slots.slice(target)).toEqual(["Founding Stone", null, null]);
  });

  it("fills existing trinket gaps before adding a row", () => {
    const slots = ["Fist & Tooth", "Founding Stone", ...Array<null>(8).fill(null), "Cloth", null, "Cloth"];
    expect(trinketSpace(slots)).toBe(11);
    expect(dropGear({ slots, slot: 1, item: "Founding Stone" }, slots, trinketSpace(slots))).toBe(true);
    expect(slots).toHaveLength(13);
    expect(slots.slice(10)).toEqual(["Cloth", "Founding Stone", "Cloth"]);
  });

  it("adds a row for another survivor's incoming trinket", () => {
    const origin = ["Fist & Tooth", "Founding Stone"];
    const destination = ["Fist & Tooth", ...Array<null>(9).fill(null), "Cloth", "Cloth", "Cloth"];
    expect(dropGear({ slots: origin, slot: 1, item: "Founding Stone" }, destination, trinketSpace(destination))).toBe(true);
    expect(origin[1]).toBeNull();
    expect(destination).toHaveLength(16);
    expect(destination[13]).toBe("Founding Stone");
  });

  it("reports full only at nine trinkets and preserves incoming gear", () => {
    const origin = ["Fist & Tooth", "Founding Stone"];
    const destination = ["Fist & Tooth", ...Array<null>(9).fill(null), ...Array<string>(9).fill("Cloth")];
    expect(trinketSpace(destination)).toBe(-1);
    expect(dropGear({ slots: origin, slot: 1, item: "Founding Stone" }, destination, trinketSpace(destination))).toBe(false);
    expect(origin[1]).toBe("Founding Stone");
    expect(destination).toHaveLength(19);
    expect(destination.slice(10)).toEqual(Array(9).fill("Cloth"));
  });

  it("moves gear to another survivor without leaving a copy behind", () => {
    const origin = ["Fist & Tooth", "Cloth", null];
    const destination = ["Fist & Tooth", null, null];
    expect(dropGear({ slots: origin, slot: 1, item: "Cloth" }, destination, 2)).toBe(true);
    expect(origin).toEqual(["Fist & Tooth", null, null]);
    expect(destination).toEqual(["Fist & Tooth", null, "Cloth"]);
  });

  it("rejects another survivor's occupied slot without changing either survivor", () => {
    const origin = ["Fist & Tooth", "Cloth"];
    const destination = ["Fist & Tooth", "Founding Stone"];
    const source = { slots: origin, slot: 1, item: "Cloth" };
    expect(canDropGear(source, destination, 1)).toBe(false);
    expect(dropGear(source, destination, 1)).toBe(false);
    expect(origin).toEqual(["Fist & Tooth", "Cloth"]);
    expect(destination).toEqual(["Fist & Tooth", "Founding Stone"]);
  });

  it("preserves swaps within the same survivor", () => {
    const slots = ["Fist & Tooth", "Cloth", "Founding Stone"];
    expect(dropGear({ slots, slot: 1, item: "Cloth" }, slots, 2)).toBe(true);
    expect(slots).toEqual(["Fist & Tooth", "Founding Stone", "Cloth"]);
  });

  it("rejects stale and cancelled drags", () => {
    const origin = ["Fist & Tooth", "Founding Stone"];
    const destination = ["Fist & Tooth", null];
    expect(dropGear({ slots: origin, slot: 1, item: "Cloth" }, destination, 1)).toBe(false);
    expect(dropGear(null, destination, 1)).toBe(false);
    expect(origin).toEqual(["Fist & Tooth", "Founding Stone"]);
    expect(destination).toEqual(["Fist & Tooth", null]);
  });

  it("protects the permanent weapon and rejects nonexistent destination slots", () => {
    const origin = ["Fist & Tooth", "Cloth"];
    const destination = ["Fist & Tooth", null];
    expect(dropGear({ slots: origin, slot: 0, item: "Fist & Tooth" }, destination, 1)).toBe(false);
    const source = { slots: origin, slot: 1, item: "Cloth" };
    expect(dropGear(source, destination, 0)).toBe(false);
    expect(dropGear(source, destination, 2)).toBe(false);
    expect(origin).toEqual(["Fist & Tooth", "Cloth"]);
    expect(destination).toEqual(["Fist & Tooth", null]);
  });
});
