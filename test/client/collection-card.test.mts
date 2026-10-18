import { expect, it, vi } from "vitest";
import { render } from "svelte/server";
import { Parser } from "htmlparser2";
import { reviewIndex, type ReviewCatalog } from "#lib/catalog-view.ts";
import CollectionCard from "#lib/components/track/CollectionCard.svelte";

const context = await vi.hoisted(async () => {
  const { createHash } = await import("node:crypto");
  const { resolve } = await import("node:path");
  const filename = resolve("src/lib/components/track/CollectionCard.svelte").replaceAll("\\", "/");
  const hash = createHash("sha256").update(filename).digest("hex").slice(0, 8);
  return { collection: {} as unknown, stylesheet: `/src/lib/components/track/__uno_CollectionCard_${hash}.svelte.css` };
});
vi.mock("#lib/state/collection.svelte.ts", () => ({ getCollection: () => context.collection }));
// SSR assertions do not need UnoCSS output. Its shared virtual CSS cache can miss entries across Vitest projects.
vi.mock(context.stylesheet, () => ({}));

it("renders physical edition ownership and wishlist independently of content coverage", () => {
  const data: ReviewCatalog = {
    content: {
      core: {
        name: "Core",
        tags: [],
        editions: [
          { id: "old", label: "1.5", format: "physical" },
          { id: "new", label: "1.6", format: "physical" },
        ],
      },
    },
    accessories: {},
    bundles: {},
    homebrew: {},
    "included-only": {},
  };
  const catalog = reviewIndex(data);
  context.collection = {
    catalog,
    state: {},
    canWrite: true,
    getEdition: (_item: string, edition: string) => (edition === "old" ? { owned: true } : { wished: true }),
    coverage: {
      edition: () => ({ available: true }),
      contents: () => ({ children: [], exactCount: 0 }),
    },
  };
  const { body } = render(CollectionCard, {
    props: {
      item: catalog.entries[0],
      ready: true,
      collapsed: false,
      selectedTags: [],
      observe: () => {},
      onToggle: () => {},
      onHold: () => "",
      onTagClick: () => {},
    },
  });
  const controls = new Map<string, Record<string, string>>();
  new Parser({
    onopentag: (_name, attributes) => {
      if (attributes["aria-label"]) controls.set(attributes["aria-label"], attributes);
    },
  }).end(body);
  expect(controls.get("Remove ownership of Core, 1.5")).toHaveProperty("checked");
  expect(controls.get("Have Core, 1.6")).not.toHaveProperty("checked");
  expect(controls.get("Have Core, 1.6")).not.toHaveProperty("indeterminate");
  expect(controls.get("Wishlist Core, 1.6")).not.toHaveProperty("disabled");
  expect(controls.get("Wishlist Core, 1.6")?.["aria-pressed"]).toBe("true");
  expect(controls.get("View Core, 1.5")?.["aria-pressed"]).toBe("true");
});
