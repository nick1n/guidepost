import { catalogTemp } from "#scripts/catalog/paths.mts";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { test } from "node:test";
import { applyAvailability, planUpdate as prepareUpdate, productExclusion, releaseGaps } from "#scripts/catalog/update.mts";
import { resolveReleases } from "#scripts/catalog/releases.mts";
import { catalogListing, productUrl, ShopClient, ShopError, shopProduct } from "#scripts/catalog/shop.mts";
import { applyReview } from "#scripts/update-catalog.mts";
import { refreshAvailability } from "#scripts/refresh-catalog-availability.mts";
import { availabilityFromUrls } from "#scripts/catalog/availability.mts";
import { categories, type Catalog, type Product } from "#scripts/catalog/types.mts";
import { normalizeItem } from "#scripts/catalog/normalize.mts";
import { organizeCatalog, compareEditions, orderItemFields } from "#scripts/catalog/order.mts";
import { validateCatalog } from "#scripts/catalog/validate.mts";
import { applyTags, loadTags, tagSchema, organizeTags, type Tags } from "#scripts/catalog/tags.mts";
import { prefixedId } from "#scripts/catalog/identity.mts";

function fixturePath(root: string, path: string) {
  return join(/^(kdm-tags|imports\/|reports\/)/.test(path) ? catalogTemp(root) : root, path);
}

test("deleted local tag files fall back to saved catalog assignments", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-catalog-tags-"));
  const root = join(workspace, "static/kdm-catalog");
  await mkdir(root, { recursive: true });
  await mkdir(catalogTemp(root), { recursive: true });
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const catalog = empty();
  catalog.content.aya = { name: "Aya", kind: "model", tags: ["aya", "female"] };
  await writeFile(join(root, "data.json"), JSON.stringify(catalog));
  const master = await loadTags(root);
  assert.equal(master.local, false);
  assert.deepEqual(master.tags.content.aya, ["aya", "female"]);
  assert.deepEqual(JSON.parse(master.schemaText).$defs.tag.enum, ["aya", "female"]);
  applyTags(catalog, master.tags);
  assert.deepEqual(catalog.content.aya.tags, ["aya", "female"]);
  await assert.rejects(readFile(join(catalogTemp(root), "kdm-tags.json")), { code: "ENOENT" });
  await writeFile(join(catalogTemp(root), "kdm-tags.json"), "invalid json");
  await assert.rejects(loadTags(root));
});

// Existing fixtures supply their own reviewed tags; production loads local assignments or catalog tags.
function planUpdate(
  before: Parameters<typeof prepareUpdate>[0],
  evidence: Parameters<typeof prepareUpdate>[1],
  mappings: Parameters<typeof prepareUpdate>[2],
  news: Parameters<typeof prepareUpdate>[3],
) {
  const tags = Object.fromEntries(
    categories.map((category) => [category, Object.fromEntries(Object.entries(before[category]).map(([id, item]) => [id, item.tags]))]),
  ) as Tags;
  return prepareUpdate(before, evidence, mappings, news, tags);
}

const tagFile = (content: Record<string, string[]> = {}): Tags => ({
  content,
  accessories: {},
  bundles: {},
  homebrew: {},
  "included-only": {},
});

const empty = (): Catalog => ({ content: {}, accessories: {}, bundles: {}, homebrew: {}, "included-only": {} });
const product = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  handle: "kds-rene",
  title: "KDS - Rene",
  description: "<ul><li>Digital pattern card</li></ul>",
  variants: [{ id: 10, title: "Rene", price: 700, compare_at_price: null, requires_shipping: false, sku: "Rene" }],
  ...overrides,
});
function releasePrices(variants: Product["variants"], previous: number[] = []) {
  const item = { name: "Example", tags: [], editions: [{ id: "sim", label: "Sim", prices: previous }] };
  return resolveReleases(item, product({ variants }), {
    policy: "update",
    mapping: {
      category: "content",
      itemId: "example",
      variantEditions: Object.fromEntries(variants.map((variant) => [String(variant.id), "Sim"])),
    },
  }).releases[0]!.prices;
}

const source = (data: Product) => ({
  data,
  url: "https://shop.kingdomdeath.com/products/" + data.handle + ".js",
  checkedAt: "2026-10-01T00:00:00Z",
});

test("physical Simulator key availability excludes digital access variants", () => {
  const catalog = empty();
  catalog.content.core = {
    name: "Core",
    tags: ["core"],
    editions: [{ label: "Sim", url: "/products/kingdom-death-simulator-1" }],
  };
  catalog.content["kingdom-death-simulator"] = {
    name: "Simulator",
    kind: "simulator",
    tags: ["simulator"],
    editions: [{ label: "Master Dwelling Key", url: "/products/kingdom-death-simulator-1" }],
  };
  const listing = product({
    handle: "kingdom-death-simulator-1",
    variants: [
      { id: 1, title: "Master Key", price: 30000, compare_at_price: null, requires_shipping: true, sku: "master", available: false },
      {
        id: 2,
        title: "Digital Dwelling Key",
        price: 2000,
        compare_at_price: null,
        requires_shipping: false,
        sku: "digital",
        available: true,
      },
    ],
  });
  availabilityFromUrls(catalog, [listing]);
  assert.equal(catalog.content["kingdom-death-simulator"].editions![0]!.available, undefined);
  assert.equal(catalog.content.core.editions![0]!.available, true);
  listing.variants[0]!.available = true;
  listing.variants[1]!.available = false;
  availabilityFromUrls(catalog, [listing]);
  assert.equal(catalog.content["kingdom-death-simulator"].editions![0]!.available, true);
  assert.equal(catalog.content.core.editions![0]!.available, undefined);
});

test("spaced Death Grey shop variants match Deathgrey during availability refresh", () => {
  const catalog = empty();
  catalog.content.aya = {
    name: "Aya",
    tags: ["aya"],
    url: "/products/aya",
    editions: [{ label: "First Run" }, { label: "Deathgrey", prices: [3500] }],
  };
  const listing = product({
    handle: "aya",
    variants: [
      { ...product().variants[0]!, title: "HQ Warehouse (USA) - First Run Collectors Edition", requires_shipping: true, available: true },
      { ...product().variants[0]!, title: "HQ Warehouse (USA) - Death Grey Edition", requires_shipping: true, available: false },
    ],
  });
  availabilityFromUrls(catalog, [listing]);
  assert.equal(catalog.content.aya.editions![1]!.available, undefined);
  listing.variants[1]!.available = true;
  availabilityFromUrls(catalog, [listing]);
  assert.deepEqual(catalog.content.aya.editions![1], { label: "Deathgrey", prices: [3500], available: true });
});

test("cached Death Pink and Second Run names match their distinct catalog editions during availability refresh", () => {
  for (const [label, title] of [
    ["Deathpink", "HQ Warehouse (USA) - Death Pink Edition"],
    ["Bust: Second Run", "HQ Warehouse (USA) - Second Run Collectors Edition"],
  ]) {
    const catalog = empty();
    catalog.content.model = {
      name: "Model",
      tags: ["model"],
      url: "/products/model",
      editions: [{ label: label!.startsWith("Bust:") ? "Bust: First Run" : "First Run" }, { label: label!, prices: [3000] }],
    };
    const listing = product({
      handle: "model",
      variants: [
        { ...product().variants[0]!, title: "HQ Warehouse (USA) - First Run Collectors Edition", requires_shipping: true, available: true },
        { ...product().variants[0]!, title: title!, requires_shipping: true, available: false },
      ],
    });
    availabilityFromUrls(catalog, [listing]);
    assert.equal(catalog.content.model.editions![1]!.available, undefined);
    listing.variants[1]!.available = true;
    availabilityFromUrls(catalog, [listing]);
    assert.deepEqual(catalog.content.model.editions![1], { label: label, prices: [3000], available: true });
    if (label === "Bust: Second Run")
      assert.equal(
        resolveReleases(
          { name: "Bust", tags: [] },
          { ...listing, variants: [listing.variants[1]!] },
          { policy: "update", mapping: { category: "content", itemId: "bust", edition: "Bust: First Run" } },
        ).releases[0]!.label,
        "Bust: Second Run",
      );
  }
});

test("digital inclusions allow explicitly scoped physical keys", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-key-scope-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const schemaPath = join(workspace, "data.schema.json");
  await writeFile(schemaPath, await readFile("static/kdm-catalog/data.schema.json"));
  const catalog = empty();
  catalog.content.core = {
    name: "Core",
    kind: "core",
    tags: ["core"],
    editions: [{ id: "sim", label: "Sim", format: "digital", simulator: true as const }],
  };
  catalog.content["kingdom-death-simulator"] = {
    name: "Simulator",
    kind: "simulator",
    tags: ["simulator"],
    editions: [{ id: "dwelling-key", label: "Dwelling Key", format: "physical" }],
    includes: [{ item: "core", editionId: "sim", parentEditionIds: ["dwelling-key"] }],
  };
  organizeCatalog(catalog);
  await validateCatalog(catalog, schemaPath);
  catalog.content["kingdom-death-simulator"].includes = [{ item: "core", editionId: "sim" }];
  await assert.rejects(validateCatalog(catalog, schemaPath), /Unscoped digital inclusion/);
});

