import { describe, expect, it } from "vitest";
import { catalogTags, editionGameplay, editionMaterials, editionSize, editionUrl } from "#lib/kdm-data.ts";

describe("review catalog facts", () => {
  it("defaults missing and formerly unknown gameplay to false while preserving overrides", () => {
    expect(editionGameplay({ gameplay: true }, { v: "First Run", gameplay: null })).toBe(false);
    expect(editionGameplay({}, { v: "First Run" })).toBe(false);
    expect(editionGameplay({ gameplay: true }, { v: "Plastic" })).toBe(true);
    expect(editionGameplay({ gameplay: true }, { v: "First Run", gameplay: false })).toBe(false);
  });

  it("inherits shared listings and preserves edition-specific links", () => {
    expect(editionUrl({ url: "/products/aya" }, { v: "First Run" })).toBe("/products/aya");
    expect(editionUrl({ url: "/products/aya" }, { v: "Sim", url: "/products/kds-aya" })).toBe("/products/kds-aya");
  });

  it("inherits model sizes only for physical releases", () => {
    expect(editionSize({ gameplay: false, size: "30" }, { v: "Encore" })).toBe("30");
    expect(editionSize({ gameplay: false, size: "30" }, { v: "Special", size: "50" })).toBe("50");
    expect(editionSize({ gameplay: true, size: "30" }, { v: "Sim" })).toBeUndefined();
  });

  it("derives materials only from explicit values or standard labels", () => {
    expect(editionMaterials({ v: "Plastic" })).toEqual(["Plastic"]);
    expect(editionMaterials({ v: "Collector's Resin 1.0" })).toEqual([]);
    expect(editionMaterials({ v: "First Run", materials: ["Resin", "Metal"] })).toEqual(["Resin", "Metal"]);
    expect(editionMaterials({ v: "Sim" })).toEqual([]);
  });

  it("restores material families and models-only bundle filters", () => {
    const item = { gameplay: false, tags: ["naked"], editions: [{ v: "First Run", materials: ["Photoresin"] }] };
    expect(catalogTags(item, "bundles")).toEqual(["bundle", "models-only", "naked", "photoresin", "resin"]);
    expect(catalogTags({ gameplay: false, kind: "accessory", accessoryType: "shirt" }, "accessories")).toEqual(["accessory", "shirt"]);
    expect(catalogTags({ kind: "armor-kit" }, "content")).toEqual(["armor-kit", "models-only"]);
    expect(catalogTags({ kind: "naked" }, "content")).toEqual(["models-only", "naked"]);
  });
});
