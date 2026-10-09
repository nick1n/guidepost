import { describe, expect, it } from "vitest";
import { catalogTags, editionGameplay, editionMaterials, editionSize, editionUrl } from "#lib/kdm-data.ts";
import { reviewEditions, reviewInclusions, reviewIndex, type ReviewCatalog } from "#lib/catalog-view.ts";

describe("review catalog facts", () => {
  it("resolves reused edition IDs within their own items and caches", () => {
    const data: ReviewCatalog = {
      content: {
        left: {
          name: "Left",
          tags: [],
          editions: [{ id: "plastic", label: "Plastic", format: "physical" }],
          includes: [{ item: "child-left", editionId: "plastic", parentEditionIds: ["plastic"] }],
        },
        right: {
          name: "Right",
          tags: [],
          editions: [{ id: "plastic", label: "Plastic", format: "physical" }],
          includes: [{ item: "child-right", editionId: "plastic", parentEditionIds: ["plastic"] }],
        },
        "child-left": { name: "Left child", tags: [], editions: [{ id: "plastic", label: "Original", format: "physical" }] },
        "child-right": { name: "Right child", tags: [], editions: [{ id: "plastic", label: "Original", format: "physical" }] },
      },
      accessories: {},
      bundles: {},
      homebrew: {},
      "included-only": {},
    };
    const index = reviewIndex(data);
    expect(index.includedEditions("left", "plastic").map(({ item, edition }) => [item.id, edition.id])).toEqual([
      ["child-left", "plastic"],
    ]);
    expect(index.includedEditions("right", "plastic").map(({ item, edition }) => [item.id, edition.id])).toEqual([
      ["child-right", "plastic"],
    ]);
    expect(index.inclusions("left", "plastic")[0].item).toBe("child-left");
  });

  it("tracks synthetic editions by category and release date without modifying source items", () => {
    const data: ReviewCatalog = {
      content: {},
      bundles: { set: { name: "Set", tags: [], releaseDate: "2024-01-01" } },
      homebrew: { model: { name: "Model", tags: [], releaseWindow: "2025" } },
      accessories: {},
      "included-only": {},
    };
    const index = reviewIndex(data);
    expect(reviewEditions(index.byCategory.get("bundles")![0])).toEqual([
      { id: "bundle", label: "Bundle", format: "physical", releaseDate: "2024-01-01", releaseWindow: undefined },
    ]);
    expect(reviewEditions(index.byCategory.get("homebrew")![0])).toEqual([
      { id: "item", label: "Item", format: "physical", releaseDate: undefined, releaseWindow: "2025" },
    ]);
    expect(data.bundles.set.editions).toBeUndefined();
    expect(data.homebrew.model.editions).toBeUndefined();
  });

  it("preserves stable edition IDs when labels change", () => {
    const data: ReviewCatalog = {
      content: { core: { name: "Core", tags: [], editions: [{ id: "core-1-6", label: "1.6", format: "physical" }] } },
      bundles: {},
      homebrew: {},
      accessories: {},
      "included-only": {},
    };
    const indexed = reviewIndex(data).byCategory.get("content")![0];
    indexed.editions![0].label = "First Edition";
    expect(indexed.editions![0].id).toBe("core-1-6");
  });

  it("compares bundle prices with direct included editions without counting nested contents twice", () => {
    const data: ReviewCatalog = {
      content: {
        box: {
          name: "Box",
          tags: [],
          editions: [{ id: "box-plastic", label: "Plastic", format: "physical", prices: [1000] }],
          includes: [{ item: "model", editionId: "model-plastic" }],
        },
        model: {
          name: "Model",
          tags: [],
          editions: [
            { id: "model-plastic", label: "Plastic", format: "physical", prices: [500] },
            { id: "model-sim", label: "Sim", format: "digital", simulator: true, prices: [100] },
          ],
        },
      },
      bundles: { set: { name: "Set", tags: [], price: 800, includes: [{ item: "box", editionId: "box-plastic" }] } },
      "included-only": {},
      accessories: {},
      homebrew: {},
    };
    expect(reviewIndex(data).bundlePricing("set", "bundle")).toEqual({ total: 1000, missing: 0, savings: 200, percent: 20 });
    data.bundles.set.includes!.push({ item: "model", editionId: "missing-edition" });
    expect(reviewIndex(data).bundlePricing("set", "bundle")).toEqual({ total: 1000, missing: 1, savings: undefined, percent: undefined });
    data.content.box.currency = "EUR";
    expect(reviewIndex(data).bundlePricing("set", "bundle")?.savings).toBeUndefined();
  });
  it("defaults missing gameplay to false while preserving overrides", () => {
    expect(editionGameplay({ gameplay: true }, { id: "model-first-run", label: "First Run", format: "physical", gameplay: false })).toBe(
      false,
    );
    expect(editionGameplay({}, { id: "model-first-run", label: "First Run", format: "physical" })).toBe(false);
    expect(editionGameplay({ gameplay: true }, { id: "model-plastic", label: "Plastic", format: "physical" })).toBe(true);
    expect(editionGameplay({ gameplay: true }, { id: "model-first-run", label: "First Run", format: "physical", gameplay: false })).toBe(
      false,
    );
  });

  it("inherits shared listings and preserves edition-specific links", () => {
    expect(editionUrl({ url: "/products/aya" }, { id: "aya-first-run", label: "First Run", format: "physical" })).toBe("/products/aya");
    expect(
      editionUrl({ url: "/products/aya" }, { id: "aya-sim", label: "Sim", format: "digital", simulator: true, url: "/products/kds-aya" }),
    ).toBe("/products/kds-aya");
  });

  it("inherits model sizes only for physical releases", () => {
    expect(editionSize({ size: "30" }, { id: "model-encore", label: "Encore", format: "physical" })).toBe("30");
    expect(editionSize({ size: "30" }, { id: "model-special", label: "Special", format: "physical", size: "50" })).toBe("50");
    expect(
      editionSize({ gameplay: true, size: "30" }, { id: "model-sim", label: "Sim", format: "digital", simulator: true }),
    ).toBeUndefined();
  });

  it("reads materials only from explicit values", () => {
    expect(editionMaterials({ id: "model-plastic", label: "Plastic", format: "physical", materials: ["Plastic"] })).toEqual(["Plastic"]);
    expect(editionMaterials({ id: "model-collectors-resin", label: "Collector's Resin 1.0", format: "physical" })).toEqual([]);
    expect(editionMaterials({ id: "model-first-run", label: "First Run", format: "physical", materials: ["Resin", "Metal"] })).toEqual([
      "Resin",
      "Metal",
    ]);
    expect(editionMaterials({ id: "model-sim", label: "Sim", format: "digital", simulator: true })).toEqual([]);
  });

  it("restores material families and models-only bundle filters", () => {
    const item: Parameters<typeof catalogTags>[0] = {
      tags: ["naked"],
      editions: [{ id: "model-first-run", label: "First Run", format: "physical", materials: ["Photoresin"] }],
    };
    expect(catalogTags(item, "bundles")).toEqual(["bundle", "models-only", "naked", "photoresin", "resin"]);
    expect(catalogTags({ kind: "accessory", accessoryType: "shirt" }, "accessories")).toEqual(["accessory", "shirt"]);
    expect(catalogTags({ kind: "armor-kit" }, "content")).toEqual(["armor-kit", "models-only"]);
    expect(catalogTags({ kind: "naked" }, "content")).toEqual(["models-only", "naked"]);
  });
});