test("URL availability uses handles and release variants without name matching", () => {
  const catalog = empty();
  catalog.content.aya = {
    name: "Different name",
    tags: ["aya"],
    url: "/products/aya.js?variant=1",
    editions: [{ label: "First Run" }, { label: "Encore", available: true }, { label: "Painters", url: "/products/aya-painters" }],
  };
  catalog.content.unlinked = { name: "Aya", tags: ["aya"], editions: [{ label: "Plastic", available: true }] };
  const variant = product().variants[0]!;
  availabilityFromUrls(catalog, [
    product({
      handle: "aya",
      variants: [
        { ...variant, title: "USA First Run", requires_shipping: true, available: false },
        { ...variant, title: "UK First Run", requires_shipping: true, available: true },
        { ...variant, title: "Encore", requires_shipping: true, available: false },
      ],
    }),
    product({ handle: "aya-painters", variants: [{ ...variant, requires_shipping: true, available: true }] }),
  ]);
  assert.equal(catalog.content.aya.editions?.[0]?.available, true);
  assert.equal(catalog.content.aya.editions?.[1]?.available, undefined);
  assert.equal(catalog.content.aya.editions?.[2]?.available, true);
  assert.equal(catalog.content.unlinked.editions?.[0]?.available, undefined);
});

test("availability refresh downloads all pages, preserves raw snapshots, and changes only availability", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "kdm-availability-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "static/kdm-catalog/data.json");
  await mkdir(join(root, "static/kdm-catalog"), { recursive: true });
  const catalog = empty();
  catalog.content.aya = {
    name: "Aya",
    tags: ["aya"],
    url: "/products/aya",
    editions: [{ label: "Plastic", prices: [3000], releaseDate: "2020-01-01" }],
  };
  await writeFile(path, JSON.stringify(catalog));
  const raw = (handle: string, available: boolean) => ({
    ...product({ handle }),
    variants: [{ ...product().variants[0]!, title: "Warehouse", requires_shipping: true, price: "7.00", available }],
  });
  const calls: string[] = [];
  const result = await refreshAvailability({
    catalog: path,
    client: {
      async get(url: string) {
        calls.push(url);
        return {
          url,
          checkedAt: "2026-10-03",
          data: {
            products:
              calls.length === 1 ? Array.from({ length: 250 }, (_, n) => raw(n ? `other-${n}` : "aya", true)) : [raw("last", false)],
          },
        };
      },
    },
  });
  assert.deepEqual(calls, [
    "https://shop.kingdomdeath.com/products.json?limit=250&page=1",
    "https://shop.kingdomdeath.com/products.json?limit=250&page=2",
  ]);
  assert.equal(result.pages, 2);
  assert.equal(result.available, 1);
  const saved = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(saved.content.aya.editions[0], { ...catalog.content.aya.editions![0], available: true });
  Reflect.deleteProperty(saved.content.aya.editions[0], "available");
  assert.deepEqual(saved, catalog);
  const page = JSON.parse(await readFile(join(result.folder, "products-page-1.json"), "utf8"));
  assert.equal(page.products[0].variants[0].price, "7.00");
  assert.equal((await refreshAvailability({ catalog: path, offline: true })).changed, 0);
});

test("a failed pagination request cannot clear availability or replace named snapshots", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "kdm-availability-failure-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "static/kdm-catalog/data.json");
  const folder = join(root, "temp/kdm-catalog/shopify-products");
  await mkdir(dirname(path), { recursive: true });
  await mkdir(folder, { recursive: true });
  const original = JSON.stringify({
    ...empty(),
    content: { aya: { name: "Aya", tags: ["aya"], editions: [{ label: "Plastic", available: true }] } },
  });
  await writeFile(path, original);
  await writeFile(join(folder, "products-page-1.json"), "old snapshot");
  let calls = 0;
  await assert.rejects(
    refreshAvailability({
      catalog: path,
      client: {
        async get(url: string) {
          if (++calls === 2) throw new Error("Shop unavailable");
          return {
            url,
            checkedAt: "2026-10-03",
            data: {
              products: Array.from({ length: 250 }, () => ({
                ...product(),
                variants: [{ ...product().variants[0]!, price: "7.00", available: false }],
              })),
            },
          };
        },
      },
    }),
    /Shop unavailable/,
  );
  assert.equal(await readFile(path, "utf8"), original);
  assert.equal(await readFile(join(folder, "products-page-1.json"), "utf8"), "old snapshot");
});

test("availability aggregates warehouses and listings without changing release facts", () => {
  const catalog = empty();
  catalog.content.aya = {
    name: "Aya",
    tags: ["aya"],
    editions: [
      { label: "First Run", prices: [3000], releaseDate: "2020-01-01" },
      { label: "Encore", available: true },
    ],
  };
  const variant = product().variants[0]!;
  const listings = [
    product({
      handle: "aya",
      title: "Aya",
      variants: [
        { ...variant, id: 1, requires_shipping: true, title: "USA - First Run", available: false },
        { ...variant, id: 2, requires_shipping: true, title: "UK - First Run", available: true },
        { ...variant, id: 3, requires_shipping: true, title: "Encore", available: false },
      ],
    }),
    product({
      handle: "aya-other",
      title: "Aya",
      variants: [{ ...variant, requires_shipping: true, title: "First Run", available: false }],
    }),
  ];
  applyAvailability(catalog, listings);
  assert.deepEqual(catalog.content.aya.editions, [
    { label: "First Run", prices: [3000], releaseDate: "2020-01-01", available: true },
    { label: "Encore" },
  ]);
});

test("availability respects mapped variants and format editions while unknown evidence preserves facts", () => {
  const catalog = empty();
  catalog.content.aya = { name: "Aya", tags: ["aya"], editions: [{ label: "Plastic", available: true }, { label: "Painters" }] };
  const data = product({
    handle: "aya-painters",
    variants: [
      { ...product().variants[0]!, id: 1, requires_shipping: true, title: "USA", available: true },
      { ...product().variants[0]!, id: 2, requires_shipping: true, title: "UK", available: false },
    ],
  });
  const mapping = { "aya-painters": { category: "content" as const, itemId: "aya", edition: "Painters", variantIds: [2] } };
  applyAvailability(catalog, [data], mapping);
  assert.equal(catalog.content.aya.editions?.[1]?.available, undefined);
  mapping["aya-painters"].variantIds = [1, 2];
  applyAvailability(catalog, [data], mapping);
  assert.equal(catalog.content.aya.editions?.[1]?.available, true);
  applyAvailability(catalog, [product({ title: "Aya" })]);
  assert.equal(catalog.content.aya.editions?.[0]?.available, true);
  const item = { name: "Aya", tags: ["aya"], editions: [{ label: "Encore", available: false }] } as unknown as Catalog["content"][string];
  normalizeItem(item);
  assert.equal(Object.hasOwn(item.editions![0]!, "available"), false);
});

test("editions use release chronology, with Sim first and unknown dates last", () => {
  const editions = [
    { label: "Encore" },
    { label: "First Run", releaseDate: "2022-01-01" },
    { label: "Plastic", releaseWindow: "2026 Q4" },
    { label: "Painters", releaseDate: "2021-01-01" },
    { label: "Sim", simulator: true as const, releaseDate: "2024-01-01" },
    { label: "Box", releaseDate: "2020-01-01" },
    { label: "Deathgrey", releaseDate: "2022-01-01" },
  ].sort(compareEditions);
  assert.deepEqual(
    editions.map((e) => e.label),
    ["Sim", "Box", "Painters", "First Run", "Deathgrey", "Plastic", "Encore"],
  );
});

test("format mappings preserve release selectors and cannot remove standard gameplay", () => {
  const catalog = empty();
  catalog.content.morgan = {
    name: "Morgan",
    kind: "model",
    gameplay: true,
    tags: ["survivor"],
    editions: [
      { label: "Plastic" },
      { label: "Bust: First Run", gameplay: false, url: "/products/morgan-bust" },
      { label: "Bust: Encore", gameplay: false, url: "/products/morgan-bust" },
    ],
  };
  const data = product({ handle: "morgan-bust", variants: [{ ...product().variants[0]!, requires_shipping: true, title: "Encore" }] });
  assert.equal(
    resolveReleases({ name: "Example", tags: [] }, data, {
      policy: "update",
      mapping: { category: "content", itemId: "example", edition: "Painters" },
    }).releases[0]!.label,
    "Painters",
  );
  assert.equal(
    resolveReleases({ name: "Example", tags: [] }, data, {
      policy: "update",
      mapping: { category: "content", itemId: "example", edition: "Bust: First Run" },
    }).releases[0]!.label,
    "Bust: Encore",
  );
  const review = planUpdate(
    catalog,
    [source(data)],
    { "morgan-bust": { category: "content", itemId: "morgan", edition: "Bust: First Run", gameplay: false } },
    [],
  );
  assert.equal(review.catalog.content.morgan?.gameplay, true);
  assert.equal(review.catalog.content.morgan?.editions?.find((edition) => edition.label === "Bust: Encore")?.gameplay, false);
  assert.equal(review.catalog.content.morgan?.editions?.length, 3);
  const inferred = planUpdate(catalog, [source(data)], {}, []);
  assert.equal(inferred.unresolved.length, 0);
  assert.equal(inferred.catalog.content.morgan?.editions?.length, 3);
  assert.equal(inferred.catalog.content.morgan?.gameplay, true);
  assert.equal(inferred.catalog.content.morgan?.editions?.find((edition) => edition.label === "Bust: Encore")?.gameplay, false);
});

test("reviews expose missing editions and dates without assigning later announcements to older runs", () => {
  const catalog = empty();
  catalog.content["set-survivors-of-death-2"] = { name: "Survivors of Death II", kind: "set", tags: ["survivor"] };
  catalog.content.older = {
    name: "Older",
    kind: "model",
    tags: ["survivor"],
    editions: [{ label: "First Run", releaseDate: "2018-01-01" }, { label: "Encore" }, { label: "Plastic", releaseWindow: "2027 Q3" }],
  };
  catalog.accessories["shirt-older"] = { name: "Older Shirt", kind: "accessory", accessoryType: "shirt", tags: ["survivor"] };
  const before = structuredClone(catalog);
  const gaps = {
    missingEditions: [{ itemId: "set-survivors-of-death-2", name: "Survivors of Death II" }],
    missingDates: [{ itemId: "older", edition: "Encore" }],
  };
  assert.deepEqual(releaseGaps(catalog), gaps);
  const review = planUpdate(catalog, [], {}, [
    {
      date: "2026-09-30",
      shopUrl: "https://shop.kingdomdeath.com/products/older",
      postUrl: "https://kingdomdeath.com/news/older",
      itemName: "Older",
    },
  ]);
  assert.deepEqual(review.releaseGaps, { ...gaps, missingDates: [] });
  assert.equal(review.catalog.content.older?.editions?.find((edition) => edition.label === "Encore")?.releaseDate, "2018-01-01");
  assert.deepEqual(catalog, before);
});

