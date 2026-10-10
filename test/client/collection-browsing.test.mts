import { afterEach, describe, expect, it, vi } from "vitest";
import { SvelteMap } from "svelte/reactivity";
import { reviewIndex, type ReviewCatalog } from "#lib/catalog-view.ts";
import { CollectionBrowsing } from "#lib/collection-browsing.svelte.ts";
import type { EntryState } from "#lib/types/index.ts";

function fixture(count = 0) {
  const data: ReviewCatalog = {
    content: {
      model: {
        name: "Lantern Knight",
        aliases: ["Tomorrow"],
        tags: ["monster-lion", "armor-kit", "armor-kit"],
        editions: [
          { id: "old", label: "Original", format: "physical" },
          { id: "new", label: "New", format: "physical" },
        ],
      },
      core: { name: "Core", gameplay: true, tags: ["monster-lion"] },
      included: {
        name: "Included model",
        tags: ["armor-kit"],
        editions: [
          { id: "old", label: "Original", format: "physical" },
          { id: "included", label: "Included", format: "physical", standalone: false },
        ],
      },
      ...Object.fromEntries(Array.from({ length: count }, (_, i) => [`model-${i}`, { name: `Model ${i}`, tags: ["model"] }])),
    },
    accessories: {
      dice: { name: "Dice", tags: ["dice"] },
      ...Object.fromEntries(Array.from({ length: count }, (_, i) => [`accessory-${i}`, { name: `Accessory ${i}`, tags: ["accessory"] }])),
    },
    bundles: { set: { name: "Set", tags: ["bundle"] } },
    homebrew: {},
    "included-only": { hidden: { name: "Hidden", tags: [] } },
  };
  const catalog = reviewIndex(data);
  const states = new SvelteMap<string, EntryState>();
  let url = new URL("https://example.test/collection?keep=yes#cards");
  const replace = vi.fn((next: URL) => {
    url = next;
  });
  const browsing = new CollectionBrowsing(catalog, (item, edition) => states.get(`${item}/${edition}`) ?? {}, {
    current: () => url,
    replace,
  });
  return {
    browsing,
    states,
    replace,
    get url() {
      return url;
    },
    navigate(search: string) {
      url = new URL(`https://example.test/collection${search}`);
      browsing.restore(url);
    },
  };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("collection browsing", () => {
  it("starts with a gameplay-first batch and caps the final batch without exposing included-only items", () => {
    const { browsing } = fixture(205);
    expect(browsing.category).toBe("content");
    expect(browsing.visible).toHaveLength(100);
    expect(browsing.visible.slice(0, 3).map((item) => item.id)).toEqual(["core", "model", "included"]);
    expect(browsing.panels.map((panel) => panel.id)).toEqual(["content"]);
    expect(browsing.nextCount).toBe(100);
    browsing.showMoreItems();
    expect(browsing.visible).toHaveLength(200);
    expect(browsing.nextCount).toBe(8);
    browsing.showMoreItems();
    browsing.showMoreItems();
    expect(browsing.visible).toHaveLength(208);
    expect(browsing.nextCount).toBe(0);
    expect(browsing.filtered.some((item) => item.id === "hidden")).toBe(false);
  });

  it("retains exact outgoing results and restores independent category batches after filters clear", () => {
    vi.useFakeTimers();
    const { browsing } = fixture(205);
    browsing.showMoreItems();
    browsing.setQuery("model");
    expect(browsing.visible.length).toBeGreaterThan(200);
    const outgoing = browsing.visible;
    browsing.changeCategory("accessories");
    expect(browsing.panels.find((panel) => panel.id === "content")?.items).toEqual(outgoing);
    expect(browsing.panels.find((panel) => panel.id === "content")?.items[0]).toBe(outgoing[0]);
    expect(browsing.visible).toHaveLength(100);
    browsing.showMoreItems();
    const accessories = browsing.visible;
    browsing.changeCategory("bundles");
    expect(browsing.panels.find((panel) => panel.id === "accessories")?.items).toEqual(accessories);
    expect(browsing.visible.map((item) => item.id)).toEqual(["set"]);
    browsing.changeCategory("content");
    expect(browsing.query).toBe("");
    expect(browsing.visible).toHaveLength(200);
    browsing.toggleTag("model");
    expect(browsing.visible).toHaveLength(205);
    browsing.clearSearch();
    expect(browsing.visible).toHaveLength(200);
    browsing.changeCategory("accessories");
    expect(browsing.visible).toHaveLength(200);
  });

  it("restores URL filters in the destination category, deduplicating and rejecting unavailable tags without writing", () => {
    const f = fixture();
    f.navigate("?cat=accessories&q=%20Dice%20&tag=dice&tag=dice&tag=monster-lion&tag=missing");
    expect(f.browsing.category).toBe("accessories");
    expect(f.browsing.query).toBe(" Dice ");
    expect(f.browsing.selectedTags).toEqual(["dice"]);
    expect(f.browsing.filtered.map((item) => item.id)).toEqual(["dice"]);
    expect(f.replace).not.toHaveBeenCalled();
    f.navigate("?cat=included-only&tag=monster-lion&tag=dice");
    expect(f.browsing.category).toBe("content");
    expect(f.browsing.selectedTags).toEqual(["monster-lion"]);
    expect(f.browsing.filtered.map((item) => item.id)).toEqual(["core", "model"]);
  });

  it("combines normalized search with every selected tag and counts each tag once per matching item", () => {
    vi.useFakeTimers();
    const { browsing } = fixture();
    for (const query of ["  LANTERN  ", "Tomorrow", "model", "lion", "armor kit"]) {
      browsing.setQuery(query);
      expect(browsing.filtered.map((item) => item.id)).toContain("model");
    }
    browsing.setQuery("");
    browsing.toggleTag("monster-lion");
    expect(browsing.tagCounts.get("monster-lion")).toBe(2);
    expect(browsing.tagCounts.get("armor-kit")).toBe(1);
    browsing.toggleTag("armor-kit");
    expect(browsing.filtered.map((item) => item.id)).toEqual(["model"]);
    browsing.setQuery("core");
    expect(browsing.filtered).toEqual([]);
    expect(browsing.tagCounts.size).toBe(0);
    expect(browsing.nextCount).toBe(0);
  });

  it("reacts to ownership and wishlist changes on any edition and preserves status across categories", () => {
    const { browsing, states } = fixture();
    browsing.toggleStatus("owned");
    expect(browsing.filtered).toEqual([]);
    states.set("model/old", { owned: true });
    expect(browsing.filtered.map((item) => item.id)).toEqual(["model"]);
    states.set("model/old", { wished: true });
    expect(browsing.filtered).toEqual([]);
    browsing.toggleStatus("wishlist");
    expect(browsing.filtered.map((item) => item.id)).toEqual(["model"]);
    browsing.changeCategory("accessories");
    expect(browsing.status).toBe("wishlist");
    states.set("dice/item", { wished: true });
    expect(browsing.filtered.map((item) => item.id)).toEqual(["dice"]);
    browsing.toggleStatus("wishlist");
    expect(browsing.status).toBe("all");
    browsing.toggleStatus("owned");
    browsing.clearSearch();
    expect(browsing.status).toBe("all");
  });

  it("targets latest standalone unowned editions across all results, using stable and synthetic IDs", () => {
    const { browsing, states } = fixture(205);
    expect(browsing.latestUnowned).toHaveLength(207);
    expect(browsing.latestUnowned.slice(0, 2).map(({ item, edition }) => [item.id, edition.id])).toEqual([
      ["core", "item"],
      ["model", "new"],
    ]);
    states.set("model/old", { owned: true });
    expect(browsing.latestUnowned.some(({ item }) => item.id === "model")).toBe(true);
    states.set("model/new", { owned: true });
    expect(browsing.latestUnowned.some(({ item }) => item.id === "model")).toBe(false);
    browsing.toggleTag("monster-lion");
    expect(browsing.latestUnowned.map(({ item }) => item.id)).toEqual(["core"]);
    browsing.changeCategory("bundles");
    expect(browsing.latestUnowned.map(({ item, edition }) => [item.id, edition.id])).toEqual([["set", "bundle"]]);
  });

  it("debounces search writes while filtering immediately, then clears immediately without a trailing write", () => {
    vi.useFakeTimers();
    const f = fixture();
    f.browsing.setQuery("core");
    expect(f.browsing.filtered.map((item) => item.id)).toEqual(["core"]);
    vi.advanceTimersByTime(200);
    f.browsing.setQuery("Tomorrow");
    vi.advanceTimersByTime(249);
    expect(f.replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(f.url.searchParams.get("q")).toBe("Tomorrow");
    f.browsing.setQuery("unfinished");
    const clear = f.browsing.clearSearch;
    clear();
    expect(f.url.searchParams.has("q")).toBe(false);
    vi.runAllTimers();
    expect(f.replace).toHaveBeenCalledTimes(2);
    expect(f.url.searchParams.get("keep")).toBe("yes");
    expect(f.url.hash).toBe("#cards");
  });

  it("cancels pending writes before navigation, on restoration, and on page disposal", () => {
    vi.useFakeTimers();
    const f = fixture();
    f.browsing.setQuery("pending");
    f.browsing.cancelPendingUrl();
    vi.runAllTimers();
    expect(f.replace).not.toHaveBeenCalled();
    f.browsing.setQuery("pending again");
    f.navigate("?cat=accessories&q=dice");
    vi.runAllTimers();
    expect(f.url.searchParams.get("q")).toBe("dice");
    expect(f.replace).not.toHaveBeenCalled();
    f.browsing.setQuery("disposed");
    f.browsing.cancelPendingUrl();
    vi.runAllTimers();
    expect(f.replace).not.toHaveBeenCalled();
  });

  it("writes normalized category and tag parameters immediately and avoids redundant replacements", () => {
    vi.useFakeTimers();
    const f = fixture();
    f.navigate("?cat=content&tag=monster-lion&tag=monster-lion&tag=missing&keep=yes#cards");
    f.browsing.setQuery("Tomorrow");
    f.browsing.toggleTag("armor-kit");
    expect(f.url.searchParams.has("cat")).toBe(false);
    expect(f.url.searchParams.getAll("tag")).toEqual(["monster-lion", "armor-kit"]);
    expect(f.url.searchParams.get("q")).toBe("Tomorrow");
    vi.runAllTimers();
    expect(f.replace).toHaveBeenCalledTimes(1);
    f.browsing.changeCategory("accessories");
    expect(f.url.searchParams.get("cat")).toBe("accessories");
    expect(f.url.searchParams.has("q")).toBe(false);
    expect(f.url.searchParams.has("tag")).toBe(false);
    expect(f.url.searchParams.get("keep")).toBe("yes");
    expect(f.url.hash).toBe("#cards");
    f.browsing.changeCategory("accessories");
    f.browsing.toggleTag("monster-lion");
    expect(f.replace).toHaveBeenCalledTimes(2);
  });

  it("accepts tag IDs and display labels once, removes the last tag, and ignores unmatched queries", () => {
    vi.useFakeTimers();
    const f = fixture();
    f.browsing.setQuery(" LION ");
    expect(f.browsing.acceptTagQuery()).toBe(true);
    expect(f.browsing.query).toBe("");
    expect(f.browsing.selectedTags).toEqual(["monster-lion"]);
    f.browsing.setQuery("monster-lion");
    expect(f.browsing.acceptTagQuery()).toBe(true);
    expect(f.browsing.selectedTags).toEqual(["monster-lion"]);
    f.browsing.setQuery("armor kit");
    expect(f.browsing.acceptTagQuery()).toBe(true);
    expect(f.browsing.selectedTags).toEqual(["monster-lion", "armor-kit"]);
    f.browsing.removeLastTag();
    expect(f.url.searchParams.getAll("tag")).toEqual(["monster-lion"]);
    f.browsing.setQuery("unmatched");
    expect(f.browsing.acceptTagQuery()).toBe(false);
    expect(f.browsing.query).toBe("unmatched");
    f.browsing.cancelPendingUrl();
  });
});