describe("Simulator key access", () => {
  function catalog(): ReviewCatalog {
    return {
      content: {
        core: {
          name: "Core",
          tags: ["core"],
          editions: [
            { id: "core-sim", label: "Sim", format: "digital", simulator: true },
            { id: "core-1-6", label: "1.6", format: "physical" },
          ],
        },
        "expansion-flower-knight": {
          name: "Flower Knight",
          tags: ["expansion"],
          editions: [
            { id: "flower-knight-sim", label: "Sim", format: "digital", simulator: true },
            { id: "flower-knight-1-6", label: "1.6", format: "physical" },
          ],
        },
        "kingdom-death-simulator": {
          name: "Simulator",
          tags: ["simulator"],
          editions: [
            { id: "simulator-dwelling-key", label: "Dwelling Key", format: "physical" },
            { id: "simulator-illusionist-key", label: "Illusionist Key", format: "physical" },
            { id: "simulator-master-dwelling-key", label: "Master Dwelling Key", format: "physical", includesAllSim: true },
          ],
          includes: [{ item: "core", editionId: "core-sim", parentEditionIds: ["simulator-dwelling-key", "simulator-illusionist-key"] }],
        },
      },
      "included-only": {},
      accessories: {},
      bundles: {},
      homebrew: {},
    };
  }

  it("limits ordinary keys to Core's digital edition", () => {
    for (const key of ["simulator-dwelling-key", "simulator-illusionist-key"])
      expect(reviewInclusions(catalog(), "kingdom-death-simulator", key).map(({ item, editionId }) => [item, editionId])).toEqual([
        ["core", "core-sim"],
      ]);
  });

  it("automatically adds future Sim editions without granting physical ownership", () => {
    const data = catalog();
    expect(reviewInclusions(data, "kingdom-death-simulator", "simulator-master-dwelling-key")).toHaveLength(2);
    data.content["expansion-future"] = {
      name: "Future",
      tags: ["expansion"],
      editions: [
        { id: "future-sim", label: "Sim", format: "digital", simulator: true },
        { id: "future-box", label: "Box", format: "physical" },
      ],
    };
    data.content["physical-only"] = {
      name: "Physical",
      tags: ["model"],
      editions: [{ id: "physical-plastic", label: "Plastic", format: "physical" }],
    };
    expect(
      reviewInclusions(data, "kingdom-death-simulator", "simulator-master-dwelling-key").map(({ item, editionId }) => [item, editionId]),
    ).toEqual([
      ["core", "core-sim"],
      ["expansion-flower-knight", "flower-knight-sim"],
      ["expansion-future", "future-sim"],
    ]);
  });

  it("does not duplicate explicit inclusions covered by the master entitlement", () => {
    const data = catalog();
    data.content["kingdom-death-simulator"].includes!.push({
      item: "core",
      editionId: "core-sim",
      parentEditionIds: ["simulator-master-dwelling-key"],
    });
    expect(reviewInclusions(data, "kingdom-death-simulator", "simulator-master-dwelling-key")).toHaveLength(2);
  });

  it("keeps cached inclusions separate for each item and edition", () => {
    const index = reviewIndex(catalog());
    const master = index.inclusions("kingdom-death-simulator", "simulator-master-dwelling-key");
    expect(index.inclusions("kingdom-death-simulator", "simulator-dwelling-key").map(({ item, editionId }) => [item, editionId])).toEqual([
      ["core", "core-sim"],
    ]);
    expect(index.inclusions("core", "core-sim")).toEqual([]);
    expect(index.inclusions("kingdom-death-simulator", "simulator-master-dwelling-key")).toBe(master);
    expect(master).toHaveLength(2);
  });

  it("resolves included ownership recursively without granting other editions or looping through cycles", () => {
    const data = catalog();
    data.content.core.includes = [{ item: "expansion-flower-knight", editionId: "flower-knight-1-6", parentEditionIds: ["core-1-6"] }];
    data.content["expansion-flower-knight"].includes = [{ item: "core", editionId: "core-1-6", parentEditionIds: ["flower-knight-1-6"] }];
    const index = reviewIndex(data);
    expect(index.includedEditions("core", "core-1-6").map(({ item, edition }) => [item.id, edition.id])).toEqual([
      ["expansion-flower-knight", "flower-knight-1-6"],
    ]);
    expect(index.includedEditions("core", "core-sim")).toEqual([]);
    expect(index.includedEditions("kingdom-death-simulator", "simulator-master-dwelling-key").map(({ edition }) => edition.id)).toEqual([
      "core-sim",
      "flower-knight-sim",
    ]);
  });

  it("matches material references and chooses one physical edition for unspecified inclusions", () => {
    const data = catalog();
    data.content.core.includes = [{ item: "expansion-flower-knight", materials: ["Resin"] }];
    data.content["expansion-flower-knight"].editions!.push({
      id: "flower-knight-first-run",
      label: "First Run",
      format: "physical",
      materials: ["Resin"],
    });
    expect(
      reviewIndex(data)
        .includedEditions("core", "core-resin")
        .map(({ edition }) => edition.id),
    ).toEqual(["flower-knight-first-run"]);
    data.content.core.includes = ["expansion-flower-knight"];
    expect(
      reviewIndex(data)
        .includedEditions("core", "core-1-6")
        .map(({ edition }) => edition.id),
    ).toEqual(["flower-knight-1-6"]);
  });

  it("keeps direct bundle contents separate from recursively included ownership after either lookup", () => {
    const data = catalog();
    data.content.core.includes = [{ item: "expansion-flower-knight", editionId: "flower-knight-1-6", parentEditionIds: ["core-sim"] }];
    const index = reviewIndex(data);
    const direct = () =>
      index.includedEditions("kingdom-death-simulator", "simulator-dwelling-key", false).map(({ item, edition }) => [item.id, edition.id]);
    expect(direct()).toEqual([["core", "core-sim"]]);
    expect(
      index.includedEditions("kingdom-death-simulator", "simulator-dwelling-key").map(({ item, edition }) => [item.id, edition.id]),
    ).toEqual([
      ["core", "core-sim"],
      ["expansion-flower-knight", "flower-knight-1-6"],
    ]);
    expect(direct()).toEqual([["core", "core-sim"]]);
  });

  it("refreshes cached search text and inclusions when the catalog index is rebuilt", () => {
    const data = catalog();
    const before = reviewIndex(data);
    before.inclusions("kingdom-death-simulator", "simulator-master-dwelling-key");
    data.content["expansion-future"] = {
      name: "Future Knight",
      aliases: ["Tomorrow"],
      tags: ["monster-lion"],
      editions: [{ id: "future-sim", label: "Sim", format: "digital", simulator: true }],
    };
    const after = reviewIndex(data);
    expect(after.inclusions("kingdom-death-simulator", "simulator-master-dwelling-key")).toHaveLength(3);
    expect(after.search.get("expansion-future")).toContain("future knight expansion-future tomorrow monster-lion lion");
    expect(before.inclusions("kingdom-death-simulator", "simulator-master-dwelling-key")).toHaveLength(2);
  });
});
