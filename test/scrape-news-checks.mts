import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  csv,
  Downloader,
  extractLinks,
  keepUrl,
  loadReport,
  newReport,
  normalizeReport,
  pageData,
  saveReport,
  updateReport,
} from "../scripts/scrape-news-shop-links.mts";

const news = "https://kingdomdeath.com/news";
const shop = "https://shop.kingdomdeath.com/products/";
const post = { date: "2026-08-31T21:59:34+00:00", title: "Sale", postUrl: `${news}/old` };
const page = (data: unknown) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { data } } })}</script>`;
const story = (slug: string) => ({ date: post.date, title: "Sale", slug });

test("release names, entities and image duplicates survive the TS conversion", () => {
  const links = extractLinks(
    `<a href="${shop}aya"><img src="aya.jpg"></a><p><strong>Questing Aya&nbsp;</strong>- <a href="${shop}aya">Read More</a><br>` +
      `<strong>Light &amp; Shadow Dice</strong> - <a href="${shop}dice">Read More</a></p>`,
    post,
  );
  assert.deepEqual(
    links.map((link) => link.itemName),
    ["Questing Aya", "Light & Shadow Dice"],
  );
});

test("only direct shop product URLs are retained, with collections still excluded", () => {
  for (const path of [
    "",
    "pages/seed-patterns",
    "blogs/news",
    "products-preview/aya",
    "?next=https://shop.kingdomdeath.com/products/aya",
    "collections/in-stock",
    "collections/in-stock/products/aya",
    "products/aya?ref=collections",
    "Collections/all",
  ]) {
    const url = `https://shop.kingdomdeath.com/${path}`;
    assert.equal(keepUrl(url), false);
    assert.equal(extractLinks(`<a href="${url}">Aya</a>`, post).length, 0);
  }
  assert.equal(keepUrl("https://shop.kingdomdeath.com.evil.example/products/aya"), false);
  assert.equal(keepUrl(shop + "aya"), true);
  assert.equal(keepUrl(shop + "aya?variant=123#details"), true);
});

test("existing Python export migrates, filters rows and retains zero-link checkpoints", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "kdm-news-test-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = newReport();
  report.posts = [{ ...post, status: "read", linkCount: 3 }];
  report.links = [
    { ...post, itemName: "Aya", shopUrl: shop + "aya" },
    { ...post, itemName: "Stock", shopUrl: "https://shop.kingdomdeath.com/collections/in-stock" },
    { ...post, itemName: "Seed patterns", shopUrl: "https://shop.kingdomdeath.com/pages/seed-patterns" },
  ];
  await saveReport(report, output);
  const legacy = JSON.parse(await readFile(join(output, "news-shop-links.json"), "utf8"));
  legacy.links[0].nameSource = "link text";
  await writeFile(join(output, "news-shop-links.json"), JSON.stringify(legacy));
  const migrated = await loadReport(output);
  assert.equal(migrated.removedLinksThisRun, 2);
  assert.equal(migrated.links.length, 1);
  assert.equal(migrated.posts[0]!.linkCount, 1);
  assert.equal(migrated.links[0]!.date, "2026-08-31");
  assert.equal(migrated.posts[0]!.date, "2026-08-31");
  assert.ok(!("nameSource" in migrated.links[0]!));
  await saveReport(migrated, output);
  assert.doesNotMatch(await readFile(join(output, "news-shop-links.csv"), "utf8"), /collections|seed-patterns/);
});

test("duplicates keep the earliest timestamp, while different names or URLs remain", () => {
  const report = newReport();
  const earlier = { ...post, postUrl: `${news}/earlier`, date: "2026-08-31T00:30:00+02:00" };
  report.posts = [
    { ...post, status: "read" },
    { ...earlier, status: "read" },
  ];
  report.links = [
    { ...post, itemName: "Aya", shopUrl: shop + "aya" },
    { ...earlier, itemName: "Aya", shopUrl: shop + "aya" },
    { ...post, itemName: "Questing Aya", shopUrl: shop + "aya" },
    { ...post, itemName: "Aya", shopUrl: shop + "aya-variant" },
  ];
  normalizeReport(report);
  assert.equal(report.links.length, 3);
  assert.equal(report.links.find((link) => link.itemName === "Aya" && link.shopUrl === shop + "aya")!.postUrl, earlier.postUrl);
  assert.ok(report.links.every((link) => link.date === "2026-08-31"));
  assert.equal(report.posts[0]!.linkCount, 2);
  assert.equal(report.posts[1]!.linkCount, 1);
  const before = JSON.stringify(report);
  normalizeReport(report);
  assert.equal(JSON.stringify(report), before);
});