test("an undated Encore inherits the curated First Run date", () => {
  const catalog = empty();
  catalog.content.owl = { name: "Owl", kind: "model", tags: ["survivor"], editions: [{ label: "First Run" }, { label: "Encore" }] };
  const data = product({
    handle: "owl",
    title: "Owl",
    variants: [
      { id: 1, title: "First Run", price: 3000, compare_at_price: null, requires_shipping: true, sku: "First" },
      { id: 2, title: "Encore", price: 3000, compare_at_price: null, requires_shipping: true, sku: "Encore" },
    ],
  });
  const review = planUpdate(
    catalog,
    [source(data)],
    { owl: { category: "content", itemId: "owl", edition: "First Run", releaseDate: "2024-02-29" } },
    [],
  );
  assert.equal(review.catalog.content.owl?.editions?.find((edition) => edition.label === "First Run")?.releaseDate, "2024-02-29");
  assert.equal(review.catalog.content.owl?.editions?.find((edition) => edition.label === "Encore")?.releaseDate, "2024-02-29");
  assert.deepEqual(review.releaseGaps.missingDates, []);
});

test("Encore date fallback prefers First Run, supports Deathgrey, and preserves known release facts", () => {
  for (const firstRunDate of [undefined, "2020-01-01"]) {
    const item = {
      name: "Owl",
      tags: ["survivor"],
      editions: [
        { label: "First Run", releaseDate: firstRunDate },
        { label: "Deathgrey", releaseDate: "2021-01-01" },
        { label: "Encore" },
        { label: "Plastic" },
      ],
    };
    normalizeItem(item);
    assert.equal(item.editions[2]?.releaseDate, firstRunDate ?? "2021-01-01");
    assert.equal(item.editions[3]?.releaseDate, undefined);
  }
  for (const encore of [
    { label: "Encore", releaseDate: "2023-01-01" },
    { label: "Encore", releaseWindow: "2027 Q3" },
  ]) {
    const item = { name: "Owl", tags: ["survivor"], editions: [{ label: "First Run", releaseDate: "2020-01-01" }, { ...encore }] };
    normalizeItem(item);
    assert.deepEqual(item.editions[1], { ...encore, format: "physical" });
  }
});

test("digital additions preserve a known physical listing and default gameplay to false", () => {
  const catalog = empty();
  catalog.content.rene = { name: "Rene", tags: ["rene"], kind: "model", price: 3400, url: "/products/physical-rene" };
  const plan = planUpdate(
    catalog,
    [source(product())],
    { "kds-rene": { category: "content", itemId: "rene", edition: "Sim", gameplay: true } },
    [],
  );
  assert.equal(plan.unresolved.length, 0);
  const item = plan.catalog.content.rene!;
  assert.equal(item.gameplay, undefined);
  const box = item.editions?.find((e) => e.label === "Box");
  assert.match(box?.id ?? "", /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.deepEqual(box, { id: box!.id, label: "Box", handle: "physical-rene", prices: [3400], format: "physical" });
  assert.equal(item.editions?.[0]?.gameplay, true);
  assert.equal(catalog.content.rene.price, 3400);
  assert.equal(
    planUpdate(
      plan.catalog,
      [source(product())],
      { "kds-rene": { category: "content", itemId: "rene", edition: "Sim", gameplay: true } },
      [],
    ).changes.length,
    0,
  );
});

test("the digital core selects one key and excludes physical keys and multipacks", () => {
  const catalog = empty();
  catalog.content.core = { name: "Monster", tags: ["campaign"], gameplay: true, editions: [{ label: "Sim", prices: [2000] }] };
  const variants = [
    { id: 1, title: "Master Key", price: 32000, compare_at_price: null, requires_shipping: true, sku: "1" },
    { id: 2, title: "Digital Dwelling Key", price: 2000, compare_at_price: null, requires_shipping: false, sku: "2" },
    { id: 3, title: "Digital 4-Pack", price: 8000, compare_at_price: null, requires_shipping: false, sku: "3" },
  ];
  const plan = planUpdate(
    catalog,
    [source(product({ handle: "kingdom-death-simulator-1", variants }))],
    { "kingdom-death-simulator-1": { category: "content", itemId: "core", edition: "Sim", variantIds: [2] } },
    [],
  );
  assert.deepEqual(plan.catalog.content.core?.editions?.[0]?.prices, [2000]);
  assert.equal(plan.catalog.content.core?.editions?.length, 1);
});

test("price corrections do not invent sales from an old MSRP or a reversed compare-at price", () => {
  assert.deepEqual(releasePrices([product().variants[0]!], [1000]), [700]);
  assert.deepEqual(releasePrices([{ ...product().variants[0]!, price: 9000, compare_at_price: 8000 }], [8000]), [9000]);
  assert.deepEqual(releasePrices([{ ...product().variants[0]!, price: 6500, compare_at_price: 8000 }], [5000, 8000]), [5000, 6500, 8000]);
});

test("master tags replace existing and mapping tags without guessing or merging them", () => {
  const before = empty();
  before.content.rene = { name: "Rene", tags: ["generic", "female"], kind: "model" };
  const tags = tagFile({ rene: ["survivor", "male"] });
  const plan = prepareUpdate(
    before,
    [source(product())],
    { "kds-rene": { category: "content", itemId: "rene", edition: "Sim" } },
    [],
    tags,
  );
  assert.deepEqual(plan.catalog.content.rene?.tags, ["male", "survivor"]);
  assert.deepEqual(before.content.rene.tags, ["generic", "female"]);
  assert.equal(prepareUpdate(plan.catalog, [], {}, [], tags).changes.length, 0);
  const mappings = {
    "kds-rene": { category: "content" as const, itemId: "new-rene", create: { name: "New Rene", kind: "model", tags: ["guessed"] } },
  };
  assert.throws(() => prepareUpdate(empty(), [source(product())], mappings, [], tagFile()), /Add reviewed tags.*new-rene/);
  assert.deepEqual(
    prepareUpdate(empty(), [source(product())], mappings, [], tagFile({ "new-rene": ["rene", "survivor"] })).catalog.content["new-rene"]
      ?.tags,
    ["rene", "survivor"],
  );
});

test("master tags reject missing items, mistaken IDs, duplicate tags and invalid spelling", () => {
  const catalog = empty();
  catalog.content.aya = { name: "Aya", tags: ["aya"] };
  assert.throws(() => applyTags(catalog, tagFile()), /Add reviewed tags.*aya/);
  assert.throws(() => applyTags(catalog, tagFile({ aya: ["aya"], typo: ["aya"] })), /Unknown master tag item IDs.*typo/);
  assert.throws(() => applyTags(catalog, tagFile({ aya: ["aya", "aya"] })), /duplicate master tags/);
  assert.throws(() => applyTags(catalog, tagFile({ aya: ["Female "] })), /Invalid.*master tags/);
  assert.throws(() => applyTags(catalog, { ...tagFile(), homebrew: { aya: ["aya"] } }), /Add reviewed tags.*content\/aya/);
});

test("the editor schema validates vocabulary and preserves author assignments", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-tag-schema-"));
  const root = join(workspace, "static/kdm-catalog");
  await mkdir(root, { recursive: true });
  await mkdir(catalogTemp(root), { recursive: true });
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const schema = tagSchema(["aya", "female"]);
  assert.ok(!JSON.stringify(schema).includes('"aya":'));
  await writeFile(join(catalogTemp(root), "kdm-tags.schema.json"), JSON.stringify(schema));
  const path = join(catalogTemp(root), "kdm-tags.json");
  await writeFile(path, JSON.stringify({ $schema: "./kdm-tags.schema.json", ...tagFile({ aya: ["female", "aya"] }) }));
  assert.deepEqual((await loadTags(root)).tags, tagFile({ aya: ["female", "aya"] }));
  await writeFile(path, JSON.stringify(tagFile({ "any-item-id": ["female"] })));
  assert.deepEqual((await loadTags(root)).tags, tagFile({ "any-item-id": ["female"] }));
  await writeFile(path, JSON.stringify(tagFile({ aya: ["femail"] })));
  await assert.rejects(loadTags(root), /Master tag errors/);
  await writeFile(path, JSON.stringify(tagFile({ aya: ["female", "female"] })));
  await assert.rejects(loadTags(root), /Master tag errors/);
});

test("tag edits invalidate a prepared review before catalog writes", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-stale-tags-"));
  const root = join(workspace, "static/kdm-catalog");
  await mkdir(root, { recursive: true });
  await mkdir(catalogTemp(root), { recursive: true });
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const catalog = empty();
  catalog.content.aya = { name: "Aya", kind: "model", tags: ["aya"] };
  const catalogText = JSON.stringify(catalog),
    schemaText = JSON.stringify(tagSchema(["aya", "female"]));
  const news = join(root, "news.json");
  await writeFile(join(root, "data.json"), catalogText);
  await writeFile(join(root, "data.schema.json"), "{}");
  await writeFile(news, "{}");
  await writeFile(join(catalogTemp(root), "kdm-tags.schema.json"), schemaText);
  await writeFile(join(catalogTemp(root), "kdm-tags.json"), JSON.stringify(tagFile({ aya: ["female"] })));
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  await assert.rejects(
    applyReview(
      {
        baselineHash: hash(catalogText),
        schemaHash: hash("{}"),
        newsHash: hash("{}"),
        tagsHash: hash(JSON.stringify(tagFile({ aya: ["aya"] }))),
        tagSchemaHash: hash(schemaText),
        changes: [],
        unresolved: [],
      },
      root,
      news,
    ),
    /Master tags changed/,
  );
  assert.equal(await readFile(join(root, "data.json"), "utf8"), catalogText);
});

