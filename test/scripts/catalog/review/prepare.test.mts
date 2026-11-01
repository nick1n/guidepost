import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { prepareUpdate, summarizeReview } from "#scripts/catalog/review/prepare.mts";
import { applyReview, type Review } from "#scripts/catalog/review/apply.mts";
import { parseReview } from "#scripts/catalog/review/schema.mts";
import { itemDifferences } from "#scripts/catalog/review/details.mts";
import { shopProduct } from "#scripts/catalog/shop.mts";
import type { Evidence, Item } from "#scripts/catalog/types.mts";

vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
const actualFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
const roots: string[] = [];
afterEach(async () => {
  vi.mocked(rename).mockReset().mockImplementation(actualFs.rename);
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const newsUrl = "https://kingdomdeath.com/news";
const shopUrl = "https://shop.kingdomdeath.com/products/";
const html = (data: unknown) => `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { data } } })}</script>`;
const product = (handle = "example", digital = false) => ({
  id: 1,
  title: handle === "example" ? "Example" : handle,
  handle,
  body_html: "",
  variants: [{ id: 1, title: "First Run", price: "12.50", compare_at_price: "20.00", requires_shipping: !digital, available: true }],
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "kdm-maintenance-"));
  roots.push(root);
  const catalog = join(root, "static/kdm/catalog");
  const dataRoot = join(root, "scripts/catalog/data");
  const news = join(root, "news");
  await mkdir(catalog, { recursive: true });
  await mkdir(dataRoot, { recursive: true });
  const data = {
    content: {
      example: {
        name: "Example",
        handle: "example",
        tags: ["model"],
        editions: [{ id: "first-run", label: "First Run", releaseDate: "2020-01-01" }],
      },
    },
    "included-only": {},
    accessories: {},
    bundles: {},
    homebrew: {},
  };
  const original = JSON.stringify(data);
  await writeFile(join(catalog, "data.json"), original);
  await writeFile(join(catalog, "data.schema.json"), await readFile("static/kdm/catalog/data.schema.json", "utf8"));
  const imports = join(dataRoot, "news-imports.json");
  await writeFile(imports, "{}");
  const missing: string[] = [];
  const pages: string[] = [];
  const client = {
    async get(url: string) {
      pages.push(url);
      return { url, checkedAt: "2026-10-01T00:00:00Z", data: { products: url.endsWith("page=1") ? [product()] : [] } };
    },
    async product(url: string): Promise<Evidence> {
      missing.push(url);
      throw new Error("Unexpected product request");
    },
  };
  const downloader = {
    requests: 0,
    async get(url: string) {
      if (url === newsUrl)
        return html({
          stories: [
            { slug: "early", title: "Early", date: "2025-01-01" },
            { slug: "late", title: "Late", date: "2026-01-01" },
          ],
        });
      return html({ article: { body: `<a href="${shopUrl}example">Example</a>` } });
    },
  };
  const options = { catalog, news, newsCache: join(root, "news-cache"), fetch: true, client, downloader };
  return { root, catalog, dataRoot, news, imports, original, client, downloader, options, missing, pages };
}

it.each(["workbook-map.json", "workbook-map.schema.json"])(
  "preparation rejects edits to captured %s without publishing a review",
  async (name) => {
    const f = await fixture();
    const folder = f.catalog;
    await mkdir(folder, { recursive: true });
    const records = join(folder, "workbook-map.json");
    const schema = join(folder, "workbook-map.schema.json");
    await writeFile(
      records,
      '{"$schema":"./workbook-map.schema.json","formatVersion":1,"source":{"id":"kdm-collection-sheets","workbook":"Example.xlsx"},"rows":[]}',
    );
    await writeFile(schema, "{}");
    const get = f.client.get;
    let edited = false;
    f.client.get = async (url) => {
      if (!edited) {
        edited = true;
        const path = join(folder, name);
        await writeFile(path, (await readFile(path, "utf8")) + " ");
      }
      return get(url);
    };
    await expect(prepareUpdate(f.options)).rejects.toThrow("Workbook");
    expect(await readFile(join(f.catalog, "data.json"), "utf8")).toBe(f.original);
    expect(await readFile(f.imports, "utf8")).toBe("{}");
    await expect(readFile(join(f.root, "temp/kdm-catalog/reports/kdm-update-review.json"))).rejects.toMatchObject({ code: "ENOENT" });
  },
);

it("stages announcement dates and dollar prices, applies captured stock, and acknowledges imports last", async () => {
  const f = await fixture();
  const prepared = await prepareUpdate(f.options);
  const review = parseReview(await readFile(prepared.path, "utf8"));
  expect(await readFile(join(f.catalog, "data.json"), "utf8")).toBe(f.original);
  expect(await readFile(f.imports, "utf8")).toBe("{}");
  expect(review.changes[0]?.after.announcements).toEqual(["2025-01-01", "2026-01-01"]);
  expect(review.changes[0]?.after.editions?.[0]?.prices).toEqual([1250, 2000]);
  expect(summarizeReview(review)).toContain("1 availability changes");
  expect(summarizeReview(review)).toContain("1 catalog change;");
  expect(summarizeReview(review)).toContain(`captured snapshot (${prepared.review.monthly.checkedAt})`);
  const { monthly: _, newsHash: __, ...common } = review;
  expect(summarizeReview({ ...common, date: "tags-only" })).not.toContain("snapshot");
  const requests = [...f.pages];
  const published: string[] = [];
  vi.mocked(rename).mockImplementation(async (from, to) => {
    published.push(String(to));
    return actualFs.rename(from, to);
  });
  await applyReview(review, f.catalog, join(f.news, "shop-links.json"));
  expect(f.pages).toEqual(requests);
  expect(f.missing).toEqual([]);
  expect(published.at(-1)).toBe(f.imports);
  const saved = JSON.parse(await readFile(join(f.catalog, "data.json"), "utf8"));
  expect(saved.content.example.editions[0].available).toBe(true);
  expect(Object.keys(JSON.parse(await readFile(f.imports, "utf8")))).toHaveLength(2);
});

it("keeps warning output bounded and deduplicated without changing the review", async () => {
  const f = await fixture();
  const { review } = await prepareUpdate(f.options);
  review.warnings = [];
  expect(summarizeReview(review)).not.toContain("Warnings");
  review.warnings = ["Check price", "Check price", "Check mapping", "Check edition", "Check release"];
  const original = [...review.warnings];
  expect(summarizeReview(review).split("\n").slice(-5)).toEqual([
    "Warnings (4):",
    "  - Check price",
    "  - Check mapping",
    "  - Check edition",
    "  1 more in the review file.",
  ]);
  expect(review.warnings).toEqual(original);
  review.warnings = ["Check price"];
  expect(summarizeReview(review).split("\n").slice(-2)).toEqual(["Warnings (1):", "  - Check price"]);
});

it("keeps only relevant products and applies the reviewed stock changes without shop caches", async () => {
  const f = await fixture();
  f.client.get = async (url) => ({
    url,
    checkedAt: "2026-10-01T00:00:00Z",
    data: {
      products: url.endsWith("page=1") ? [{ ...product(), body_html: "Listing description payload" }, product("mystery-t-shirt")] : [],
    },
  });
  const prepared = await prepareUpdate(f.options);
  const text = await readFile(prepared.path, "utf8");
  const review = parseReview(text);
  expect(text).toContain("Listing description payload");
  expect(text).not.toContain("mystery-t-shirt");
  expect(review.monthly).not.toHaveProperty("snapshot");
  expect(review.changes[0]?.listings).toHaveLength(1);
  expect(review.changes[0]?.listings?.[0]).not.toHaveProperty("priceUnit");
  expect(review.changes[0]).not.toHaveProperty("before");
  expect(review).not.toHaveProperty("sources");
  expect(review.changes[0]?.after.editions?.[0]?.shop).toBe("in-stock");
  expect(review.changes[0]?.after.editions?.[0]?.available).toBe(true);
  for (const page of [1, 2]) await rm(join(f.root, `.cache/kdm-catalog/shopify-products/products-page-${page}.json`));
  await applyReview(review, f.catalog, join(f.news, "shop-links.json"));
  const saved = JSON.parse(await readFile(join(f.catalog, "data.json"), "utf8"));
  expect(saved.content.example).toEqual(review.changes[0]?.after);
  const repeated = await prepareUpdate(f.options);
  expect(repeated.review.changes).toEqual([]);
  expect(repeated.review).not.toHaveProperty("sources");
  expect(repeated.review.monthly.posts).toEqual({});
});

it("includes stock-only changes in the review and applies exactly the reviewed item", async () => {
  const f = await fixture();
  const first = await prepareUpdate(f.options);
  await applyReview(first.review, f.catalog, join(f.news, "shop-links.json"));
  const current = product();
  current.variants[0]!.available = false;
  f.client.get = async (url) => ({
    url,
    checkedAt: "2026-10-01T00:00:00Z",
    data: { products: url.endsWith("page=1") ? [current] : [] },
  });
  const prepared = await prepareUpdate(f.options);
  const review = parseReview(await readFile(prepared.path, "utf8"));
  expect(review.changes).toHaveLength(1);
  const change = review.changes[0]!;
  expect(change.after.editions?.[0]?.prices).toEqual(first.review.changes[0]?.after.editions?.[0]?.prices);
  expect(change.differences).toContainEqual({
    field: "editions[first-run].shop",
    change: "changed",
    before: "in-stock",
    after: "out-of-stock",
  });
  expect(change.after.editions?.[0]?.shop).toBe("out-of-stock");
  expect(review.monthly?.availability.changed).toBe(1);
  await applyReview(review, f.catalog, join(f.news, "shop-links.json"));
  const saved = JSON.parse(await readFile(join(f.catalog, "data.json"), "utf8"));
  expect(saved.content.example).toEqual(change.after);
});

it("summarizes item and edition fields by stable ID with bounded detail", async () => {
  const f = await fixture();
  const review: Review = (await prepareUpdate(f.options)).review;
  const before = {
    name: "Example",
    tags: ["model"],
    handle: "example",
    editions: [{ id: "first-run", label: "First Run", prices: [1000], releaseWindow: "2026" }],
  };
  const after = {
    ...before,
    editions: [{ id: "first-run", label: "Box", prices: [1000, 1250], releaseWindow: "2027" }],
  };
  function summarize(after: Item, previous: Item | null = before) {
    review.changes = [{ category: "content", itemId: "example", differences: itemDifferences(previous, after), after }];
    return summarizeReview(review);
  }
  expect(summarize(after)).toContain("Update: Example (example): edition labels, prices, release dates");
  expect(summarize({ ...after, handle: "replacement", tags: ["gear"], notes: "Updated notes" })).toContain(
    "Update: Example (example): tags, links, notes, +3 more",
  );
  expect(summarize({ ...before, editions: [...before.editions, { id: "encore", label: "Encore", prices: [1000] }] })).toContain(
    "Update: Example (example): editions added",
  );
  expect(summarize({ ...before, editions: [] })).toContain("Update: Example (example): editions removed");
  expect(summarize(before, null).split("\n").at(-1)).toBe("  Add: Example (example)");
});

it("distinguishes edition reordering from price changes", async () => {
  const f = await fixture();
  const review: Review = (await prepareUpdate(f.options)).review;
  const before = {
    name: "Example",
    tags: ["model"],
    editions: [
      { id: "original", label: "Box", prices: [1000] },
      { id: "other", label: "Box", prices: [2000] },
    ],
  };
  const after = { ...before, editions: before.editions.toReversed() };
  review.changes = [{ category: "content", itemId: "example", differences: itemDifferences(before, after), after }];
  expect(summarizeReview(review)).toContain("Update: Example (example): edition order");
});

it("retains lower compare-at prices as history without warnings", async () => {
  const f = await fixture();
  const listing = product();
  listing.variants[0]!.compare_at_price = "10.00";
  f.client.get = async (url) => ({
    url,
    checkedAt: "2026-10-01T00:00:00Z",
    data: { products: url.endsWith("page=1") ? [listing] : [] },
  });
  const { review } = await prepareUpdate(f.options);
  expect(review.warnings).toEqual([]);
  expect(review.changes[0]?.after.editions?.[0]?.prices).toEqual([1000, 1250]);
});

it.each(["hash", "A".repeat(64), "a".repeat(63), "g".repeat(64), "a".repeat(65), 123])(
  "rejects malformed ledger hash %s before downloads or news writes",
  async (hash) => {
    const f = await fixture();
    const text = JSON.stringify({ "https://kingdomdeath.com/news/early": hash });
    await writeFile(f.imports, text);
    const download = vi.spyOn(f.downloader, "get");
    const error = await prepareUpdate(f.options).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: expect.stringMatching(/Invalid news import ledger.*restore valid JSON.*SHA256/) });
    expect((error as Error).cause).toBeDefined();
    expect(download).not.toHaveBeenCalled();
    expect(f.pages).toEqual([]);
    await expect(readFile(join(f.news, "shop-links.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(f.imports, "utf8")).toBe(text);
  },
);

it("allows a missing import ledger without creating it during preparation", async () => {
  const f = await fixture();
  await rm(f.imports);
  const { review, announcements } = await prepareUpdate(f.options);
  expect(announcements).toBe(2);
  expect(review.monthly.importsHash).toBeNull();
  await expect(readFile(f.imports, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
});

it("rejects malformed mapping fields before news or shop requests", async () => {
  const f = await fixture();
  await writeFile(
    join(f.dataRoot, "shop-mappings.json"),
    JSON.stringify({
      example: { category: "content", itemId: "example", retired: false },
    }),
  );
  const download = vi.spyOn(f.downloader, "get");
  await expect(prepareUpdate(f.options)).rejects.toMatchObject({
    _tag: "CatalogInputError",
    message: expect.stringContaining("retired"),
  });
  expect(download).not.toHaveBeenCalled();
  expect(f.pages).toEqual([]);
  await expect(readFile(join(f.news, "shop-links.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
});

it("preserves valid unchanged ledger hashes and skips their announcements", async () => {
  const f = await fixture();
  const first = await prepareUpdate(f.options);
  const text = JSON.stringify(first.review.monthly.posts);
  await writeFile(f.imports, text);
  const repeated = await prepareUpdate(f.options);
  expect(repeated.announcements).toBe(0);
  expect(repeated.review.monthly.posts).toEqual({});
  expect(await readFile(f.imports, "utf8")).toBe(text);
});

it("discovers snapshot-only unknown physical and Sim listings without individual requests", async () => {
  const f = await fixture();
  f.client.get = async (url: string) => ({
    url,
    checkedAt: "2026-10-01T00:00:00Z",
    data: { products: url.endsWith("page=1") ? [product(), product("unknown"), product("unknown-sim", true)] : [] },
  });
  const { review } = await prepareUpdate(f.options);
  expect(review.unresolved).toEqual(
    expect.arrayContaining([expect.objectContaining({ handle: "unknown" }), expect.objectContaining({ handle: "unknown-sim" })]),
  );
  expect(f.missing).toEqual([]);
  await expect(applyReview(review, f.catalog, join(f.news, "shop-links.json"))).rejects.toThrow("Resolve");
  expect(await readFile(f.imports, "utf8")).toBe("{}");
});

it("keeps reviewed excluded listings out of discovery", async () => {
  const f = await fixture();
  f.client.get = async (url) => ({
    url,
    checkedAt: "2026-10-01T00:00:00Z",
    data: {
      products: url.endsWith("page=1")
        ? [
            product(),
            product("kickstarter-example"),
            product("gear-card-sleeves-100"),
            product("another-preorder-item-test"),
            product("mystery-t-shirt"),
          ]
        : [],
    },
  });
  const { review } = await prepareUpdate(f.options);
  expect(review.unresolved).toEqual([]);
  expect(review.excluded).toBe(4);
});

it("does not refetch snapshot products excluded by title when announcement labels differ", async () => {
  const f = await fixture();
  f.client.get = async (url) => ({
    url,
    checkedAt: "2026-10-01T00:00:00Z",
    data: { products: url.endsWith("page=1") ? [{ ...product(), title: "Kickstarter Example" }] : [] },
  });
  const { review } = await prepareUpdate(f.options);
  expect(f.missing).toEqual([]);
  expect(review.unresolved).toEqual([]);
  expect(review.excluded).toBe(1);
});

it.each([false, true])("skips retired preorder metadata and downloads (in snapshot: %s) while using current stock", async (inSnapshot) => {
  const f = await fixture();
  const current = product();
  current.variants[0]!.available = false;
  const retired = product("preorder-example");
  retired.variants[0]!.price = "1.00";
  await writeFile(
    join(f.dataRoot, "shop-mappings.json"),
    JSON.stringify({
      "preorder-example": { category: "content", itemId: "example", editionId: "first-run", retired: "Released as /products/example." },
    }),
  );
  f.client.get = async (url) => ({
    url,
    checkedAt: "2026-10-01T00:00:00Z",
    data: { products: url.endsWith("page=1") ? [current, ...(inSnapshot ? [retired] : [])] : [] },
  });
  const download = f.downloader.get.bind(f.downloader);
  f.downloader.get = async (url) =>
    url === newsUrl ? download(url) : html({ article: { body: `<a href="${shopUrl}preorder-example">Example</a>` } });
  const { review } = await prepareUpdate(f.options);
  expect(f.missing).toEqual([]);
  expect(review.unresolved).toEqual([]);
  expect(review.changes.flatMap((change) => change.listings ?? []).map((listing) => listing.product.handle)).toEqual(["example"]);
  expect(review.excluded).toBe(1);
  expect(review.changes[0]?.after.editions?.[0]?.prices).toEqual([1250, 2000]);
  expect(review.monthly.availability.available).toBe(0);
  await applyReview(review, f.catalog, join(f.news, "shop-links.json"));
  const saved = JSON.parse(await readFile(join(f.catalog, "data.json"), "utf8"));
  expect(saved.content.example.editions[0].handle ?? saved.content.example.handle).toBe("example");
  expect(saved.content.example.editions[0].shop).toBe("out-of-stock");
  expect(saved.content.example.editions[0].available).not.toBe(true);
});

it("keeps an unreviewed preorder in discovery", async () => {
  const f = await fixture();
  f.client.get = async (url) => ({
    url,
    checkedAt: "2026-10-01T00:00:00Z",
    data: { products: url.endsWith("page=1") ? [product(), product("preorder-unknown")] : [] },
  });
  const { review } = await prepareUpdate(f.options);
  expect(review.unresolved).toContainEqual(expect.objectContaining({ handle: "preorder-unknown" }));
  expect(review.excluded).toBe(0);
});

it.each(["catalog", "news", "mappings", "imports"] as const)("rejects stale %s input without acknowledging imports", async (input) => {
  const f = await fixture();
  const { review } = await prepareUpdate(f.options);
  const paths = {
    catalog: join(f.catalog, "data.json"),
    news: join(f.news, "shop-links.json"),
    mappings: join(f.dataRoot, "shop-mappings.json"),
    imports: f.imports,
  };
  const path = paths[input];
  const changed =
    input === "mappings"
      ? '{"new": {"category":"content","itemId":"new"}}'
      : input === "imports"
        ? '{"older":"hash"}'
        : (await readFile(path, "utf8")) + " ";
  await writeFile(path, changed);
  await expect(applyReview(review, f.catalog, join(f.news, "shop-links.json"))).rejects.toThrow(/changed/i);
  expect(await readFile(f.imports, "utf8")).toBe(input === "imports" ? changed : "{}");
});

it("failed and canceled preparation leave live data and imports untouched", async () => {
  const f = await fixture();
  f.client.get = async () => {
    throw new Error("Shop unavailable");
  };
  await expect(prepareUpdate(f.options)).rejects.toThrow("Shop unavailable");
  const controller = new AbortController();
  controller.abort(new Error("Canceled"));
  await expect(prepareUpdate({ ...f.options, signal: controller.signal })).rejects.toThrow("Canceled");
  expect(await readFile(join(f.catalog, "data.json"), "utf8")).toBe(f.original);
  expect(await readFile(f.imports, "utf8")).toBe("{}");
});

it("failed catalog publication leaves imports unacknowledged", async () => {
  const f = await fixture();
  const { review } = await prepareUpdate(f.options);
  vi.mocked(rename).mockImplementation(async (from, to) => {
    if (String(to) === join(f.catalog, "data.json")) throw new Error("Disk unavailable");
    return actualFs.rename(from, to);
  });
  await expect(applyReview(review, f.catalog, join(f.news, "shop-links.json"))).rejects.toThrow("Disk unavailable");
  expect(await readFile(f.imports, "utf8")).toBe("{}");
});

it("attaches returned listing handles and does not request acknowledged announcement aliases again", async () => {
  const f = await fixture();
  const download = f.downloader.get.bind(f.downloader);
  f.downloader.get = async (url) =>
    url === newsUrl ? download(url) : html({ article: { body: `<a href="${shopUrl}old-example">Example</a>` } });
  f.client.get = async (url: string) => ({
    url,
    checkedAt: "2026-10-01T00:00:00Z",
    data: { products: url.endsWith("page=1") ? [product("art-print-test")] : [] },
  });
  f.client.product = async (url) => {
    f.missing.push(url);
    return { url, checkedAt: "2026-10-01T00:00:00Z", data: shopProduct(product()) };
  };
  const first = await prepareUpdate(f.options);
  expect(f.missing).toEqual([shopUrl + "old-example"]);
  expect(first.review.changes[0]?.listings?.[0]?.product.handle).toBe("example");
  await applyReview(first.review, f.catalog, join(f.news, "shop-links.json"));
  f.missing.length = 0;
  const repeated = await prepareUpdate(f.options);
  expect(repeated.announcements).toBe(0);
  expect(f.missing).toEqual([]);
});

it("canceled application leaves the catalog and import ledger untouched", async () => {
  const f = await fixture();
  const { review } = await prepareUpdate(f.options);
  const controller = new AbortController();
  controller.abort(new Error("Canceled apply"));
  await expect(applyReview(review, f.catalog, join(f.news, "shop-links.json"), { signal: controller.signal })).rejects.toThrow(
    "Canceled apply",
  );
  expect(await readFile(join(f.catalog, "data.json"), "utf8")).toBe(f.original);
  expect(await readFile(f.imports, "utf8")).toBe("{}");
});
