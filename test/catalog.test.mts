import { describe, expect, it } from "vitest";
import { catalogTags, editionGameplay, editionMaterials, editionSize, editionUrl } from "#lib/kdm-data.ts";
import { reviewEditions, reviewInclusions, reviewIndex, type ReviewCatalog } from "#lib/catalog-view.ts";

describe("review catalog facts", () => {
  it("tracks synthetic editions by category and release date without modifying source items", () => {
    const data: ReviewCatalog = {
      content: {},
      bundles: { set: { name: "Set", tags: [], releaseDate: "2024-01-01" } },
      homebrew: { model: { name: "Model", tags: [], releaseWindow: "2025" } },
      accessories: {},
      "included-only": {},
    };
    const index = reviewIndex(data);
    expect(reviewEditions(index.byCategory.get("bundles")![0])).toEqual([{ v: "Bundle", r: "2024-01-01", releaseWindow: undefined }]);
    expect(reviewEditions(index.byCategory.get("homebrew")![0])).toEqual([{ v: "Item", r: undefined, releaseWindow: "2025" }]);
    expect(data.bundles.set.editions).toBeUndefined();
    expect(data.homebrew.model.editions).toBeUndefined();
  });

  it("compares bundle prices with direct included editions without counting nested contents twice", () => {
    const data: ReviewCatalog = {
      content: {
        box: { name: "Box", tags: [], editions: [{ v: "Plastic", $: [1000] }], includes: [{ item: "model", edition: "Plastic" }] },
        model: {
          name: "Model",
          tags: [],
          editions: [
            { v: "Plastic", $: [500] },
            { v: "Sim", $: [100] },
          ],
        },
      },
      bundles: { set: { name: "Set", tags: [], price: 800, includes: [{ item: "box", edition: "Plastic" }] } },
      "included-only": {},
      accessories: {},
      homebrew: {},
    };
    expect(reviewIndex(data).bundlePricing("set", "Bundle")).toEqual({ total: 1000, missing: 0, savings: 200, percent: 20 });
    data.bundles.set.includes!.push({ item: "model", edition: "Missing" });
    expect(reviewIndex(data).bundlePricing("set", "Bundle")).toEqual({ total: 1000, missing: 1, savings: undefined, percent: undefined });
    data.content.box.currency = "EUR";
    expect(reviewIndex(data).bundlePricing("set", "Bundle")?.savings).toBeUndefined();
  });
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

describe("Simulator key access", () => {
  function catalog(): ReviewCatalog {
    return {
      content: {
        core: { name: "Core", tags: ["core"], editions: [{ v: "Sim" }, { v: "1.6" }] },
        "expansion-flower-knight": { name: "Flower Knight", tags: ["expansion"], editions: [{ v: "Sim" }, { v: "1.6" }] },
        "kingdom-death-simulator": {
          name: "Simulator",
          tags: ["simulator"],
          editions: [{ v: "Dwelling Key" }, { v: "Illusionist Key" }, { v: "Master Dwelling Key", includesAllSim: true }],
          includes: [{ item: "core", edition: "Sim", parentEditions: ["Dwelling Key", "Illusionist Key"] }],
        },
      },
      "included-only": {},
      accessories: {},
      bundles: {},
      homebrew: {},
    };
  }

  it("limits ordinary keys to Core's digital edition", () => {
    for (const key of ["Dwelling Key", "Illusionist Key"])
      expect(reviewInclusions(catalog(), "kingdom-death-simulator", key).map(({ item, edition }) => [item, edition])).toEqual([
        ["core", "Sim"],
      ]);
  });

  it("automatically adds future Sim editions without granting physical ownership", () => {
    const data = catalog();
    expect(reviewInclusions(data, "kingdom-death-simulator", "Master Dwelling Key")).toHaveLength(2);
    data.content["expansion-future"] = { name: "Future", tags: ["expansion"], editions: [{ v: "Sim" }, { v: "Box" }] };
    data.content["physical-only"] = { name: "Physical", tags: ["model"], editions: [{ v: "Plastic" }] };
    expect(reviewInclusions(data, "kingdom-death-simulator", "Master Dwelling Key").map(({ item, edition }) => [item, edition])).toEqual([
      ["core", "Sim"],
      ["expansion-flower-knight", "Sim"],
      ["expansion-future", "Sim"],
    ]);
  });

  it("does not duplicate explicit inclusions covered by the master entitlement", () => {
    const data = catalog();
    data.content["kingdom-death-simulator"].includes!.push({ item: "core", edition: "Sim", parentEditions: ["Master Dwelling Key"] });
    expect(reviewInclusions(data, "kingdom-death-simulator", "Master Dwelling Key")).toHaveLength(2);
  });

  it("keeps cached inclusions separate for each item and edition", () => {
    const index = reviewIndex(catalog());
    const master = index.inclusions("kingdom-death-simulator", "Master Dwelling Key");
    expect(index.inclusions("kingdom-death-simulator", "Dwelling Key").map(({ item, edition }) => [item, edition])).toEqual([
      ["core", "Sim"],
    ]);
    expect(index.inclusions("core", "Sim")).toEqual([]);
    expect(index.inclusions("kingdom-death-simulator", "Master Dwelling Key")).toBe(master);
    expect(master).toHaveLength(2);
  });

  it("resolves included ownership recursively without granting other editions or looping through cycles", () => {
    const data = catalog();
    data.content.core.includes = [{ item: "expansion-flower-knight", edition: "1.6", parentEditions: ["1.6"] }];
    data.content["expansion-flower-knight"].includes = [{ item: "core", edition: "1.6", parentEditions: ["1.6"] }];
    const index = reviewIndex(data);
    expect(index.includedEditions("core", "1.6").map(({ item, edition }) => [item.id, edition.v])).toEqual([
      ["expansion-flower-knight", "1.6"],
    ]);
    expect(index.includedEditions("core", "Sim")).toEqual([]);
    expect(index.includedEditions("kingdom-death-simulator", "Master Dwelling Key").map(({ edition }) => edition.v)).toEqual([
      "Sim",
      "Sim",
    ]);
  });

  it("matches material references and chooses one physical edition for unspecified inclusions", () => {
    const data = catalog();
    data.content.core.includes = [{ item: "expansion-flower-knight", materials: ["Resin"] }];
    data.content["expansion-flower-knight"].editions!.push({ v: "First Run", materials: ["Resin"] });
    expect(
      reviewIndex(data)
        .includedEditions("core", "Resin")
        .map(({ edition }) => edition.v),
    ).toEqual(["First Run"]);
    data.content.core.includes = ["expansion-flower-knight"];
    expect(
      reviewIndex(data)
        .includedEditions("core", "1.6")
        .map(({ edition }) => edition.v),
    ).toEqual(["1.6"]);
  });

  it("keeps direct bundle contents separate from recursively included ownership after either lookup", () => {
    const data = catalog();
    data.content.core.includes = [{ item: "expansion-flower-knight", edition: "1.6", parentEditions: ["Sim"] }];
    const index = reviewIndex(data);
    const direct = () =>
      index.includedEditions("kingdom-death-simulator", "Dwelling Key", false).map(({ item, edition }) => [item.id, edition.v]);
    expect(direct()).toEqual([["core", "Sim"]]);
    expect(index.includedEditions("kingdom-death-simulator", "Dwelling Key").map(({ item, edition }) => [item.id, edition.v])).toEqual([
      ["core", "Sim"],
      ["expansion-flower-knight", "1.6"],
    ]);
    expect(direct()).toEqual([["core", "Sim"]]);
  });

  it("refreshes cached search text and inclusions when the catalog index is rebuilt", () => {
    const data = catalog();
    const before = reviewIndex(data);
    before.inclusions("kingdom-death-simulator", "Master Dwelling Key");
    data.content["expansion-future"] = {
      name: "Future Knight",
      aliases: ["Tomorrow"],
      tags: ["monster-lion"],
      editions: [{ v: "Sim" }],
    };
    const after = reviewIndex(data);
    expect(after.inclusions("kingdom-death-simulator", "Master Dwelling Key")).toHaveLength(3);
    expect(after.search.get("expansion-future")).toContain("future knight expansion-future tomorrow monster-lion lion");
    expect(before.inclusions("kingdom-death-simulator", "Master Dwelling Key")).toHaveLength(2);
  });
});