test("applying reviewed tags works without local imports, mappings, or reports and persists alphabetical order", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-apply-tags-"));
  const root = join(workspace, "static/kdm-catalog");
  await mkdir(root, { recursive: true });
  await mkdir(catalogTemp(root), { recursive: true });
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const before = empty();
  before.content.aya = {
    name: "Aya",
    kind: "model",
    tags: ["aya"],
    editions: [
      {
        id: "plastic",
        label: "Plastic",
        releaseDate: "2019-01-01",
        prices: [3400],
        format: "physical",
        materials: ["Plastic"],
      },
    ],
  };
  before.content.neko = {
    name: "Neko",
    kind: "model",
    tags: ["neko"],
    editions: [
      {
        id: "plastic",
        label: "Plastic",
        releaseDate: "2020-01-01",
        prices: [2700],
        format: "physical",
        materials: ["Plastic"],
      },
    ],
  };
  const tags = tagFile({ aya: ["aya"], neko: ["neko", "death-high"] });
  const schema = await readFile("static/kdm-catalog/data.schema.json", "utf8");
  const inputs = {
    "data.json": JSON.stringify(before),
    "data.schema.json": schema,
    "kdm-tags.json": JSON.stringify(tags),
    "kdm-tags.schema.json": JSON.stringify(tagSchema(["aya", "neko", "death-high"])),
    "news.json": "{}",
  };
  for (const [path, text] of Object.entries(inputs)) await writeFile(fixturePath(root, path), text);
  const plan = prepareUpdate(before, [], {}, [], tags);
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  await applyReview(
    {
      baselineHash: hash(inputs["data.json"]),
      schemaHash: hash(schema),
      newsHash: hash("{}"),
      tagsHash: hash(inputs["kdm-tags.json"]),
      tagSchemaHash: hash(inputs["kdm-tags.schema.json"]),
      changes: plan.changes,
      unresolved: [],
    },
    root,
    join(root, "news.json"),
  );
  const applied = JSON.parse(await readFile(join(root, "data.json"), "utf8"));
  assert.deepEqual(Object.keys(applied.content), ["aya", "neko"]);
  assert.deepEqual(applied.content.neko, { ...before.content.neko, tags: tags.content.neko!.toSorted() });
  const master = JSON.parse(await readFile(join(catalogTemp(root), "kdm-tags.json"), "utf8"));
  assert.deepEqual(Object.keys(master.content), ["aya", "neko"]);
  assert.deepEqual(master.content.neko, tags.content.neko!.toSorted());
  const report = JSON.parse(await readFile(join(catalogTemp(root), "reports/kdm-merge-report.json"), "utf8"));
  const update = report.catalogUpdates[0];
  assert.deepEqual(
    update.changedItems,
    plan.changes.map(({ category, itemId }) => ({ category, itemId })),
  );
  assert.equal(update.changes, undefined, "The summary should not repeat full catalog snapshots");
  const archived = JSON.parse(gunzipSync(await readFile(join(catalogTemp(root), "reports", update.archive))).toString("utf8"));
  assert.deepEqual(archived.changes, plan.changes, "The complete review remains recoverable from its archive");
  assert.equal(archived.appliedAt, update.appliedAt);
});

test("a verified price replaces an estimate even when its amount is unchanged", () => {
  const catalog = empty();
  catalog.content.aya = { name: "Aya", tags: ["aya"], gameplay: true, editions: [{ label: "Sim", prices: [700], priceEstimated: true }] };
  const data = product({ handle: "kds-aya" });
  const plan = planUpdate(catalog, [source(data)], { [data.handle]: { category: "content", itemId: "aya", edition: "Sim" } }, []);
  assert.deepEqual(plan.catalog.content.aya?.editions?.[0]?.prices, [700]);
  assert.equal(plan.catalog.content.aya?.editions?.[0]?.priceEstimated, undefined);
  assert.equal(plan.changes.length, 1);
});

test("ambiguous character names require a mapping instead of merging separate sculpts", () => {
  const catalog = empty();
  catalog.content.resin = { name: "Percival (Resin)", tags: ["percival"], aliases: ["Percival"] };
  catalog.content.plastic = { name: "Percival (Plastic)", tags: ["percival"], aliases: ["Percival"], gameplay: true };
  const plan = planUpdate(catalog, [source(product({ title: "KDS - Percival", handle: "kds-percival" }))], {}, []);
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.unresolved[0]?.reason, "ambiguous");
});

test("collection product links resolve to direct listings, while collection indexes are rejected", () => {
  assert.equal(productUrl("/products/aya.json?variant=2"), "https://shop.kingdomdeath.com/products/aya");
  assert.equal(productUrl("/products/aya.js"), "https://shop.kingdomdeath.com/products/aya");
  assert.equal(productUrl("/products//products/griswaldan"), "https://shop.kingdomdeath.com/products/griswaldan");
  assert.equal(
    productUrl("https://shop.kingdomdeath.com/collections/new/products/aya?variant=2"),
    "https://shop.kingdomdeath.com/products/aya",
  );
  assert.throws(() => productUrl("https://shop.kingdomdeath.com/collections/new"));
  assert.throws(() => productUrl("https://shop.kingdomdeath.com.evil.example/products/aya"));
});

test("Shopify product JSON preserves metadata and converts decimal prices without inventing compare-at prices", () => {
  const raw = {
    id: 1,
    title: "Snow",
    handle: "snow",
    body_html: "<ul><li>Photoresin miniature</li></ul>",
    published_at: "2026-09-30T12:00:00Z",
    tags: "Beta, Snow",
    images: [{ src: "https://example.com/snow.png" }],
    variants: [{ id: 10, title: "First Run", requires_shipping: true, price: "70.00", compare_at_price: "", inventory_quantity: 100 }],
  };
  const item = shopProduct({ product: raw });
  assert.equal(item.description, raw.body_html);
  assert.equal(item.published_at, raw.published_at);
  assert.deepEqual(item.images, raw.images);
  assert.equal(item.tags, raw.tags);
  assert.equal(item.variants[0]?.price, 7000);
  assert.equal(item.variants[0]?.compare_at_price, null);
  assert.equal(releasePrices(item.variants)[0], 7000);
  assert.equal(
    shopProduct({ ...raw, variants: [{ ...raw.variants[0], price: "7.25", compare_at_price: "9.00" }] }).variants[0]?.price,
    725,
  );
  assert.equal(
    shopProduct({ ...raw, variants: [{ ...raw.variants[0], price: "7.25", compare_at_price: "9.00" }] }).variants[0]?.compare_at_price,
    900,
  );
  assert.equal(shopProduct(product(), "ajax").variants[0]?.price, 700);
  assert.throws(() => shopProduct({ ...raw, variants: [{ ...raw.variants[0], price: "" }] }), /Invalid shop price/);
  assert.throws(
    () => shopProduct({ ...raw, variants: [{ ...raw.variants[0], requires_shipping: undefined }] }),
    /Invalid shop product variant/,
  );
});

