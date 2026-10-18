import { describe, expect, it } from "vitest";
import { collectionKey, type CollectionSnapshot } from "#lib/types/collection.ts";
import catalog from "#catalog/data.json";
import { catalogTags, editionGameplay, editionLabel, editionMaterials } from "#lib/kdm-data.ts";
import {
  reviewEditions,
  reviewEquivalentEditions,
  reviewEditionReleased,
  reviewEntries,
  reviewGameplayFirst,
  reviewIndex,
  reviewPrice,
  reviewShopLink,
  reviewShopUrl,
  type ReviewCatalog,
  type ReviewItem,
} from "#lib/catalog-view.ts";

function coverageFixture(): ReviewCatalog {
  return {
    content: {
      core: {
        name: "Core",
        tags: [],
        editions: [
          { id: "1-5", label: "1.5", format: "physical" },
          {
            id: "1-6",
            label: "1.6",
            format: "physical",
            completedBy: [
              {
                all: [
                  { item: "core", editionId: "1-5" },
                  { item: "upgrade-pack", editionId: "i" },
                ],
              },
            ],
          },
          { id: "sim", label: "Sim", format: "digital", simulator: true },
        ],
      },
      "upgrade-pack": {
        name: "Upgrade pack",
        tags: [],
        kind: "gameplay-content",
        editions: [
          { id: "i", label: "I", format: "physical" },
          { id: "ii", label: "II", format: "physical" },
        ],
      },
      book: {
        name: "Rulebook",
        tags: [],
        editions: [
          { id: "1-5", label: "1.5", format: "physical" },
          { id: "1-6", label: "1.6", format: "physical" },
          { id: "1-6-included", label: "1.6", equivalentTo: "1-6", format: "physical", includedOnly: true },
        ],
      },
    },
    bundles: {
      set: {
        name: "Set",
        tags: [],
        includes: [
          { item: "core", editionId: "1-6" },
          { item: "upgrade-pack", editionId: "i" },
        ],
      },
    },
    accessories: {},
    homebrew: {},
    "included-only": {},
  } as ReviewCatalog;
}

function pricingFixture(): ReviewCatalog {
  return {
    content: {
      model: {
        name: "Model",
        price: 9999,
        tags: [],
        editions: [
          { id: "included", label: "Plastic", format: "physical", materials: ["Plastic"], includedOnly: true },
          { id: "sold", label: "Plastic", format: "physical", materials: ["Plastic"], prices: [2000, 2500] },
          { id: "cheaper", label: "Plastic", format: "physical", equivalentTo: "sold", prices: [1000] },
          { id: "unpriced", label: "Plastic", format: "physical", equivalentTo: "sold" },
        ],
      },
    },
    bundles: { set: { name: "Set", tags: [], price: 1000, includes: [{ item: "model", editionId: "included" }] } },
    accessories: {},
    homebrew: {},
    "included-only": {},
  };
}