test("a newly discovered earlier post replaces an exported pair without fetching the old post", async () => {
  const report = newReport();
  report.posts = [{ ...post, date: "2026-08-31", status: "read" }];
  report.links = [{ ...post, date: "2026-08-31", itemName: "Aya", shopUrl: shop + "aya" }];
  const requested: string[] = [];
  await updateReport(
    report,
    { stories: [story("old"), { ...story("earlier"), date: "2026-08-31T01:00:00Z" }] },
    async (url) => {
      requested.push(url);
      return page({ article: { body: `<a href="${shop}aya">Aya</a>` } });
    },
    async () => {},
  );
  assert.deepEqual(requested, [`${news}/earlier`]);
  assert.equal(report.links.length, 1);
  assert.equal(report.links[0]!.postUrl, `${news}/earlier`);
  assert.equal(report.posts[0]!.linkCount, 0);
  assert.equal(report.links[0]!.date, "2026-08-31");
});

test("incremental run processes only new and failed articles, skips zero-link posts, and remains idempotent", async () => {
  const report = newReport();
  report.posts = [
    { ...post, status: "read", linkCount: 0 },
    { ...post, postUrl: `${news}/failed`, status: "unread" },
  ];
  const index = { stories: [story("new"), story("old"), story("failed")] };
  const requested: [string, boolean][] = [];
  let checkpoints = 0;
  await updateReport(
    report,
    index,
    async (url, cached) => {
      requested.push([url, cached]);
      return page({ article: { body: `<a href="${shop}aya">Aya</a>` } });
    },
    async () => {
      checkpoints++;
    },
  );
  assert.deepEqual(requested, [
    [`${news}/new`, true],
    [`${news}/failed`, false],
  ]);
  assert.equal(checkpoints, 2);
  assert.equal(report.links.length, 1);
  assert.equal(report.complete, true);
  await updateReport(
    report,
    index,
    async () => {
      throw new Error("Should not fetch exported articles");
    },
    async () => {},
  );
  assert.equal(report.links.length, 1);
});

test("failed new article preserves earlier links and checkpoints the failure", async () => {
  const report = newReport();
  report.posts = [{ ...post, status: "read" }];
  report.links = [{ ...post, itemName: "Aya", shopUrl: shop + "aya" }];
  await updateReport(
    report,
    { stories: [story("old"), story("new")] },
    async () => "blocked",
    async () => {},
  );
  assert.equal(report.links.length, 1);
  assert.equal(report.posts[1]!.status, "unread");
  assert.equal(report.complete, false);
});

test("malformed checkpoints are not silently replaced", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "kdm-news-test-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  await writeFile(join(output, "news-shop-links.json"), "broken");
  await assert.rejects(loadReport(output));
  assert.equal(await readFile(join(output, "news-shop-links.json"), "utf8"), "broken");
});

test("index bypasses cache while articles reuse it, with delays between requests", async (t) => {
  const cache = await mkdtemp(join(tmpdir(), "kdm-news-test-"));
  t.after(() => rm(cache, { recursive: true, force: true }));
  const starts: number[] = [];
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    starts.push(performance.now());
    return new Response(page({ stories: [story("new")] }));
  });
  const downloader = new Downloader({ cache, delay: 0.02 });
  await downloader.get(news, false);
  await downloader.get(news, false);
  await downloader.get(`${news}/new`);
  await downloader.get(`${news}/new`);
  assert.equal(fetchMock.mock.callCount(), 3);
  assert.ok(starts[1]! - starts[0]! >= 18);
  assert.ok(starts[2]! - starts[1]! >= 18);
});

test("CSV escapes scraped text and parser rejects challenge pages", () => {
  const report = newReport();
  report.links = [{ ...post, title: '=HYPERLINK("bad")', itemName: 'Aya, "Hero" ♥', shopUrl: shop + "aya" }];
  assert.match(csv(report), /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv(report), /"Aya, ""Hero"" ♥"/);
  assert.throws(() => pageData("<h1>Access denied</h1>"), /Missing __NEXT_DATA__/);
});