test("product requests use the Ajax endpoint once and offline reads can still use JSON caches", async (t) => {
  const cache = await mkdtemp(join(tmpdir(), "kdm-product-js-"));
  t.after(() => rm(cache, { recursive: true, force: true }));
  const raw = {
    ...product(),
    description: "<ul><li>Digital pattern</li></ul>",
    available: true,
    variants: [{ ...product().variants[0]!, available: true }],
  };
  const fetchMock = t.mock.method(globalThis, "fetch", async (url: Parameters<typeof fetch>[0]) => {
    assert.equal(url, "https://shop.kingdomdeath.com/products/kds-rene.js");
    return new Response(JSON.stringify(raw), { headers: { "Content-Type": "application/json" } });
  });
  const client = new ShopClient({ cache });
  const result = await client.product("/products/kds-rene.json");
  assert.equal(result.data.variants[0]?.price, 700);
  assert.equal(result.data.description, raw.description);
  assert.equal(result.data.available, true);
  assert.equal(result.data.variants[0]?.available, true);
  assert.equal((await client.product("/products/kds-rene")).data.variants[0]?.price, 700);
  assert.equal(fetchMock.mock.callCount(), 1);
  const legacy = { ...product({ handle: "legacy-rene" }), variants: [{ ...product().variants[0]!, price: "7.00" }] };
  const url = "https://shop.kingdomdeath.com/products/legacy-rene.json";
  await writeFile(
    join(cache, createHash("sha256").update(url).digest("hex") + ".json"),
    JSON.stringify({ url, checkedAt: new Date().toISOString(), data: { product: legacy } }),
  );
  const offline = new ShopClient({ cache, offline: true });
  assert.equal((await offline.product("/products/legacy-rene")).data.variants[0]?.price, 700);
  assert.equal((await offline.product("/products/kds-rene")).url, result.url);
  assert.equal(offline.requests.length, 0);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("shared URLs and false gameplay compact without losing different edition facts", () => {
  const item = {
    name: "Aya",
    tags: ["aya"],
    gameplay: true as const,
    editions: [
      { label: "First Run", url: "/products/aya?variant=1", gameplay: null, runSize: null, priceEstimated: true, prices: [700] },
      { label: "Encore", url: "/products/aya?variant=2", gameplay: false, runSize: 100, releaseWindow: "Q4 2026" },
    ],
  };
  normalizeItem(item as unknown as Catalog["content"][string]);
  assert.deepEqual(item, {
    name: "Aya",
    tags: ["aya"],
    gameplay: true,
    handle: "aya",
    editions: [
      { label: "First Run", gameplay: false, prices: [700], format: "physical", numbered: true },
      { label: "Encore", gameplay: false, runSize: 100, releaseWindow: "2026 Q4", format: "physical", numbered: true },
    ],
  });
  const snapshot = structuredClone(item);
  normalizeItem(item as unknown as Catalog["content"][string]);
  assert.deepEqual(item, snapshot);
});

test("an added digital edition preserves an inherited physical URL", () => {
  const catalog = empty();
  catalog.content.rene = {
    name: "Rene",
    tags: ["rene"],
    url: "/products/physical-rene",
    editions: [{ label: "First Run", materials: ["Photoresin"], prices: [3400] }],
  };
  const plan = planUpdate(
    catalog,
    [source(product())],
    { "kds-rene": { category: "content", itemId: "rene", edition: "Sim", gameplay: true } },
    [],
  );
  assert.equal(plan.catalog.content.rene?.url, undefined);
  assert.equal(plan.catalog.content.rene?.editions?.find((e) => e.label === "First Run")?.handle, "physical-rene");
  assert.equal(plan.catalog.content.rene?.editions?.find((e) => e.label === "Sim")?.handle, "kds-rene");
  assert.equal(plan.catalog.content.rene?.editions?.find((e) => e.label === "First Run")?.runSize, undefined);
});

test("catalog ordering keeps core and expansions first and alphabetizes other IDs regardless of family or date", () => {
  const catalog = empty();
  const item = (name: string, kind: string, tags: string[], r?: string) => ({
    name,
    kind,
    tags,
    ...(r ? { editions: [{ label: "Plastic", r }] } : {}),
  });
  catalog.content = {
    other: item("Other", "model", ["other"], "2000-01-01"),
    beta: item("Beta", "beta", ["pillar"], "2000-01-01"),
    late: item("A display name", "model", ["death-high"], "2010-01-01"),
    early: item("Z display name", "model", ["death-high"], "2020-01-01"),
    expansion: item("Expansion", "expansion", ["gorm"], "2015-01-01"),
    core: item("Core", "core", ["campaign"], "2015-01-01"),
    undated: { ...item("Undated", "model", ["other"]), announcements: ["1999-01-01"] },
  };
  catalog.bundles = {
    z: item("A bundle", "bundle", ["survivor"], "2000-01-01"),
    a: item("Z bundle", "bundle", ["survivor"], "2025-01-01"),
  };
  organizeCatalog(catalog);
  assert.deepEqual(Object.keys(catalog.content), ["core", "expansion", "beta", "early", "late", "other", "undated"]);
  assert.deepEqual(Object.keys(catalog.bundles), ["a", "z"]);
  const snapshot = JSON.stringify(catalog);
  organizeCatalog(catalog);
  assert.equal(JSON.stringify(catalog), snapshot);
});

test("catalog fields put edition identity and included items first, preserving alphabetical facts and arrays", () => {
  const item: Catalog["content"][string] = {
    tags: ["zeta", "alpha"],
    name: "Aya",
    editions: [{ prices: [700, 600], label: "Sim", id: "sim", available: true, format: "digital" }],
    includes: [{ parentEditionIds: ["sim"], editionId: "sim", item: "core", materials: ["Plastic"] }, "other"],
    kind: "model",
  };
  const tags = item.tags;
  const prices = item.editions![0]!.prices;

  orderItemFields(item);
  assert.deepEqual(Object.keys(item), ["editions", "includes", "kind", "name", "tags"]);
  assert.deepEqual(Object.keys(item.editions![0]!), ["id", "label", "available", "format", "prices"]);
  assert.deepEqual(Object.keys(item.includes![0]!), ["item", "editionId", "materials", "parentEditionIds"]);
  assert.equal(item.includes![1], "other");
  assert.equal(item.tags, tags);
  assert.equal(item.editions![0]!.prices, prices);
  assert.deepEqual(item.tags, ["zeta", "alpha"]);
  assert.deepEqual(item.editions![0]!.prices, [700, 600]);

  const snapshot = JSON.stringify(item);
  orderItemFields(item);
  assert.equal(JSON.stringify(item), snapshot);
});

test("only content expansions use physical release windows, other items use IDs, and Sim stays first", () => {
  const catalog = empty();
  const expansion = (name: string, releaseWindow: string) => ({
    name,
    kind: "expansion",
    tags: ["campaign"],
    editions: [
      { label: "Sim", simulator: true as const, releaseDate: "2020-01-01" },
      { label: "Box", releaseWindow },
    ],
  });
  catalog.content = {
    "expansion-frogdog": expansion("Frogdog Expansion", "July 2024"),
    "expansion-black-knight": expansion("Black Knight Expansion", "March 2024"),
    "expansion-gamblers-chest": expansion("Gambler's Chest Expansion", "August 2023"),
    "bust-late": { name: "Late Bust", tags: ["pinup"], editions: [{ label: "First Run", releaseDate: "2002-02-01" }] },
    "pinup-early": { name: "Pinup Early", tags: ["pinup"], editions: [{ label: "First Run", releaseDate: "2012-01-01" }] },
    "bust-early": { name: "Early Bust", tags: ["pinup"], editions: [{ label: "First Run", releaseDate: "2021-01-01" }] },
  };
  organizeCatalog(catalog);
  assert.deepEqual(Object.keys(catalog.content), [
    "expansion-gamblers-chest",
    "expansion-black-knight",
    "expansion-frogdog",
    "bust-early",
    "bust-late",
    "pinup-early",
  ]);
  assert.equal(catalog.content["expansion-black-knight"]?.editions?.[0]?.label, "Sim");
  const tags = tagFile(
    Object.fromEntries(
      Object.entries(catalog.content)
        .reverse()
        .map(([id, item]) => [id, item.tags]),
    ),
  );
  const ordered = organizeTags(catalog, tags);
  assert.deepEqual(Object.keys(ordered.content), Object.keys(catalog.content));
  assert.deepEqual(ordered.content["bust-late"], tags.content["bust-late"]);
});

test("family IDs distinguish boxes, sculpt formats, singular Pinups and confirmed named families", () => {
  for (const [id, name, kind, tags, expected] of [
    [
      "halloween-special-pinup-twilight-knight",
      "Halloween Special Pinup Twilight Knight",
      "model",
      ["pinup"],
      "pinup-halloween-special-twilight-knight",
    ],
    ["first-hero-bust-male", "First Hero Bust - Male", "model", ["bust"], "bust-first-hero-male"],
    ["pinup-lioness-bust", "Pinup Lioness Bust", "model", ["pinup", "bust"], "bust-pinup-lioness"],
    ["pinup-butcher-painters-scale", "Pinup Butcher - Painter's Scale", "model", ["pinup"], "painters-scale-pinup-butcher"],
    ["set-paladin-painters-scale", "Paladin - Painter's Scale", "set", ["painters-scale"], "set-painters-scale-paladin"],
    ["set-pinups-of-death-i", "Pinups of Death I", "set", ["pinup"], "set-pinups-of-death-1"],
    ["set-survivors-of-death-iii", "Survivors of Death III", "set", ["survivor"], "set-survivors-of-death-3"],
    ["set-halloween-survivors-series-ii", "Halloween Survivors - Series II", "set", ["survivor"], "set-halloween-survivors-series-2"],
    ["naked-pinups-of-death-ii-bundle", "Naked Pinups of Death II Bundle", "bundle", ["naked"], "naked-pinups-of-death-2-bundle"],
    ["death-high-satan-x", "Death High - Satan X", "model", ["satan"], "death-high-satan-x"],
    [
      "set-vignette-of-death-white-gigalion",
      "Vignette of Death: White Gigalion",
      "vignette",
      ["monster-white-lion"],
      "vignette-of-death-white-gigalion",
    ],
    [
      "screaming-nukealope",
      "Vignette of Death: Screaming Nukealope",
      "vignette",
      ["monster-screaming-nukealope"],
      "vignette-of-death-screaming-nukealope",
    ],
    ["lantern-armor-aya", "Legendary Character - Lantern Armor Aya", "model", ["painters-scale"], "legendary-character-lantern-armor-aya"],
    ["champion-weaponsmith-wanderer", "Wanderer - Champion Weaponsmith", "model", ["survivor"], "wanderer-champion-weaponsmith"],
    [
      "experiment-of-death-pvc-wet-nurse-and-pinup-twilight-knight",
      "Experiment of Death (PVC Wet Nurse & Pinup Twilight Knight)",
      "model",
      ["pinup"],
      "experiment-of-death-pvc-wet-nurse-and-pinup-twilight-knight",
    ],
  ] as const) {
    const item = { name, kind, tags: [...tags] };
    assert.equal(prefixedId(id, item), expected);
    assert.equal(prefixedId(expected, item), expected);
  }
  assert.equal(prefixedId("pillar-fade", { name: "Pillar - Fade (Updated Display Name)", kind: "model", tags: ["fade"] }), "pillar-fade");
  assert.equal(
    prefixedId("painters-scale-death-high-life-model-simone", {
      name: "Death High - Simone (Updated Display Name) - Painter's Scale",
      kind: "model",
      tags: ["simone"],
    }),
    "painters-scale-death-high-life-model-simone",
  );
  assert.equal(
    prefixedId("black-friday-death-dice", {
      name: "Black Friday Death Dice",
      kind: "accessory",
      accessoryType: "dice",
      tags: ["black-friday"],
    }),
    "dice-black-friday",
  );
  assert.equal(
    prefixedId("dice-black-friday", { name: "Black Friday Death Dice", kind: "accessory", accessoryType: "dice", tags: ["black-friday"] }),
    "dice-black-friday",
  );
  assert.equal(
    prefixedId("butcher-shirt", { name: "Butcher Shirt", kind: "accessory", accessoryType: "shirt", tags: ["monster-butcher"] }),
    "shirt-butcher",
  );
  assert.equal(
    prefixedId("frozen-survivor-hellebore-beta", { name: "Frozen Survivor - Hellebore (Beta)", kind: "beta", tags: ["frozen-survivor"] }),
    "frozen-survivor-hellebore",
  );
  assert.equal(
    prefixedId("beta-frozen-survivor-hellebore", { name: "Frozen Survivor - Hellebore (Beta)", kind: "beta", tags: ["frozen-survivor"] }),
    "frozen-survivor-hellebore",
  );
});

test("applying a review persists ordering even when no item facts changed", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-order-only-"));
  const root = join(workspace, "static/kdm-catalog");
  await mkdir(root, { recursive: true });
  await mkdir(catalogTemp(root), { recursive: true });
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await mkdir(join(catalogTemp(root), "imports"));
  await mkdir(join(catalogTemp(root), "reports"));
  const before = empty();
  before.content.neko = {
    name: "Neko",
    kind: "model",
    tags: ["death-high", "neko"],
    editions: [
      {
        id: "plastic",
        label: "Plastic",
        releaseDate: "2020-01-01",
        format: "physical",
        materials: ["Plastic"],
      },
    ],
  };
  before.content.aya = {
    name: "Aya",
    kind: "model",
    tags: ["aya"],
    editions: [
      {
        id: "plastic",
        label: "Plastic",
        releaseDate: "2019-01-01",
        format: "physical",
        materials: ["Plastic"],
      },
    ],
  };
  const tags = tagFile({ aya: ["aya"], neko: ["neko", "death-high"] });
  const schema = await readFile("static/kdm-catalog/data.schema.json", "utf8");
  const files = {
    "data.json": JSON.stringify(before),
    "data.schema.json": schema,
    "kdm-tags.json": JSON.stringify(tags),
    "kdm-tags.schema.json": JSON.stringify(tagSchema(["aya", "neko", "death-high"])),
    "news.json": "{}",
    "imports/kdm-import-records.json": JSON.stringify({ records: [] }),
    "imports/kdm-import-records.schema.json": "{}",
    "reports/kdm-merge-report.json": JSON.stringify({ validation: {} }),
  };
  for (const [path, text] of Object.entries(files)) await writeFile(fixturePath(root, path), text);
  const plan = prepareUpdate(before, [], {}, [], tags);
  assert.equal(plan.changes.length, 0);
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  await applyReview(
    {
      baselineHash: hash(files["data.json"]),
      schemaHash: hash(schema),
      newsHash: hash("{}"),
      tagsHash: hash(files["kdm-tags.json"]),
      tagSchemaHash: hash(files["kdm-tags.schema.json"]),
      changes: [],
      unresolved: [],
    },
    root,
    join(root, "news.json"),
  );
  const after = JSON.parse(await readFile(join(root, "data.json"), "utf8"));
  assert.deepEqual(after, before);
  assert.deepEqual(Object.keys(after.content), ["aya", "neko"]);
  const master = JSON.parse(await readFile(join(catalogTemp(root), "kdm-tags.json"), "utf8"));
  assert.deepEqual(Object.keys(master.content), Object.keys(after.content));
});

test("accessories and homebrew sort alphabetically by ID without changing item facts", () => {
  const catalog = empty();
  catalog.accessories = {
    "late-shirt": { name: "Late Shirt", accessoryType: "shirt", tags: ["late"], releaseYear: 2024 },
    "unknown-dice": { name: "Unknown Dice", accessoryType: "dice", tags: ["unknown"], announcements: ["2000-01-01"] },
    "other-accessory": { name: "Other Accessory", accessoryType: "other", tags: ["other"], releaseYear: 2010 },
    "early-shirt": { name: "Early Shirt", accessoryType: "shirt", tags: ["early"], releaseYear: 2016 },
    "dated-dice": { name: "Dated Dice", accessoryType: "dice", tags: ["dated"], releaseYear: 2020 },
  };
  catalog.homebrew = {
    "craft-of-death-terrain": { name: "Terrain", kind: "terrain", tags: ["craft-of-death"] },
    "revampedgame-terrain": { name: "Terrain", kind: "terrain", tags: ["revampedgame"], releaseYear: 2010 },
    "revampedgame-z-model": { name: "Z Model", kind: "model", tags: ["revampedgame"] },
    "craft-of-death-base": { name: "Base", kind: "base", tags: ["craft-of-death"] },
    "expansion-revampedgame-rosine": { name: "Rosine", kind: "expansion", tags: ["revampedgame"] },
    "revampedgame-a-model": { name: "A Model", kind: "model", tags: ["revampedgame"] },
    "revampedgame-dated-model": { name: "Dated Model", kind: "model", tags: ["revampedgame"], releaseYear: 2022 },
    "raitenjuro-perfect-lantern": { name: "Perfect Lantern", kind: "terrain", tags: ["raitenjuro"] },
  };
  const before = structuredClone(catalog);
  organizeCatalog(catalog);
  assert.deepEqual(Object.keys(catalog.accessories), ["dated-dice", "early-shirt", "late-shirt", "other-accessory", "unknown-dice"]);
  assert.deepEqual(Object.keys(catalog.homebrew), [
    "craft-of-death-base",
    "craft-of-death-terrain",
    "expansion-revampedgame-rosine",
    "raitenjuro-perfect-lantern",
    "revampedgame-a-model",
    "revampedgame-dated-model",
    "revampedgame-terrain",
    "revampedgame-z-model",
  ]);
  assert.deepEqual(catalog, before);
  const ordered = JSON.stringify(catalog);
  organizeCatalog(catalog);
  assert.equal(JSON.stringify(catalog), ordered);
});

test("sets, vignettes, armor kits and naked models sort alphabetically by ID in the catalog and master tags", () => {
  const catalog = empty();
  catalog.content = {
    "armor-kit-late": {
      name: "Late Armor Kit",
      kind: "armor-kit",
      tags: ["armor"],
      editions: [{ label: "Plastic", releaseDate: "2020-01-01" }],
    },
    "pinup-naked-late": {
      name: "Naked Late Pinup",
      kind: "naked",
      tags: ["naked", "pinup"],
      editions: [{ label: "Plastic", releaseDate: "2022-01-01" }],
    },
    "set-death-high-late": {
      name: "Death High - Late Set",
      kind: "set",
      tags: ["death-high"],
      editions: [{ label: "Plastic", releaseDate: "2023-01-01" }],
    },
    "armor-kit-early": {
      name: "Early Armor Kit",
      kind: "armor-kit",
      tags: ["armor"],
      editions: [{ label: "Plastic", releaseDate: "2015-01-01" }],
    },
    "set-pinups-early": { name: "Pinups Early", kind: "set", tags: ["pinup"], editions: [{ label: "Plastic", releaseDate: "2014-01-01" }] },
    "naked-early": { name: "Naked Early", kind: "naked", tags: ["naked"], editions: [{ label: "Plastic", releaseDate: "2016-01-01" }] },
    "vignette-of-death-white-gigalion": {
      name: "Vignette of Death: White Gigalion",
      kind: "vignette",
      tags: ["monster-white-lion"],
      editions: [{ label: "Plastic", releaseDate: "2019-08-16" }],
    },
    "vignette-of-death-screaming-nukealope": {
      name: "Vignette of Death: Screaming Nukealope",
      kind: "vignette",
      tags: ["monster-screaming-nukealope"],
      editions: [{ label: "Box", releaseDate: "2025-10-31" }],
    },
  };
  const assignments = tagFile(Object.fromEntries(Object.entries(catalog.content).map(([id, item]) => [id, item.tags])));
  organizeCatalog(catalog);
  const expected = [
    "armor-kit-early",
    "armor-kit-late",
    "naked-early",
    "pinup-naked-late",
    "set-death-high-late",
    "set-pinups-early",
    "vignette-of-death-screaming-nukealope",
    "vignette-of-death-white-gigalion",
  ];
  assert.deepEqual(Object.keys(catalog.content), expected);
  const master = organizeTags(catalog, assignments);
  assert.deepEqual(Object.keys(master.content), expected);
  assert.deepEqual(master, assignments);
  assert.equal(prefixedId("set-lantern-armor-kit", { name: "Lantern Armor Kit", kind: "armor-kit", tags: ["armor"] }), "armor-kit-lantern");
  assert.equal(prefixedId("set-naked-survivor-kit", { name: "Naked Survivor Kit", kind: "naked", tags: ["naked"] }), "naked-survivor-kit");
});

test("the schema requires descriptive tags and rejects obsolete nulls and price flags", async () => {
  for (const item of [
    { name: "Aya", kind: "model" },
    { name: "Aya", kind: "model", tags: [] },
    { name: "Aya", kind: "model", tags: ["aya"], gameplay: false },
    {
      name: "Aya",
      kind: "model",
      tags: ["aya"],
      editions: [{ id: "first-run", label: "First Run", materials: ["Resin"], runSize: null }],
    },
    { name: "Aya", kind: "model", tags: ["aya"], editions: [{ id: "sim", label: "Sim", gameplay: null }] },
    {
      name: "Aya",
      kind: "model",
      tags: ["aya"],
      editions: [{ id: "sim", label: "Sim", prices: [700], priceEstimated: true }],
    },
    { name: "Aya", kind: "model", tags: ["aya"], alt: "Old Aya" },
    {
      name: "Aya",
      kind: "model",
      tags: ["aya"],
      editions: [{ id: "plastic", label: "Plastic", gameplayContent: "Gear" }],
    },
  ]) {
    const catalog = empty();
    catalog.content.aya = item as Catalog["content"][string];
    await assert.rejects(validateCatalog(catalog), /Catalog schema errors/);
  }
  const catalog = empty();
  catalog.accessories["dice-invalid-price"] = {
    name: "Accessory",
    kind: "accessory",
    accessoryType: "dice",
    tags: ["female"],
    price: null,
  } as unknown as Catalog["accessories"][string];
  await assert.rejects(validateCatalog(catalog), /Catalog schema errors/);
});

test("edition IDs are required and unique within each item", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-edition-ids-"));
  const root = join(workspace, "static/kdm-catalog");
  await mkdir(root, { recursive: true });
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const schemaPath = join(root, "data.schema.json");
  await writeFile(schemaPath, await readFile("static/kdm-catalog/data.schema.json", "utf8"));
  const catalog = empty();
  catalog.content.aya = {
    name: "Aya",
    kind: "model",
    tags: ["aya"],
    editions: [{ label: "First Run", format: "physical", numbered: true }],
  };
  await assert.rejects(validateCatalog(catalog, schemaPath), /must have required property 'id'/);
  catalog.content.aya.editions![0]!.id = "first-run";
  catalog.content.neko = {
    name: "Neko",
    kind: "model",
    tags: ["neko"],
    editions: [{ id: "first-run", label: "First Run", format: "physical", numbered: true }],
  };
  assert.equal((await validateCatalog(catalog, schemaPath)).editions, 2, "the same edition ID can belong to different items");
  catalog.content.aya.editions!.push({ id: "first-run", label: "Encore", format: "physical" });
  await assert.rejects(validateCatalog(catalog, schemaPath), /Duplicate edition ID/);
});

