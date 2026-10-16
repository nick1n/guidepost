import { describe, expect, it } from "vitest";
import { collectionKey } from "#lib/types/collection.ts";
import catalog from "#catalog/data.json";
import { catalogTags, editionGameplay, editionLabel, editionMaterials } from "#lib/kdm-data.ts";
import {
  reviewEditions,
  reviewEquivalentEditions,
  reviewEditionReleased,
  reviewEntries,
  reviewGameplayFirst,
  reviewIndex,
  reviewShopLink,
  reviewShopUrl,
  type ReviewCatalog,
  type ReviewItem,
} from "#lib/catalog-view.ts";

describe("review catalog facts", () => {
  it("completes Core 1.6 from Core 1.5 plus a standalone 1.6 rulebook without granting Sim or a second box", () => {
    const index = reviewIndex(catalog as ReviewCatalog);
    const core = index.byId.get("core")!;
    const original = core.editions!.find((edition) => edition.id === "1-5")!;
    const owned = new Set(index.ownershipKeys([{ item: core, edition: original }]));
    const complete = (editionId: string) => {
      const children = index.includedEditions(core.id, editionId, false);
      return (
        children.filter((child) =>
          reviewEquivalentEditions(child.item, child.edition).some((edition) => owned.has(collectionKey(child.item.id, edition.id))),
        ).length === children.length
      );
    };
    expect(complete("1-5")).toBe(true);
    expect(complete("1-6")).toBe(false);
    owned.add(collectionKey("kingdom-death-monster-rulebook", "1-6"));
    expect(complete("1-5")).toBe(true);
    expect(complete("1-6")).toBe(true);
    expect(owned.has(collectionKey("core", "1-6"))).toBe(false);
    expect(owned.has(collectionKey("core", "sim"))).toBe(false);
    expect(owned.has(collectionKey("kingdom-death-monster-rulebook", "1-3-included"))).toBe(false);
  });
  it("matches explicitly equivalent copies without merging versions or equal labels", () => {
    const item: ReviewItem = {
      name: "Rulebook",
      tags: [],
      editions: [
        { id: "1-5", label: "1.5", format: "physical" },
        { id: "1-6", label: "1.6", format: "physical", prices: [4000] },
        { id: "1-6-included", label: "1.6", equivalentTo: "1-6", format: "physical", includedOnly: true, prices: [0] },
        { id: "other", label: "1.6", format: "physical" },
      ],
    };
    const editions = item.editions!;
    expect(reviewEquivalentEditions(item, editions[2]!).map((edition) => edition.id)).toEqual(["1-6", "1-6-included"]);
    expect(reviewEquivalentEditions(item, editions[1]!)).toEqual([editions[1], editions[2]]);
    expect(reviewEquivalentEditions(item, editions[0]!)).toEqual([editions[0]]);
    editions[2]!.label = "Box";
    expect(reviewEquivalentEditions(item, editions[1]!)).toEqual([editions[1], editions[2]]);
    expect(editions[1]!.prices).toEqual([4000]);
    expect(editions[2]!.prices).toEqual([0]);
  });
  it("recognizes released editions without treating future, unknown, or open release windows as released", () => {
    const edition = { id: "original", label: "Original", format: "physical" } as const;
    const today = "2026-10-16";
    expect(reviewEditionReleased({ ...edition, releaseDate: today }, today)).toBe(true);
    expect(reviewEditionReleased({ ...edition, releaseDate: "2026-10-17" }, today)).toBe(false);
    expect(reviewEditionReleased({ ...edition, releaseWindow: "2026 Q3" }, today)).toBe(true);
    expect(reviewEditionReleased({ ...edition, releaseWindow: "2026-Q4" }, today)).toBe(false);
    expect(reviewEditionReleased({ ...edition, releaseWindow: "2025" }, today)).toBe(true);
    expect(reviewEditionReleased({ ...edition, releaseWindow: "2026" }, today)).toBe(false);
    expect(reviewEditionReleased({ ...edition, releaseWindow: "Unknown" }, today)).toBe(false);
    expect(reviewEditionReleased(edition, today)).toBe(false);
    expect(reviewEditionReleased({ ...edition, label: "Preorder", releaseWindow: "2025" }, today)).toBe(false);
    expect(reviewEditionReleased({ ...edition, releaseDate: today, releaseWindow: "2027" }, today)).toBe(true);
  });

  it("groups gameplay first while preserving item order, references, and edition overrides", () => {
    const data: ReviewCatalog = {
      content: {
        model: { name: "Model", tags: [] },
        core: { name: "Core", gameplay: true, tags: [] },
        display: {
          name: "Display",
          gameplay: true,
          tags: [],
          editions: [{ id: "resin", label: "Resin", format: "physical", gameplay: false }],
        },
        mixed: {
          name: "Mixed",
          tags: [],
          editions: [
            { id: "resin", label: "Resin", format: "physical" },
            { id: "plastic", label: "Plastic", format: "physical", gameplay: true },
          ],
        },
        other: { name: "Other model", tags: [] },
      },
      accessories: {},
      bundles: {},
      homebrew: {},
      "included-only": {},
    };
    const entries = reviewEntries(data);
    const ordered = reviewGameplayFirst(entries);
    expect(ordered.map((item) => item.id)).toEqual(["core", "mixed", "model", "display", "other"]);
    expect(entries.map((item) => item.id)).toEqual(["model", "core", "display", "mixed", "other"]);
    expect(ordered[0]).toBe(entries[1]);
    expect(ordered[2]).toBe(entries[0]);
  });

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
    const index = reviewIndex(data);
    expect(index.bundlePricing("set", "bundle")).toEqual({ total: 1000, missing: 0, savings: 200, percent: 20 });
    expect(index.bundlePricing("set", "bundle", new Set(["box"]))).toEqual({ total: 0, missing: 0, savings: -800, percent: undefined });
    expect(index.bundlePricing("set", "bundle", new Set(["model"]))?.total).toBe(1000);
    expect(index.bundlePricing("set", "bundle")?.total).toBe(1000);
    data.bundles.set.includes!.push({ item: "model", editionId: "missing-edition" });
    expect(reviewIndex(data).bundlePricing("set", "bundle")).toEqual({ total: 1000, missing: 1, savings: undefined, percent: undefined });
    expect(reviewIndex(data).bundlePricing("set", "bundle", new Set(["model"]))?.missing).toBe(0);
    data.content.box.currency = "EUR";
    expect(reviewIndex(data).bundlePricing("set", "bundle")?.savings).toBeUndefined();
  });
  it("defaults missing gameplay to false while preserving overrides", () => {
    expect(editionGameplay({ gameplay: true }, { id: "model-first-run", label: "First Run", format: "physical", gameplay: false })).toBe(
      false,
    );
    expect(editionGameplay({}, { id: "model-first-run", label: "First Run", format: "physical" })).toBe(false);
    expect(editionGameplay({ gameplay: true }, { id: "model-plastic", label: "Plastic", format: "physical" })).toBe(true);
  });

  it("inherits shared listings and preserves edition-specific links", () => {
    expect(
      reviewShopUrl({ name: "Aya", tags: [], url: "/products/aya" }, { id: "aya-first-run", label: "First Run", format: "physical" }),
    ).toBe("/products/aya");
    expect(
      reviewShopUrl(
        { name: "Aya", tags: [], url: "/products/aya" },
        { id: "aya-sim", label: "Sim", format: "digital", simulator: true, url: "/products/kds-aya" },
      ),
    ).toBe("/products/kds-aya");
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

  it("distinguishes shop states while deriving URLs from handles", () => {
    const item = { name: "Model", tags: [], handle: "model" };
    const edition: Parameters<typeof reviewShopLink>[1] = { id: "plastic", label: "Plastic", format: "physical" };
    const url = "https://shop.kingdomdeath.com/products/model";
    expect(reviewShopLink(item, edition)?.state).toBe("unknown");
    edition.available = true;
    expect(reviewShopLink(item, edition)?.state).toBe("unknown");
    for (const state of ["in-stock", "out-of-stock", "missing"] as const) {
      edition.shop = state;
      expect(reviewShopLink(item, edition)).toEqual({ state, url });
    }
    delete edition.available;
    delete edition.shop;
    expect(reviewShopLink({ ...item, handle: "new-model" }, edition)).toEqual({
      url: "https://shop.kingdomdeath.com/products/new-model",
      state: "unknown",
    });
    expect(reviewShopLink({ name: "No link", tags: [] }, edition)).toBeUndefined();
    edition.includedOnly = true;
    expect(reviewShopLink(item, edition)).toBeUndefined();
  });

  it("keeps item-level shop evidence after indexing synthetic editions", () => {
    const data: ReviewCatalog = {
      content: {},
      accessories: {},
      homebrew: {},
      "included-only": {},
      bundles: {
        set: {
          name: "Set",
          tags: [],
          handle: "set",
          shop: "out-of-stock",
        },
      },
    };
    const item = reviewIndex(data).byId.get("set")!;
    expect(reviewShopLink(item, reviewEditions(item)[0])).toEqual({
      url: "https://shop.kingdomdeath.com/products/set",
      state: "out-of-stock",
    });
    expect(data.bundles.set.editions).toBeUndefined();
  });

  it("keeps shared shop metadata out of catalog categories and indexes", () => {
    const data: ReviewCatalog = {
      shopUpdated: "2026-10-06",
      content: {
        model: {
          name: "Model",
          tags: [],
          handle: "model",
          editions: [
            {
              id: "plastic",
              label: "Plastic",
              format: "physical",
              shop: "out-of-stock",
            },
          ],
        },
      },
      accessories: {},
      homebrew: {},
      "included-only": {},
      bundles: {},
    };
    expect(reviewEntries(data).map(({ id, category }) => ({ id, category }))).toEqual([{ id: "model", category: "content" }]);
    expect([...reviewIndex(data).byCategory.keys()]).toEqual(["content"]);
    expect(data.shopUpdated).toBe("2026-10-06");
  });

  it("iterates only known categories in the catalog display order", () => {
    const data: ReviewCatalog & { futureMetadata: { importedAt: string } } = {
      content: { model: { name: "Model", tags: [] } },
      bundles: { set: { name: "Set", tags: [] } },
      homebrew: { custom: { name: "Custom", tags: [] } },
      "included-only": { component: { name: "Component", tags: [] } },
      accessories: { shirt: { name: "Shirt", tags: [] } },
      shopUpdated: "2026-10-06",
      futureMetadata: { importedAt: "2026-10-06T00:00:00Z" },
    };
    expect(reviewEntries(data).map(({ id, category }) => [id, category])).toEqual([
      ["model", "content"],
      ["set", "bundles"],
      ["custom", "homebrew"],
      ["component", "included-only"],
      ["shirt", "accessories"],
    ]);
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
    const index = reviewIndex(catalog());
    for (const key of ["simulator-dwelling-key", "simulator-illusionist-key"])
      expect(index.inclusions("kingdom-death-simulator", key).map(({ item, editionId }) => [item, editionId])).toEqual([
        ["core", "core-sim"],
      ]);
  });

  it("automatically adds future Sim editions without granting physical ownership", () => {
    const data = catalog();
    expect(reviewIndex(data).inclusions("kingdom-death-simulator", "simulator-master-dwelling-key")).toHaveLength(2);
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
      reviewIndex(data)
        .inclusions("kingdom-death-simulator", "simulator-master-dwelling-key")
        .map(({ item, editionId }) => [item, editionId]),
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
    expect(reviewIndex(data).inclusions("kingdom-death-simulator", "simulator-master-dwelling-key")).toHaveLength(2);
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

  it("uses explicit editions before format matching and falls back to a physical edition", () => {
    const data = catalog();
    data.content.core.includes = [{ item: "expansion-flower-knight", editionId: "flower-knight-1-6" }];
    expect(
      reviewIndex(data)
        .includedEditions("core", "core-sim")
        .map(({ edition }) => edition.id),
    ).toEqual(["flower-knight-1-6"]);
    data.content.core.includes = ["expansion-flower-knight"];
    const index = reviewIndex(data);
    expect(index.includedEditions("core", "core-sim").map(({ edition }) => edition.id)).toEqual(["flower-knight-sim"]);
    expect(index.includedEditions("core", "unknown").map(({ edition }) => edition.id)).toEqual(["flower-knight-1-6"]);
    data.content.core.includes = [{ item: "expansion-flower-knight", editionId: "unknown" }];
    expect(reviewIndex(data).includedEditions("core", "core-sim")).toEqual([]);
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

describe("included edition display and identity", () => {
  it("uses plain edition labels while resolving ownership by permanent edition ID", () => {
    const included = { id: "1-6-included", label: "1.6", format: "physical" as const, includedOnly: true as const };
    const standalone = { id: "1-6", label: "1.6", format: "physical" as const };
    const data: ReviewCatalog = {
      content: {
        core: {
          name: "Core",
          tags: [],
          editions: [standalone],
          includes: [{ item: "rulebook", editionId: included.id, parentEditionIds: [standalone.id] }],
        },
      },
      accessories: { rulebook: { name: "Rulebook", tags: [], handle: "rulebook", editions: [included, standalone] } },
      "included-only": {},
      bundles: {},
      homebrew: {},
    };
    const index = reviewIndex(data);
    const core = index.byId.get("core")!;
    expect(editionLabel(standalone)).toBe("1.6");
    expect(editionLabel(included)).toBe("1.6");
    const named = { ...included, name: "Alternate cover" };
    expect(editionLabel(named)).toBe("1.6");
    expect(index.inclusions("core", "1-6")[0]!.editionLabel).toBe("1.6");
    expect(index.ownershipKeys([{ item: core, edition: standalone }])).toEqual([
      collectionKey("core", standalone.id),
      collectionKey("rulebook", included.id),
    ]);
    expect(reviewShopUrl(data.accessories.rulebook, included)).toBeUndefined();
    expect(reviewShopUrl(data.accessories.rulebook, standalone)).toBe("https://shop.kingdomdeath.com/products/rulebook");
  });
});
