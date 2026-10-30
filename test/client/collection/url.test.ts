import { describe, expect, it } from "vitest";
import { collectionHash, type CollectionView } from "#lib/kdm/collection/url.ts";

describe("collection hash routes", () => {
  it.each(["", "#", "#/", "#cards", "#cards?q=ignored", "#/unknown", "#/%E0%A4%A"])("defaults safely for %s", (hash) => {
    expect(collectionHash.read(hash)).toEqual({ category: "content", query: "", tags: [] });
  });

  it("reads category, search, and repeated tags entirely inside the fragment", () => {
    expect(collectionHash.read("#/accessories?q=Black+Dice&tag=dice&tag=black&tag=dice")).toEqual({
      category: "accessories",
      query: "Black Dice",
      tags: ["dice", "black"],
    });
    expect(collectionHash.read("#/included-only?q=model").category).toBe("content");
  });

  it("round-trips reserved characters and Unicode without treating them as routing syntax", () => {
    const view: CollectionView = { category: "content", query: "lion & dragon? #/ + café", tags: ["monster-lion", "a&b"] };
    const hash = collectionHash.format(view);
    const url = new URL(`https://example.test/kdm/collection/${hash}`);
    expect(url.search).toBe("");
    expect(collectionHash.read(url.hash)).toEqual(view);
  });

  it("omits default state and never serializes local ownership or wishlist filters", () => {
    expect(collectionHash.format({ category: "content", query: "", tags: [] })).toBe("");
    expect(collectionHash.format({ category: "homebrew", query: "", tags: [] })).toBe("#/homebrew");
    expect(collectionHash.format({ category: "content", query: "dragon king", tags: ["monster", "monster"] })).toBe(
      "#/content?q=dragon+king&tag=monster",
    );
    expect(collectionHash.read("#/content?status=owned&wished=true")).toEqual({ category: "content", query: "", tags: [] });
  });
});

describe("exact collection item routes", () => {
  it("preserves case and safely round-trips each encoded segment once", () => {
    const view: CollectionView = { category: "content", itemId: "Model /%?#?", query: "", tags: [] };
    expect(collectionHash.read(collectionHash.format(view))).toEqual(view);
    expect(collectionHash.read("#/content/Model").itemId).toBe("Model");
  });

  it("gives item routes precedence over query and tags when reading and writing", () => {
    expect(collectionHash.read("#/content/model?q=other&tag=monster")).toEqual({
      category: "content",
      itemId: "model",
      query: "",
      tags: [],
    });
    expect(collectionHash.format({ category: "content", itemId: "model", query: "other", tags: ["monster"] })).toBe("#/content/model");
  });

  it.each(["#/content/", "#/content/model/extra", "#/unknown/model", "#/content/%E0%A4%A"])(
    "retains invalid item-shaped path %s as an item view",
    (hash) => {
      const view = collectionHash.read(hash);
      expect(view.itemId).toBeNull();
      expect(collectionHash.read(collectionHash.format(view))).toEqual(view);
    },
  );
});