test("shop updates preserve permanent IDs and reject a new release that would reuse one", () => {
  const catalog = empty();
  catalog.content.rene = {
    name: "Rene",
    tags: ["rene"],
    editions: [{ id: "first-run", label: "Encore", format: "physical" }],
  };
  const listing = product({
    handle: "rene",
    title: "Rene",
    variants: [{ ...product().variants[0]!, title: "Encore", requires_shipping: true }],
  });
  const updated = planUpdate(catalog, [source(listing)], { rene: { category: "content", itemId: "rene", edition: "Encore" } }, []);
  assert.equal(updated.catalog.content.rene!.editions![0]!.id, "first-run");
  assert.equal(updated.catalog.content.rene!.editions![0]!.label, "Encore");
  listing.variants[0]!.title = "First Run";
  assert.throws(
    () => planUpdate(catalog, [source(listing)], { rene: { category: "content", itemId: "rene", edition: "First Run" } }, []),
    /Duplicate edition ID: first-run; review/,
  );
  assert.equal(catalog.content.rene!.editions!.length, 1);
});

test("schema checks ID prefixes and field types without conditional branches", async () => {
  const catalog = empty();
  catalog.content.aya = { name: "Set", kind: "set", tags: ["survivor"] };
  await assert.rejects(validateCatalog(catalog), /Catalog schema errors/);
  delete catalog.content.aya;
  catalog.accessories["old-dice-id"] = { name: "Dice", kind: "accessory", accessoryType: "dice", tags: ["dice"] };
  await assert.rejects(validateCatalog(catalog), /Catalog schema errors/);
  const schema = JSON.parse(await readFile("static/kdm-catalog/data.schema.json", "utf8"));
  assert.ok(!/"(?:if|then|else|allOf)"\s*:/.test(JSON.stringify(schema)));
  const { Ajv2020 } = await import("ajv/dist/2020.js");
  const check = new Ajv2020({ strict: false }).compile(schema);
  const simple = empty();
  simple.content.aya = {
    name: "Aya",
    kind: "model",
    tags: ["model"],
    editions: [{ id: "first-run", label: "First Run", format: "physical" }],
  };
  assert.equal(check(simple), true, "Run materials and redundant classification tags are no longer schema conditions");
  simple.content.aya.editions![0]!.id = "First Run";
  assert.equal(check(simple), false, "Explicit edition IDs use lowercase kebab-case");
  simple.content.aya.editions![0]!.id = "item";
  assert.equal(check(simple), false, "Synthetic item IDs are reserved for items without explicit editions");
  simple.content.aya = { name: "Aya", kind: "set", tags: ["aya"] };
  assert.equal(check(simple), false, "A set still requires its ID prefix");
  simple.content = {
    "set-aya": { name: "Aya", kind: "set", tags: ["aya"], editions: [{ label: "Plastic", prices: ["bad"] }] },
  } as unknown as Catalog["content"];
  assert.equal(check(simple), false, "Pattern-matched items still receive the shared field validation");
});