describe("edition coverage", () => {
  it("keeps the reviewed sold Naked editions without duplicate included Plastic editions", () => {
    const index = reviewIndex(catalog as ReviewCatalog);
    const retained = new Set([
      "armor-kit-cycloid-scale",
      "armor-kit-dragon-king",
      "armor-kit-gorment",
      "armor-kit-green-knight",
      "armor-kit-lantern",
      "armor-kit-leather",
      "armor-kit-phoenix",
      "armor-kit-rawhide",
      "armor-kit-screaming",
      "armor-kit-spider-silk",
      "armor-kit-unarmored",
      "armor-kit-white-lion",
    ]);
    const kits = [...retained].map((id) => index.byId.get(id)!);
    expect(kits.every(Boolean)).toBe(true);
    expect(
      index.entries.filter((item) => item.kind === "armor-kit" && item.editions?.some((edition) => edition.id === "naked")),
    ).toHaveLength(12);
    for (const item of kits) {
      const naked = item.editions!.find((edition) => edition.id === "naked");
      expect(naked, item.id).toBeDefined();
      expect(naked!.includedOnly, item.id).toBeUndefined();
      expect(naked!.prices?.length, item.id).toBeGreaterThan(0);
      expect(
        item.editions!.some((edition) => edition.id === "plastic"),
        item.id,
      ).toBe(false);
    }
    expect(
      index.entries.filter(
        (item) => item.kind === "armor-kit" && item.editions?.some((edition) => edition.id === "plastic" && edition.includedOnly),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("does not encode included-only editions as zero-priced products", () => {
    const index = reviewIndex(catalog as ReviewCatalog);
    for (const item of index.entries) {
      for (const edition of item.editions ?? []) {
        if (edition.includedOnly) expect(edition.prices).not.toEqual([0]);
      }
    }
  });
  it("covers live gameplay upgrades without synthesizing later physical Core or expansion products", () => {
    const index = reviewIndex(catalog as ReviewCatalog);
    const keys = (id: string, editionId: string) => {
      const item = index.byId.get(id)!;
      const edition = item.editions!.find((release) => release.id === editionId)!;
      return index.ownershipKeys([{ item, edition }]);
    };
    const base = Object.fromEntries(
      [...keys("core", "1-5"), ...keys("expansion-dung-beetle-knight", "1-3")].map((key) => [key, { owned: true }]),
    );
    expect(index.coverage(base).edition("core", "1-6").available).toBe(false);
    const upgraded = { ...base, ...Object.fromEntries(keys("legendary-card-pack", "1").map((key) => [key, { owned: true }])) };
    const result = index.coverage(upgraded);
    expect(result.edition("core", "1-5").available).toBe(true);
    expect(result.edition("core", "1-6").available).toBe(false);
    expect(result.edition("core-gameplay", "1-6").available).toBe(true);
    expect(result.edition("expansion-dung-beetle-knight", "1-3").available).toBe(true);
    expect(result.edition("expansion-dung-beetle-knight", "1-6").available).toBe(false);
    expect(result.edition("dung-beetle-knight-gameplay", "1-6").available).toBe(true);
    expect(result.edition("expansion-dung-beetle-knight", "1-7").available).toBe(false);
    expect(result.edition("core", "sim").available).toBe(false);
    expect(upgraded[collectionKey("core", "1-6")]).toBeUndefined();
    const missingUpdate = index.coverage({
      ...upgraded,
      [collectionKey("dung-beetle-knight-upgrade", "1-6")]: { owned: true, missing: true },
    });
    expect(missingUpdate.edition("expansion-dung-beetle-knight", "1-6").available).toBe(false);
    expect(missingUpdate.edition("expansion-dung-beetle-knight", "1-3").available).toBe(true);
    expect(missingUpdate.edition("core-gameplay", "1-6").available).toBe(true);
    const missingBookUpdate = index.coverage({
      ...upgraded,
      [collectionKey("core-rulebook-upgrade", "1-6")]: { owned: true, missing: true },
    });
    expect(missingBookUpdate.edition("core", "1-6").available).toBe(false);
    expect(missingBookUpdate.edition("core-gameplay", "1-6").available).toBe(true);
    expect(missingBookUpdate.edition("kingdom-death-monster-rulebook", "1-6-included").available).toBe(false);
    expect(result.edition("kingdom-death-monster-rulebook", "1-6").available).toBe(true);
    expect(result.edition("kingdom-death-monster-rulebook", "1-6-included").available).toBe(false);
  });

  it("limits Legendary Card Pack I expansion updates to the six reviewed gameplay differences", () => {
    const index = reviewIndex(catalog as ReviewCatalog);
    const changed = new Set(["dung-beetle-knight", "dragon-king", "lonely-tree", "lion-knight", "sunstalker", "flower-knight"]);
    const unchanged = ["gorm", "green-knight-armor", "lion-god", "manhunter", "slenderman", "spidicules"];
    const pack = index.byId.get("legendary-card-pack")!;
    const updates = Object.fromEntries(
      index
        .ownershipKeys([{ item: pack, edition: pack.editions!.find((edition) => edition.id === "1")! }])
        .map((key) => [key, { owned: true }]),
    );
    for (const name of [...changed, ...unchanged]) {
      const id = `${name}-gameplay`;
      const base = { [collectionKey(id, "1-3")]: { owned: true } };
      expect(index.coverage(base).edition(id, "1-6").available, name).toBe(!changed.has(name));
      expect(index.coverage({ ...base, ...updates }).edition(id, "1-6").available, name).toBe(true);
      expect(index.coverage(updates).edition(id, "1-6").available, name).toBe(false);
      if (!changed.has(name)) {
        expect(index.byId.has(`${name}-upgrade`)).toBe(false);
        expect(index.coverage({ [collectionKey(id, "1-6")]: { owned: true } }).edition(id, "1-3").available).toBe(true);
      }
    }
    expect(index.includedEditions(pack.id, "1", false)).toHaveLength(13);
    expect(index.includedEditions(pack.id, "2", false)).toHaveLength(0);
  });
  it("tracks the five promo gameplay contents from Pack I without granting their miniatures or complete products", () => {
    const index = reviewIndex(catalog as ReviewCatalog);
    const pack = index.byId.get("legendary-card-pack")!;
    const owned = Object.fromEntries(
      index
        .ownershipKeys([{ item: pack, edition: pack.editions!.find((edition) => edition.id === "1")! }])
        .map((key) => [key, { owned: true }]),
    );
    const result = index.coverage(owned);
    const ids = [
      "allison-the-twilight-knight",
      "white-speaker-koshka",
      "holiday-white-speaker-nico",
      "set-pinups-of-death-series-2",
      "beyond-the-wall",
    ];
    for (const id of ids) {
      const gameplayId = `${id.replace(/^set-/, "")}-gameplay`;
      expect(result.edition(gameplayId, "original").available, id).toBe(true);
      expect(result.edition(id, "box").available, id).toBe(false);
      const children = result.contents(id, "box");
      expect(children.exactCount, id).toBe(1);
      expect(children.children.length, id).toBeGreaterThan(1);
      const item = index.byId.get(id)!;
      for (const edition of item.editions!.filter((edition) => edition.gameplay === false)) {
        expect(
          index.includedEditions(id, edition.id).some((child) => child.item.id === gameplayId),
          `${id}/${edition.id}`,
        ).toBe(false);
      }
      const productKeys = index.ownershipKeys([{ item, edition: item.editions!.find((edition) => edition.id === "box")! }]);
      expect(productKeys).toEqual([collectionKey(id, "box")]);
      expect(index.includedEditions(pack.id, "2").some((child) => child.item.id === gameplayId)).toBe(false);
    }
    const missing = index.coverage({
      ...owned,
      [collectionKey("allison-the-twilight-knight-gameplay", "original")]: { owned: true, missing: true },
    });
    expect(missing.edition("allison-the-twilight-knight-gameplay", "original").available).toBe(false);
    expect(missing.edition("white-speaker-koshka-gameplay", "original").available).toBe(true);
  });
  it("requires the listed base and gameplay upgrade, and revokes completion when either disappears", () => {
    const index = reviewIndex(coverageFixture());
    const inspect = (snapshot: CollectionSnapshot) => index.coverage(snapshot).edition("core", "1-6");
    const packOnly = { [collectionKey("upgrade-pack", "i")]: { owned: true } };
    const complete = {
      [collectionKey("core", "1-5")]: { owned: true },
      [collectionKey("upgrade-pack", "i")]: { owned: true },
    };

    expect(inspect(packOnly)).toMatchObject({ available: false, source: "missing" });
    expect(inspect(complete)).toMatchObject({ available: true, source: "upgrade" });
    expect(inspect({ [collectionKey("core", "1-5")]: { owned: true } })).toMatchObject({ available: false, source: "missing" });
    expect(inspect({ [collectionKey("upgrade-pack", "i")]: { owned: true } })).toMatchObject({ available: false, source: "missing" });
  });

  it("lets an explicit missing mark override ownership and restores availability when cleared", () => {
    const index = reviewIndex(coverageFixture());
    const key = collectionKey("core", "1-6");
    expect(index.coverage({ [key]: { owned: true, missing: true } }).edition("core", "1-6")).toMatchObject({
      available: false,
      source: "missing",
    });
    expect(index.coverage({ [key]: { owned: true, missing: false } }).edition("core", "1-6")).toMatchObject({
      available: true,
      source: "owned",
    });
  });

  it("keeps upgrade recipes edition-specific and treats Sim as a separate edition", () => {
    const index = reviewIndex(coverageFixture());
    const snapshot = {
      [collectionKey("core", "1-5")]: { owned: true },
      [collectionKey("upgrade-pack", "ii")]: { owned: true },
    };
    const coverage = index.coverage(snapshot);
    expect(coverage.edition("core", "1-6")).toMatchObject({ available: false, source: "missing" });
    expect(coverage.edition("core", "sim")).toMatchObject({ available: false, source: "missing" });
  });

  it("recognizes an explicitly equivalent included rulebook", () => {
    const index = reviewIndex(coverageFixture());
    expect(index.coverage({ [collectionKey("book", "1-6-included")]: { owned: true } }).edition("book", "1-6")).toMatchObject({
      available: true,
      source: "equivalent",
    });
  });

  it.each([
    {
      source: "owned",
      owned: [
        ["book", "1-6"],
        ["book", "1-6-included"],
      ],
      via: ["book", "1-6"],
    },
    {
      source: "included",
      owned: [
        ["set", "bundle"],
        ["book", "1-6-included"],
      ],
      via: ["set", "bundle"],
    },
    { source: "equivalent", owned: [["book", "1-6-included"]], via: ["book", "1-6-included"] },
    { source: "upgrade", owned: [], via: ["upgrade-pack", "i"] },
  ] as const)("prefers $source coverage over lower-priority sources", ({ source, owned, via }) => {
    const data = coverageFixture();
    data.bundles.set.includes = [{ item: "book", editionId: "1-6" }];
    data.content.book.editions![1]!.completedBy = [{ all: [{ item: "upgrade-pack", editionId: "i" }] }];
    const snapshot = Object.fromEntries(
      [...owned, ["upgrade-pack", "i"] as const].map(([id, editionId]) => [collectionKey(id, editionId), { owned: true }]),
    );
    const result = reviewIndex(data).coverage(snapshot).edition("book", "1-6");
    expect(result).toMatchObject({ available: true, source });
    expect(result.via.map(({ item, edition }) => [item.id, edition.id])).toEqual([via]);
  });

  it("skips cyclic and unresolved recipes before trying an independently satisfied alternative", () => {
    const data = coverageFixture();
    data.content.core.editions![1]!.completedBy = [{ all: [{ item: "book", editionId: "1-6" }] }];
    data.content.book.editions![1]!.completedBy = [
      { all: [{ item: "core", editionId: "1-6" }] },
      { all: [{ item: "unknown", editionId: "item" }] },
      { all: [{ item: "upgrade-pack", editionId: "i" }] },
    ];
    const index = reviewIndex(data);
    expect(index.coverage({}).edition("book", "1-6")).toMatchObject({ available: false, source: "missing" });
    const result = index.coverage({ [collectionKey("upgrade-pack", "i")]: { owned: true } }).edition("book", "1-6");
    expect(result).toMatchObject({ available: true, source: "upgrade" });
    expect(result.via.map(({ item, edition }) => [item.id, edition.id])).toEqual([["upgrade-pack", "i"]]);
  });

  it("still supplies a shared child through an independent branch when another branch is missing", () => {
    const data = coverageFixture();
    data.content.core.includes = [{ item: "upgrade-pack", editionId: "i" }];
    const coverage = reviewIndex(data).coverage({
      [collectionKey("set", "bundle")]: { owned: true },
      [collectionKey("core", "1-6")]: { missing: true },
    });
    expect(coverage.edition("core", "1-6").available).toBe(false);
    const child = coverage.edition("upgrade-pack", "i");
    expect(child).toMatchObject({ available: true, source: "included" });
    expect(child.via.map(({ item, edition }) => [item.id, edition.id])).toEqual([["set", "bundle"]]);
  });

  it("shares derived completion with equivalent copies and respects a missing override on the requested copy", () => {
    const data = coverageFixture();
    data.content.book.editions![1]!.completedBy = [{ all: [{ item: "upgrade-pack", editionId: "i" }] }];
    const index = reviewIndex(data);
    const snapshot = { [collectionKey("upgrade-pack", "i")]: { owned: true } };
    expect(index.coverage(snapshot).edition("book", "1-6-included").available).toBe(true);
    expect(
      index.coverage({ ...snapshot, [collectionKey("book", "1-6-included")]: { missing: true } }).edition("book", "1-6-included").available,
    ).toBe(false);
  });

  it("does not synthesize product coverage from all listed children or a partial inclusion list", () => {
    const data = coverageFixture();
    data.content.book.includes = [{ item: "upgrade-pack", editionId: "i" }];
    const child = collectionKey("upgrade-pack", "i");
    const parent = collectionKey("book", "1-6");
    const children = { [child]: { owned: true } };
    const index = reviewIndex(data);
    expect(index.coverage(children).edition("book", "1-6").available).toBe(false);
    expect(index.coverage(children).contents("book", "1-6")).toMatchObject({ exactCount: 1, count: 1 });
    expect(index.coverage({ [parent]: { owned: true } }).edition("book", "1-6").available).toBe(true);
    expect(index.coverage({ [parent]: { owned: true }, [child]: { missing: true } }).edition("book", "1-6").available).toBe(true);
    expect(index.coverage(children).edition("book", "1-6-included").available).toBe(false);

    const fullSet = {
      [collectionKey("core", "1-6")]: { owned: true },
      [child]: { owned: true },
    };
    expect(index.coverage(fullSet).contents("set", "bundle")).toMatchObject({ exactCount: 2, count: 2 });
    expect(index.coverage(fullSet).edition("set", "bundle").available).toBe(false);
  });

  it("resolves nested bundle contents without writing derived ownership into the snapshot", () => {
    const data = coverageFixture();
    data.content.core.includes = [{ item: "upgrade-pack", editionId: "i", parentEditionIds: ["1-6"] }];
    const index = reviewIndex(data);
    const snapshot: CollectionSnapshot = {
      [collectionKey("core", "1-5")]: { owned: true },
      [collectionKey("upgrade-pack", "i")]: { owned: true },
    };
    const before = structuredClone(snapshot);
    const coverage = index.coverage(snapshot);
    expect(coverage.edition("core", "1-6")).toMatchObject({ available: true, source: "upgrade" });
    expect(coverage.edition("set", "bundle")).toMatchObject({ available: false, source: "missing" });
    expect(coverage.contents("set", "bundle")).toMatchObject({ exactCount: 2, count: 2 });
    expect(snapshot).toEqual(before);
    expect(snapshot[collectionKey("set", "bundle")]).toBeUndefined();
  });

  it("uses direct ownership keys while deriving recursive included ownership from the snapshot", () => {
    const data = coverageFixture();
    data.content.core.includes = [{ item: "upgrade-pack", editionId: "i", parentEditionIds: ["1-6"] }];
    data.bundles.set.includes = [{ item: "core", editionId: "1-6" }];
    const index = reviewIndex(data);
    const set = index.byId.get("set")!;
    const bundleEdition = set.editions![0]!;
    const selected = index.ownershipKeys([{ item: set, edition: bundleEdition }]);
    expect(selected).toEqual([collectionKey("set", "bundle")]);

    const snapshot = { [selected[0]!]: { owned: true } };
    const coverage = index.coverage(snapshot);
    expect(coverage.edition("core", "1-6").available).toBe(true);
    expect(coverage.edition("upgrade-pack", "i")).toMatchObject({
      available: true,
      source: "included",
      via: [{ item: { id: "set" }, edition: { id: "bundle" } }],
    });
    expect(coverage.owners("upgrade-pack", "i")).toEqual([
      { parentId: "set", parentEditionId: "bundle", parent: "Set", parentEdition: "Bundle", editionId: "i" },
    ]);
    expect(coverage.contents("set", "bundle").exactCount).toBe(1);
    expect(snapshot[collectionKey("core", "1-6")]).toBeUndefined();
    expect(snapshot[collectionKey("upgrade-pack", "i")]).toBeUndefined();
  });

  it("blocks a missing nested branch locally while retaining the recorded parent and other-edition labels", () => {
    const data = coverageFixture();
    data.content.core.includes = [{ item: "upgrade-pack", editionId: "i", parentEditionIds: ["1-6"] }];
    data.bundles.set.includes = [{ item: "core", editionId: "1-6" }];
    const index = reviewIndex(data);
    const snapshot = {
      [collectionKey("set", "bundle")]: { owned: true },
      [collectionKey("core", "1-6")]: { missing: true },
      [collectionKey("core", "1-5")]: { owned: true },
    };
    const coverage = index.coverage(snapshot);
    expect(coverage.edition("set", "bundle")).toMatchObject({ available: true, source: "owned" });
    expect(coverage.edition("core", "1-6").available).toBe(false);
    expect(coverage.edition("upgrade-pack", "i").available).toBe(false);
    expect(coverage.owners("core", "1-6")).toEqual([]);
    expect(coverage.owners("upgrade-pack", "i")).toEqual([]);
    const contents = coverage.contents("set", "bundle");
    expect(contents).toMatchObject({ exactCount: 0, count: 1 });
    expect(contents.children[0]!.ownedEditions.map((edition) => edition.id)).toEqual(["1-5"]);
  });

  it("blocks a missing included branch and restores its derived coverage when cleared", () => {
    const data = coverageFixture();
    data.content.core.includes = [{ item: "upgrade-pack", editionId: "i", parentEditionIds: ["1-6"] }];
    data.bundles.set.includes = [{ item: "core", editionId: "1-6" }];
    const index = reviewIndex(data);
    const snapshot = {
      [collectionKey("core", "1-5")]: { owned: true },
      [collectionKey("upgrade-pack", "i")]: { owned: true, missing: true },
    };
    const blocked = index.coverage(snapshot);
    expect(blocked.edition("core", "1-6").available).toBe(false);
    expect(blocked.edition("upgrade-pack", "i").available).toBe(false);
    expect(blocked.edition("set", "bundle").available).toBe(false);

    const restored = index.coverage({ ...snapshot, [collectionKey("upgrade-pack", "i")]: { owned: true, missing: false } });
    expect(restored.edition("core", "1-6").available).toBe(true);
    expect(restored.edition("upgrade-pack", "i").available).toBe(true);
  });

  it("keeps direct included contents and missing overrides separate from automatic upgrade recipes", () => {
    const data = coverageFixture();
    data.content.core.includes = [{ item: "upgrade-pack", editionId: "i", parentEditionIds: ["1-6"] }];
    const index = reviewIndex(data);
    const rawParent = { [collectionKey("core", "1-6")]: { owned: true } };
    expect(index.coverage(rawParent).edition("core", "1-6").available).toBe(true);
    expect(
      index.coverage({ ...rawParent, [collectionKey("upgrade-pack", "i")]: { owned: false, missing: false } }).edition("core", "1-6")
        .available,
    ).toBe(true);
    const missingChild = index.coverage({ ...rawParent, [collectionKey("upgrade-pack", "i")]: { owned: true, missing: true } });
    expect(missingChild.edition("core", "1-6").available).toBe(true);
    expect(missingChild.edition("upgrade-pack", "i").available).toBe(false);
    expect(missingChild.contents("core", "1-6").exactCount).toBe(0);
    expect(index.coverage({ [collectionKey("core", "1-5")]: { owned: true } }).edition("core", "1-6").available).toBe(false);
  });
});

describe("review catalog facts", () => {
  it("requires the gameplay-content upgrade to complete Core 1.6", () => {
    const index = reviewIndex(coverageFixture());
    const snapshot: CollectionSnapshot = {
      [collectionKey("core", "1-5")]: { owned: true },
      [collectionKey("book", "1-6")]: { owned: true },
    };
    expect(index.coverage(snapshot).edition("core", "1-6").available).toBe(false);

    const upgraded = { ...snapshot, [collectionKey("upgrade-pack", "i")]: { owned: true } };
    expect(index.coverage(upgraded).edition("core", "1-6").available).toBe(true);
    expect(index.coverage(snapshot).edition("core", "sim").available).toBe(false);
    expect(snapshot[collectionKey("core", "1-6")]).toBeUndefined();
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

  it("leaves unreviewed live bundle components unpriced", () => {
    expect(reviewIndex(catalog as ReviewCatalog).bundlePricing("halloween-trick-or-treat-bag", "plastic")).toEqual({
      total: 0,
      missing: 0,
      unavailable: 7,
      savings: undefined,
      percent: undefined,
    });
  });

  it.each(["included", "unpriced"])("does not infer a price for the %s edition", (editionId) => {
    const data = pricingFixture();
    data.bundles.set.includes = [{ item: "model", editionId }];
    const item = data.content.model;
    expect(
      reviewPrice(
        item,
        item.editions!.find((edition) => edition.id === editionId)!,
      ),
    ).toBeUndefined();
    expect(reviewIndex(data).bundlePricing("set", "bundle")).toEqual({
      total: 0,
      missing: editionId === "unpriced" ? 1 : 0,
      unavailable: editionId === "included" ? 1 : 0,
      savings: undefined,
      percent: undefined,
    });
  });

  it.each(["included", "unpriced"])("uses an explicit price reference only for bundle comparisons of %s", (editionId) => {
    const data = pricingFixture();
    const item = data.content.model;
    const edition = item.editions!.find((edition) => edition.id === editionId)!;
    edition.priceFrom = "sold";
    data.bundles.set.includes = [{ item: "model", editionId }];
    const index = reviewIndex(data);
    expect(index.bundlePricing("set", "bundle")).toEqual({
      total: 2500,
      missing: 0,
      unavailable: 0,
      savings: 1500,
      percent: 60,
    });
    expect(reviewPrice(item, edition)).toBeUndefined();
    if (editionId === "included") {
      expect(index.coverage({ [collectionKey("model", "sold")]: { owned: true } }).edition("model", editionId).available).toBe(false);
      expect(index.coverage({ [collectionKey("model", editionId)]: { owned: true } }).edition("model", "sold").available).toBe(false);
    }
  });

  it("uses the selected edition's own price rather than a cheaper equivalent", () => {
    const data = pricingFixture();
    data.bundles.set.includes = [{ item: "model", editionId: "sold" }];
    expect(reviewIndex(data).bundlePricing("set", "bundle")?.total).toBe(2500);
  });

  it("does not follow a price reference beyond its target or search when that target loses its price", () => {
    const data = pricingFixture();
    const [included, sold] = data.content.model.editions!;
    included!.priceFrom = "sold";
    delete sold!.prices;
    sold!.priceFrom = "cheaper";
    expect(reviewIndex(data).bundlePricing("set", "bundle")).toMatchObject({ total: 0, missing: 1, savings: undefined });
  });

  it("preserves known zero prices through explicit references", () => {
    const data = pricingFixture();
    const [included, sold] = data.content.model.editions!;
    included!.priceFrom = "sold";
    sold!.prices = [0];
    expect(reviewIndex(data).bundlePricing("set", "bundle")).toEqual({
      total: 0,
      missing: 0,
      unavailable: 0,
      savings: -1000,
      percent: undefined,
    });
  });

  it("prices bundle contents by exact edition ownership and reports unavailable or unknown prices", () => {
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
      bundles: {
        set: { name: "Set", tags: [], price: 800, includes: [{ item: "box", editionId: "box-plastic" }] },
      },
      "included-only": {},
      accessories: {},
      homebrew: {},
    };
    const index = reviewIndex(data);
    expect(index.bundlePricing("set", "bundle")).toEqual({
      total: 1000,
      missing: 0,
      unavailable: 0,
      savings: 200,
      percent: 20,
    });
    const exactOwnership = { [collectionKey("box", "box-plastic")]: { owned: true } };
    expect(index.bundlePricing("set", "bundle", exactOwnership)).toEqual({
      total: 0,
      missing: 0,
      unavailable: 0,
      savings: -800,
      percent: undefined,
    });
    const otherEdition = { [collectionKey("box", "box-resin")]: { owned: true } };
    expect(index.bundlePricing("set", "bundle", otherEdition)?.total).toBe(1000);
    expect(index.bundlePricing("set", "bundle")?.total).toBe(1000);
    data.bundles.set.includes!.push({ item: "model", editionId: "missing-edition" });
    expect(reviewIndex(data).bundlePricing("set", "bundle")).toEqual({
      total: 1000,
      missing: 1,
      unavailable: 0,
      savings: undefined,
      percent: undefined,
    });
    data.content.box.currency = "EUR";
    expect(reviewIndex(data).bundlePricing("set", "bundle")?.savings).toBeUndefined();

    data.bundles.set.includes = [{ item: "model", editionId: "model-sim" }];
    data.content.model.editions![1]!.includedOnly = true;
    data.content.model.editions![1]!.prices = undefined;
    expect(reviewIndex(data).bundlePricing("set", "bundle")).toMatchObject({
      total: 0,
      missing: 0,
      unavailable: 1,
      savings: undefined,
    });
    delete data.content.model.editions![1]!.includedOnly;
    expect(reviewIndex(data).bundlePricing("set", "bundle")).toMatchObject({
      total: 0,
      missing: 1,
      unavailable: 0,
      savings: undefined,
    });
  });

  it("prices duplicate equivalent references once and does not charge a listed child beneath its parent", () => {
    const data: ReviewCatalog = {
      content: {
        box: {
          name: "Box",
          tags: [],
          editions: [{ id: "box", label: "Box", format: "physical", prices: [1000] }],
          includes: [{ item: "model", editionId: "plastic" }],
        },
        model: {
          name: "Model",
          tags: [],
          editions: [
            { id: "plastic", label: "Plastic", format: "physical", prices: [500] },
            { id: "plastic-copy", label: "Plastic", equivalentTo: "plastic", format: "physical", prices: [650] },
            { id: "resin", label: "Resin", format: "physical", prices: [800] },
          ],
        },
      },
      bundles: {
        set: {
          name: "Set",
          tags: [],
          price: 1200,
          includes: [
            { item: "box", editionId: "box" },
            { item: "model", editionId: "plastic" },
            { item: "model", editionId: "plastic-copy" },
          ],
        },
      },
      accessories: {},
      homebrew: {},
      "included-only": {},
    };
    const index = reviewIndex(data);
    expect(index.bundlePricing("set", "bundle")).toEqual({
      total: 1000,
      missing: 0,
      unavailable: 0,
      savings: -200,
      percent: -20,
    });

    data.bundles.set.includes = [
      { item: "model", editionId: "plastic" },
      { item: "model", editionId: "plastic-copy" },
    ];
    const directOnly = reviewIndex(data);
    expect(directOnly.bundlePricing("set", "bundle")?.total).toBe(500);
    expect(directOnly.bundlePricing("set", "bundle", { [collectionKey("model", "plastic-copy")]: { owned: true } })?.total).toBe(0);
    expect(directOnly.bundlePricing("set", "bundle", { [collectionKey("model", "resin")]: { owned: true } })?.total).toBe(500);
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
    expect(index.ownershipKeys([{ item: core, edition: standalone }])).toEqual([collectionKey("core", standalone.id)]);
    expect(reviewShopUrl(data.accessories.rulebook, included)).toBeUndefined();
    expect(reviewShopUrl(data.accessories.rulebook, standalone)).toBe("https://shop.kingdomdeath.com/products/rulebook");
  });
});
