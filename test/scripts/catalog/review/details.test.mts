import { expect, it } from "vitest";
import { resolve } from "node:path";
import { itemDifferences, listingDetails, resolutionDetails } from "#scripts/catalog/review/details.mts";
import type { Catalog } from "#scripts/catalog/types.mts";

it("shows exact added, removed, and changed fields using permanent edition IDs", () => {
  const before = {
    name: "Example",
    tags: ["model"],
    notes: "Old note",
    editions: [{ id: "stable-id", label: "First Run", prices: [2000] }],
  };
  const after = {
    name: "Example",
    tags: ["model"],
    description: "New description",
    editions: [{ id: "stable-id", label: "Box", prices: [2000, 3000] }],
  };
  expect(itemDifferences(before, after)).toEqual([
    { field: "notes", change: "removed", before: "Old note" },
    { field: "description", change: "added", after: "New description" },
    { field: "editions[stable-id].label", change: "changed", before: "First Run", after: "Box" },
    { field: "editions[stable-id].prices", change: "changed", before: [2000], after: [2000, 3000] },
  ]);
  expect(itemDifferences(null, after)).toEqual([{ field: "item", change: "added" }]);
});

it("distinguishes edition order from edition creation or removal", () => {
  const first = { id: "first", label: "Box" },
    second = { id: "second", label: "Box" };
  const before = { name: "Example", tags: [], editions: [first, second] };
  expect(itemDifferences(before, { ...before, editions: [second, first] })).toEqual([
    { field: "editions.order", change: "changed", before: ["first", "second"], after: ["second", "first"] },
  ]);
  expect(itemDifferences(before, { ...before, editions: [first] })).toEqual([
    { field: "editions[second]", change: "removed", before: second },
  ]);
});

it("highlights only additions and removals for long announcement or tag lists", () => {
  const before = { name: "Example", tags: ["model", "old"], announcements: ["2024-01-01", "2025-01-01"] };
  const after = { name: "Example", tags: ["model", "new"], announcements: ["2024-01-01", "2025-01-01", "2026-01-01"] };
  expect(itemDifferences(before, after)).toEqual([
    { field: "tags", change: "changed", added: ["new"], removed: ["old"] },
    { field: "announcements", change: "changed", added: ["2026-01-01"] },
  ]);
});

it("preserves listing facts and removes recursive metadata, media, and embedded media markup", () => {
  const source = {
    url: "https://shop.kingdomdeath.com/products/example",
    checkedAt: "2026-11-01T00:00:00Z",
    data: {
      id: 1,
      title: "Example",
      handle: "example",
      description: '<p>Keep &amp; verify</p><img src="image.jpg"><video><source src="video.mp4"></video><p>More facts</p>',
      body_html: '<p>Contents</p><picture><img src="image.jpg"></picture>',
      images: [{ src: "image.jpg" }],
      media: [{ type: "video" }],
      variants: [
        {
          id: 2,
          title: "US Warehouse",
          price: 3000,
          compare_at_price: 2000,
          requires_shipping: true,
          option1: "US Warehouse",
          option2: null,
          option3: null,
          taxable: true,
          position: 1,
          available: true,
          sku: "sku",
          featured_image: { src: "image.jpg" },
          image_id: 3,
        },
      ],
      options: [{ name: "Warehouse", values: ["US"] }],
      vendor: "Kingdom Death",
      published_at: "2026-01-01",
      custom: { fact: 4, image_url: "image.jpg" },
    },
  };
  const saved = structuredClone(source);
  const listing = listingDetails(source, "curated");
  expect(listing).toEqual({
    url: "https://shop.kingdomdeath.com/products/example",
    checkedAt: "2026-11-01T00:00:00Z",
    confidence: "curated",
    product: {
      id: 1,
      title: "Example",
      handle: "example",
      description: "Keep & verify\n\nMore facts",
      body_html: "Contents",
      variants: [{ id: 2, title: "US Warehouse", price: 3000, compare_at_price: 2000, available: true, sku: "sku" }],
      published_at: "2026-01-01",
      custom: { fact: 4 },
    },
  });
  expect(source).toEqual(saved);
});

it("turns editor HTML into readable descriptions while keeping paragraphs, lists, and links", () => {
  const source = {
    url: "https://shop.kingdomdeath.com/products/example",
    checkedAt: "2026-11-01T00:00:00Z",
    data: {
      id: 1,
      title: "Example",
      handle: "example",
      variants: [],
      body_html: `
        <meta charset="utf-8"><style>.fluff { color: red; }</style>
        <p style="text-align: center;"><span id="editor-id" data-mce-fragment="1">&nbsp;</span></p>
        <p class="fluff"><strong>Box contents</strong><br>Resin &amp; plastic</p>
        <ul data-mce-style="text-align: left;">
          <li><span style="color: red;">1 miniature</span></li>
          <li>2 cards</li>
        </ul>
        <p>Assembly:</p><ol><li>Clean parts</li><li>Build model</li></ol>
        <p>Read the <a href="https://example.com/guide" target="_blank" class="fluff">guide</a>.</p>
        <script>doSomething()</script><!-- editor comment -->
      `,
      description: "Already plain text\nwith a line break.\n\nAnother paragraph.",
    },
  };
  const saved = structuredClone(source);
  const listing = listingDetails(source);
  expect(listing.product.body_html).toBe(
    "Box contents\nResin & plastic\n\n- 1 miniature\n- 2 cards\n\nAssembly:\n\n1. Clean parts\n2. Build model\n\nRead the guide (https://example.com/guide).",
  );
  expect(listing.product.description).toBe(source.data.description);
  expect(source).toEqual(saved);
});

it("attaches the existing catalog choices and exact mapping location to unresolved matches", () => {
  const catalog: Catalog = {
    content: { example: { name: "Example", tags: ["model"], editions: [{ id: "bust", label: "Bust" }] } },
    accessories: {},
    bundles: {},
    homebrew: {},
    "included-only": {},
  };
  const result = resolutionDetails(
    { handle: "example-bust", candidates: ["example"] },
    catalog,
    {},
    "scripts/catalog/data/shop-mappings.json",
  );
  expect(result.catalogItems[0]).toEqual({ category: "content", itemId: "example", item: catalog.content.example });
  expect(result.mappingFile).toContain("shop-mappings.json");
  expect(result.catalogFile).toBe(resolve("static/kdm/catalog/data.json"));
  expect(result.instructions.join(" ")).toContain("variantEditionIds");
  expect(result.instructions.join(" ")).toContain("distinct new release");
});

it("deduplicates descriptions after cleanup recursively without changing raw evidence", () => {
  const data = {
    id: 1,
    title: "Example",
    handle: "example",
    variants: [],
    description: "Same & text",
    body_html: '<p>Same &amp; text</p><img src="image.jpg">',
    nested: [
      { description: "<p>Nested</p>", body_html: "Nested", vendor: "Shop", options: [] },
      { body_html: "Body only" },
      { description: "", body_html: "<img src='image.jpg'>" },
      { description: "Different", body_html: "Keep body" },
    ],
  };
  const source = { url: "https://example.com", checkedAt: "2026-11-01T00:00:00Z", data };
  const saved = structuredClone(source);
  expect(listingDetails(source).product).toEqual({
    id: 1,
    title: "Example",
    handle: "example",
    variants: [],
    description: "Same & text",
    nested: [
      { description: "Nested" },
      { body_html: "Body only" },
      { description: "" },
      { description: "Different", body_html: "Keep body" },
    ],
  });
  expect(source).toEqual(saved);
});