test("normalization moves legacy aliases and gameplay details to items without losing release distinctions", () => {
  const shared: Catalog["content"][string] = {
    name: "Pillar - Grimmory",
    alt: "Pillar, Grimmory",
    tags: ["grimmory"],
    editions: [
      { label: "First Run", gameplayContent: "Beta Rules & Gear" },
      { label: "Encore", gameplayContent: "Beta Rules & Gear" },
    ],
  };
  normalizeItem(shared);
  assert.equal(shared.alt, undefined);
  assert.equal(shared.aliases, undefined);
  assert.equal(shared.gameplayContent, "Beta Rules & Gear");
  assert.ok(shared.editions?.every((edition) => !Object.hasOwn(edition, "gameplayContent")));
  const varied: Catalog["content"][string] = {
    name: "Aya",
    alt: "Lantern Aya",
    aliases: ["Aya the Survivor"],
    tags: ["aya"],
    gameplayContent: "Shared content",
    editions: [
      { label: "First Run", gameplayContent: "Beta gear" },
      { label: "Encore", gameplayContent: "Beta gear" },
      { label: "Plastic", gameplayContent: "Final gear" },
    ],
  };
  normalizeItem(varied);
  assert.deepEqual(varied.aliases, ["Aya the Survivor", "Lantern Aya"]);
  assert.equal(varied.gameplayContent, "Shared content\n\nFirst Run, Encore: Beta gear\n\nPlastic: Final gear");
  const once = structuredClone(varied);
  normalizeItem(varied);
  assert.deepEqual(varied, once);
});

test("a box contents listing does not manufacture separate catalog items", () => {
  const before = empty();
  before.content["set-survivors-of-death-3"] = {
    name: "Survivors of Death III",
    kind: "set",
    tags: ["survivor"],
    gameplay: true,
    editions: [{ label: "Plastic", prices: [7700] }],
  };
  const data = product({
    handle: "survivors-of-death-iii",
    description: "<ul><li>Lyra miniature</li><li>Melody miniature</li><li>Harmony miniature</li><li>Sage miniature</li></ul>",
    variants: [{ ...product().variants[0]!, requires_shipping: true, price: 7700 }],
  });
  const plan = planUpdate(
    before,
    [source(data)],
    { [data.handle]: { category: "content", itemId: "set-survivors-of-death-3", edition: "Plastic" } },
    [],
  );
  assert.deepEqual(Object.keys(plan.catalog.content), ["set-survivors-of-death-3"]);
  assert.equal(plan.catalog.content["set-survivors-of-death-3"]?.includes, undefined);
  assert.equal(plan.sources[0]?.contents.length, 4);
});

test("standalone art prints are excluded while miniature contents mentioning prints stay eligible", () => {
  assert.ok(productExclusion("8-5-x-11-september-2026-art-prints"));
  const before = empty();
  const print = product({
    handle: "fine-art-prints",
    title: "Fine Art Prints",
    variants: [{ ...product().variants[0]!, requires_shipping: true, price: 3000 }],
  });
  const excluded = planUpdate(before, [source(print)], {}, []);
  assert.equal(excluded.changes.length, 0);
  assert.equal(excluded.unresolved.length, 0);
  assert.equal(excluded.excluded.length, 1);
  before.content.aya = { name: "Aya", kind: "model", tags: ["aya"] };
  const miniature = product({
    handle: "aya-painters-scale",
    title: "Aya - Painter's Scale",
    description: "<ul><li>Photoresin miniature</li><li>Art print</li></ul>",
    variants: [{ ...product().variants[0]!, requires_shipping: true, price: 7000 }],
  });
  const included = planUpdate(
    before,
    [source(miniature)],
    { [miniature.handle]: { category: "content", itemId: "aya", edition: "First Run" } },
    [],
  );
  assert.equal(included.excluded.length, 0);
  assert.equal(included.catalog.content.aya?.editions?.[0]?.prices?.[0], 7000);
});

test("temporary preorder links stay in announcement evidence without replacing edition URLs", () => {
  const catalog = empty();
  catalog.content.core = {
    name: "Monster",
    tags: ["campaign"],
    gameplay: true,
    editions: [{ label: "1.6", url: "/products/kingdom-death-monster-1-6" }],
  };
  const data = product({
    handle: "preorder-kingdom-death-monster-1-6-reprint",
    variants: [{ ...product().variants[0]!, requires_shipping: true, price: 44400 }],
  });
  const plan = planUpdate(
    catalog,
    [source(data)],
    { [data.handle]: { category: "content", itemId: "core", edition: "1.6", replaceUrl: true } },
    [
      {
        date: "2026-02-27",
        shopUrl: "https://shop.kingdomdeath.com/products/" + data.handle,
        postUrl: "https://kingdomdeath.com/news/old",
        itemName: "Monster (Preorder)",
      },
    ],
  );
  assert.equal(plan.catalog.content.core?.handle, "kingdom-death-monster-1-6");
  assert.deepEqual(plan.catalog.content.core?.announcements, ["2026-02-27"]);
});

test("offline reads reuse source evidence and aborted throttling never sends a request", async (t) => {
  const cache = await mkdtemp(join(tmpdir(), "kdm-shop-test-"));
  t.after(() => rm(cache, { recursive: true, force: true }));
  const url = "https://shop.kingdomdeath.com/products/kds-rene.js";
  const path = join(cache, createHash("sha256").update(url).digest("hex") + ".json");
  await writeFile(path, JSON.stringify(source(product())));
  const offline = new ShopClient({ cache, offline: true });
  assert.equal((await offline.get(url)).checkedAt, "2026-10-01T00:00:00Z");
  assert.equal(offline.requests.length, 0);
  assert.throws(() => new ShopClient({ delay: 2 }));
  await writeFile(join(cache, "last-request.json"), JSON.stringify({ startedAt: Date.now() }));
  const controller = new AbortController();
  controller.abort();
  const client = new ShopClient({ cache, refresh: true, signal: controller.signal });
  await assert.rejects(client.get(url), /abort/i);
  assert.equal(client.requests.length, 0);
});

test("applying a stale review cannot overwrite newer catalog edits", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-review-test-"));
  const root = join(workspace, "static/kdm-catalog");
  await mkdir(root, { recursive: true });
  await mkdir(catalogTemp(root), { recursive: true });
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await mkdir(join(catalogTemp(root), "reports"));
  const path = join(root, "data.json");
  await writeFile(path, JSON.stringify(empty()));
  const baselineHash = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  await writeFile(path, JSON.stringify({ ...empty(), content: { newer: { name: "Newer", gameplay: false } } }));
  await assert.rejects(
    applyReview({ baselineHash, schemaHash: "unused", newsHash: "unused", changes: [], unresolved: [] }, root, "unused"),
    /Catalog changed/,
  );
  assert.ok((await readFile(path, "utf8")).includes("Newer"));
});

test("concurrent shop clients share cached results and refuse a second process lock", async (t) => {
  const cache = await mkdtemp(join(tmpdir(), "kdm-shop-queue-test-"));
  t.after(() => rm(cache, { recursive: true, force: true }));
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(JSON.stringify(product()), { headers: { "Content-Type": "application/json" } }),
  );
  const url = "https://shop.kingdomdeath.com/products/kds-rene.js";
  const first = new ShopClient({ cache });
  const second = new ShopClient({ cache });
  const responses = await Promise.all([first.get(url), second.get(url)]);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(responses[0], responses[1]);
  await writeFile(join(cache, "request.lock"), JSON.stringify({ pid: 123, acquiredAt: new Date().toISOString() }));
  await assert.rejects(new ShopClient({ cache, refresh: true }).get(url), /Another shop updater/);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("unavailable shop listings are cached so reruns do not repeat the request", async (t) => {
  const cache = await mkdtemp(join(tmpdir(), "kdm-shop-unavailable-test-"));
  t.after(() => rm(cache, { recursive: true, force: true }));
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("Missing", { status: 404 }));
  const url = "https://shop.kingdomdeath.com/products/seasonal.js";
  await assert.rejects(new ShopClient({ cache }).get(url), (error) => error instanceof ShopError && error.status === 404 && !error.cached);
  await assert.rejects(new ShopClient({ cache }).get(url), (error) => error instanceof ShopError && error.status === 404 && error.cached);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("included-only items retain parent references and reviewed tags across categories", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "kdm-included-only-"));
  const root = join(workspace, "static/kdm-catalog");
  await mkdir(root, { recursive: true });
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const schemaPath = join(root, "data.schema.json");
  await writeFile(schemaPath, await readFile("static/kdm-catalog/data.schema.json", "utf8"));
  const catalog = empty();
  catalog.content["set-example"] = {
    name: "Example Box",
    kind: "set",
    tags: ["generic"],
    editions: [{ id: "plastic", label: "Plastic", format: "physical", materials: ["Plastic"] }],
    includes: [{ item: "joe", editionId: "plastic" }],
  };
  catalog["included-only"].joe = {
    name: "Joe",
    kind: "model",
    tags: ["generic"],
    editions: [{ id: "plastic", label: "Plastic", format: "physical", materials: ["Plastic"], standalone: false }],
  };
  organizeCatalog(catalog);
  assert.equal((await validateCatalog(catalog, schemaPath)).items, 2);
  const tags = tagFile({ "set-example": ["generic"] });
  tags["included-only"].joe = ["generic"];
  assert.deepEqual(organizeTags(catalog, tags)["included-only"].joe, ["generic"]);
  applyTags(catalog, tags);
  delete catalog["included-only"].joe.editions![0]!.standalone;
  await assert.rejects(validateCatalog(catalog, schemaPath), /Included-only item has a standalone or unconfirmed edition/);
});

test("handles resolve shared and edition-specific listings while external homebrew remains available", () => {
  const item = { name: "Model", tags: ["model"], handle: "shared", editions: [{ label: "First Run" }, { label: "Encore" }] };
  assert.equal(catalogListing(item, item.editions[0]), "https://shop.kingdomdeath.com/products/shared");
  const split = { name: "Model", tags: ["model"], editions: [{ label: "Resin", handle: "resin" }, { label: "Plastic" }] };
  assert.equal(catalogListing(split, split.editions[0]), "https://shop.kingdomdeath.com/products/resin");
  assert.equal(catalogListing(split, split.editions[1]), undefined);
  const catalog = empty();
  catalog.homebrew.example = {
    name: "Files",
    tags: ["homebrew"],
    url: "https://ko-fi.com/s/example",
    editions: [{ label: "3D Files", available: true }],
  };
  availabilityFromUrls(catalog, []);
  assert.equal(catalog.homebrew.example.editions![0]!.available, true);
  assert.equal(catalogListing(catalog.homebrew.example), "https://ko-fi.com/s/example");
});

test("a curated handle replacement keeps old cached listings mapped to the same edition", () => {
  const catalog = empty();
  const id = "sim";
  catalog.content.rene = { name: "Rene", tags: ["rene"], handle: "old-rene", editions: [{ id, label: "Sim", prices: [700] }] };
  const mappings = {
    "old-rene": { category: "content" as const, itemId: "rene", edition: "Sim" },
    "kds-rene": { category: "content" as const, itemId: "rene", edition: "Sim", replaceUrl: true },
  };
  const updated = planUpdate(catalog, [source(product())], mappings, []).catalog;
  assert.equal(updated.content.rene!.handle, "kds-rene");
  assert.equal(updated.content.rene!.editions![0]!.id, id);
  const historical = planUpdate(updated, [source(product({ handle: "old-rene" }))], mappings, []);
  assert.equal(historical.catalog.content.rene!.handle, "kds-rene");
  assert.equal(historical.catalog.content.rene!.editions!.length, 1);
  assert.equal(historical.catalog.content.rene!.editions![0]!.id, id);
});

test("comic availability matches individual artist covers on a shared handle", () => {
  const catalog = empty();
  catalog.accessories.phobia = {
    name: "Phobia",
    tags: ["phobia"],
    handle: "phobia",
    editions: [{ label: "Pawel Zdanowski" }, { label: "Ein Lee" }, { label: "Lokman Lam" }],
  };
  const listing = product({
    handle: "phobia",
    variants: [
      { ...product().variants[0]!, id: 1, title: "Original Cover", requires_shipping: true, available: false },
      { ...product().variants[0]!, id: 2, title: "Ein Lee variant cover", requires_shipping: true, available: true },
      { ...product().variants[0]!, id: 3, title: "Lokman Lam variant cover", requires_shipping: true, available: false },
    ],
  });
  const result = availabilityFromUrls(catalog, [listing]);
  assert.equal(result.unmatched.length, 0);
  assert.deepEqual(
    catalog.accessories.phobia.editions!.map((e) => e.available),
    [undefined, true, undefined],
  );
});

test("catalog tags use global item popularity while master tags remain alphabetical", () => {
  const catalog = empty();
  catalog.content.aya = { name: "Aya", tags: ["aya"] };
  catalog.content.rene = { name: "Rene", tags: ["rene"] };
  catalog.accessories.example = { name: "Example", tags: ["accessory"] };
  const tags = tagFile({ aya: ["z-common", "a-rare", "female"], rene: ["z-common", "female"] });
  tags.accessories.example = ["z-common", "accessory"];
  applyTags(catalog, tags);
  assert.deepEqual(catalog.content.aya.tags, ["z-common", "female", "a-rare"]);
  assert.deepEqual(catalog.accessories.example.tags, ["z-common", "accessory"]);
  const master = organizeTags(catalog, tags);
  assert.deepEqual(master.content.aya, ["a-rare", "female", "z-common"]);
  assert.deepEqual(tags.content.aya, ["z-common", "a-rare", "female"]);
});

test("King's Coin prize stays unavailable despite Shopify stock availability", () => {
  const catalog = empty();
  catalog.accessories["kings-coins"] = {
    name: "King's Coins",
    tags: ["coins"],
    editions: [
      { label: "Original", handle: "kings-coins" },
      { label: "Prize", handle: "kings-coin-prize", available: true },
    ],
  };
  const listings = ["kings-coins", "kings-coin-prize"].map((handle) =>
    product({ handle, variants: [{ ...product().variants[0]!, title: "HQ Warehouse (USA)", requires_shipping: true, available: true }] }),
  );
  const result = availabilityFromUrls(catalog, listings);
  assert.equal(catalog.accessories["kings-coins"]!.editions![0]!.available, true);
  assert.equal(catalog.accessories["kings-coins"]!.editions![1]!.available, undefined);
  assert.equal(result.available, 1);
  assert.equal(result.changed, 2);
  assert.equal(availabilityFromUrls(catalog, listings).changed, 0);
});
