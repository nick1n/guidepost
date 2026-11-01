import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  csv,
  extractLinks,
  keepUrl,
  loadReport,
  newReport,
  recoverCachedHistory,
  normalizeReport,
  pageData,
  saveReport,
  updateReport,
  refreshNews,
  NewsRefreshError,
  postFingerprints,
} from "#scripts/news/scrape-shop-links.mts";

const news = "https://kingdomdeath.com/news";
const shop = "https://shop.kingdomdeath.com/products/";
const post = { date: "2026-08-31T21:59:34+00:00", title: "Sale", postUrl: `${news}/old` };
const page = (data: unknown) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { data } } })}</script>`;
const story = (slug: string) => ({ date: post.date, title: "Sale", slug });

test("post fingerprints preserve existing bytes, repeated announcements, and zero-link posts", () => {
  const report = newReport();
  const repeated = { ...post, postUrl: `${news}/repeat` };
  const empty = { ...post, postUrl: `${news}/empty` };
  report.posts = [post, repeated, empty].map((entry) => ({ ...entry, status: "read" }));
  report.posts.push(
    { ...post, postUrl: `${news}/failed`, status: "read", error: "Refresh failed" },
    { ...post, postUrl: `${news}/unread`, status: "unread" },
  );
  report.links = [
    { ...post, itemName: "Rene", shopUrl: shop + "rene" },
    { ...repeated, itemName: "Aya", shopUrl: shop + "aya" },
    { ...post, itemName: "Aya", shopUrl: shop + "aya" },
  ];
  const legacy = Object.fromEntries(
    report.posts
      .filter((entry) => entry.status === "read" && !entry.error)
      .map((entry) => [
        entry.postUrl,
        createHash("sha256")
          .update(
            JSON.stringify({
              date: entry.date,
              title: entry.title,
              links: report.links.filter((link) => link.postUrl === entry.postUrl).map(({ itemName, shopUrl }) => ({ itemName, shopUrl })),
            }),
          )
          .digest("hex"),
      ]),
  );
  assert.deepEqual(postFingerprints(report), legacy);
  assert.deepEqual(Object.keys(legacy), [post.postUrl, repeated.postUrl, empty.postUrl]);
  assert.deepEqual(postFingerprints(report), postFingerprints(structuredClone(report)));
  for (const change of ["date", "title", "itemName", "shopUrl", "order"] as const) {
    const changed = structuredClone(report);
    if (change === "date") changed.posts[0]!.date = "2026-09-01";
    else if (change === "title") changed.posts[0]!.title = "Another sale";
    else if (change === "order") changed.links.reverse();
    else changed.links[0]![change] += " changed";
    assert.notEqual(postFingerprints(changed)[post.postUrl], legacy[post.postUrl], change);
  }
});

test("fetch refreshes the index and only new or failed articles, with explicit historical refresh", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "kdm-news-refresh-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = newReport();
  report.linkHistoryVersion = 3;
  report.posts = [
    { ...post, status: "read" },
    { ...post, postUrl: `${news}/failed`, status: "unread" },
  ];
  report.links = [{ ...post, itemName: "Aya", shopUrl: shop + "aya" }];
  await saveReport(report, output);
  const requested: [string, boolean | undefined][] = [];
  const downloader = {
    requests: 0,
    async get(url: string, cached?: boolean) {
      requested.push([url, cached]);
      this.requests++;
      return url === news
        ? page({ stories: [story("old"), story("new"), story("failed")] })
        : page({ article: { body: `<a href="${shop}rene">Rene</a>` } });
    },
  };
  const refreshed = await refreshNews({ output, cache: output, fetch: true, downloader });
  assert.deepEqual(requested, [
    [news, false],
    [`${news}/new`, false],
    [`${news}/failed`, false],
  ]);
  assert.equal(refreshed.links.find((link) => link.postUrl === post.postUrl)?.itemName, "Aya");
  requested.length = 0;
  await refreshNews({ output, cache: output, fetch: true, refreshPosts: true, downloader });
  assert.deepEqual(
    requested.map(([url]) => url),
    [news, post.postUrl, `${news}/new`, `${news}/failed`],
  );
});

test("offline refresh reprocesses cached history without network and checkpoints missing articles for retry", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "kdm-news-offline-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const cachePage = (url: string, html: string) => writeFile(join(output, createHash("sha256").update(url).digest("hex") + ".html"), html);
  await cachePage(news, page({ stories: [story("old"), story("new")] }));
  await cachePage(post.postUrl, page({ article: { body: `<a href="${shop}aya">Aya</a>` } }));
  const fetchMock = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected network");
  });
  await assert.rejects(refreshNews({ output, cache: output, refreshPosts: true }), NewsRefreshError);
  const partial = await loadReport(output);
  assert.equal(partial.posts.find((entry) => entry.postUrl === `${news}/new`)?.status, "unread");
  assert.equal(partial.links[0]?.itemName, "Aya");
  await cachePage(`${news}/new`, page({ article: { body: `<a href="${shop}rene">Rene</a>` } }));
  const retried = await refreshNews({ output, cache: output });
  assert.equal(retried.complete, true);
  assert.equal(retried.skippedPostsThisRun, 1);
  assert.equal(fetchMock.mock.callCount(), 0);
  const refreshed = await refreshNews({ output, cache: output, refreshPosts: true });
  assert.equal(refreshed.processedPostsThisRun, 2);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("interruption preserves the checkpoint and propagates the abort reason", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "kdm-news-abort-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const controller = new AbortController();
  const reason = new Error("Stop refresh");
  const requested: string[] = [];
  await assert.rejects(
    refreshNews({
      output,
      cache: output,
      fetch: true,
      signal: controller.signal,
      downloader: {
        requests: 0,
        async get(url) {
          requested.push(url);
          if (url === news) return page({ stories: [story("new"), story("later")] });
          controller.abort(reason);
          throw reason;
        },
      },
    }),
    (error) => error === reason,
  );
  assert.deepEqual(requested, [news, `${news}/new`]);
  const saved = JSON.parse(await readFile(join(output, "shop-links.json"), "utf8"));
  assert.equal(saved.complete, false);
  assert.equal(saved.posts[0].status, "unread");
  assert.ok(saved.finishedAt);
});

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

test("product links are retained while collection indexes and other pages are excluded", () => {
  for (const path of [
    "",
    "pages/seed-patterns",
    "blogs/news",
    "products-preview/aya",
    "?next=https://shop.kingdomdeath.com/products/aya",
    "collections/in-stock",
    "Collections/all",
  ]) {
    const url = `https://shop.kingdomdeath.com/${path}`;
    assert.equal(keepUrl(url), false);
    assert.equal(extractLinks(`<a href="${url}">Aya</a>`, post).length, 0);
  }
  assert.equal(keepUrl("https://shop.kingdomdeath.com.evil.example/products/aya"), false);
  assert.equal(keepUrl(shop + "aya"), true);
  assert.equal(keepUrl(shop + "aya?variant=123#details"), true);
  assert.equal(keepUrl("https://shop.kingdomdeath.com/collections/in-stock/products/aya"), true);
  assert.equal(keepUrl(shop + "aya?ref=collections"), true);
});

test("newsletter path typos are repaired without treating query redirects as product links", () => {
  const links = extractLinks(
    `<a href="${shop}wrong${shop}ringtail-vixen-wb">Ringtail Vixen</a><a href="${shop} griswaldan">Griswaldan</a><a href="${shop}/products/griswaldan">Griswaldan again</a>`,
    post,
  );
  assert.deepEqual(
    links.map((link) => link.shopUrl),
    [shop + "ringtail-vixen-wb", shop + "griswaldan"],
  );
  assert.equal(keepUrl(`https://shop.kingdomdeath.com/?next=${shop}aya`), false);
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
  const legacy = JSON.parse(await readFile(join(output, "shop-links.json"), "utf8"));
  legacy.links[0].nameSource = "link text";
  await writeFile(join(output, "shop-links.json"), JSON.stringify(legacy));
  const migrated = await loadReport(output);
  assert.equal(migrated.removedLinksThisRun, 2);
  assert.equal(migrated.links.length, 1);
  assert.equal(migrated.posts[0]!.linkCount, 1);
  assert.equal(migrated.links[0]!.date, "2026-08-31");
  assert.equal(migrated.posts[0]!.date, "2026-08-31");
  assert.ok(!("nameSource" in migrated.links[0]!));
  await saveReport(migrated, output);
  assert.doesNotMatch(await readFile(join(output, "shop-links.csv"), "utf8"), /collections|seed-patterns/);
});

test("repeat announcements survive while duplicate links within a post are removed", () => {
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
    { ...post, itemName: "Aya", shopUrl: shop + "aya" },
  ];
  normalizeReport(report);
  assert.equal(report.links.length, 4);
  assert.equal(report.links.find((link) => link.itemName === "Aya" && link.shopUrl === shop + "aya")!.postUrl, earlier.postUrl);
  assert.ok(report.links.every((link) => link.date === "2026-08-31"));
  assert.equal(report.posts[0]!.linkCount, 3);
  assert.equal(report.posts[1]!.linkCount, 1);
  const before = JSON.stringify(report);
  normalizeReport(report);
  assert.equal(JSON.stringify(report), before);
});

test("a newly discovered earlier post adds history without removing the old occurrence", async () => {
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
  assert.equal(report.links.length, 2);
  assert.equal(report.links[0]!.postUrl, `${news}/earlier`);
  assert.equal(report.posts[0]!.linkCount, 1);
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
  assert.equal("discoveredPostUrls" in report, false);
  assert.equal(report.links.length, 2);
  assert.equal(report.complete, true);
  await updateReport(
    report,
    index,
    async () => {
      throw new Error("Should not fetch exported articles");
    },
    async () => {},
  );
  assert.equal(report.links.length, 2);
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

test("cached articles restore missing announcement occurrences without losing uncached posts", async (t) => {
  const cache = await mkdtemp(join(tmpdir(), "kdm-history-test-"));
  t.after(() => rm(cache, { recursive: true, force: true }));
  const earlier = { ...post, date: "2026-07-31", postUrl: `${news}/earlier` };
  const report = newReport();
  report.posts = [
    { ...earlier, status: "read" },
    { ...post, status: "read" },
  ];
  report.links = [{ ...post, itemName: "Aya", shopUrl: shop + "aya" }];
  await writeFile(
    join(cache, createHash("sha256").update(earlier.postUrl).digest("hex") + ".html"),
    page({ article: { body: `<a href="${shop}aya">Aya</a>` } }),
  );
  await recoverCachedHistory(report, cache);
  assert.equal(report.links.length, 2);
  assert.deepEqual(
    report.links.map((row) => row.postUrl),
    [earlier.postUrl, post.postUrl],
  );
  assert.deepEqual(report.historyRecovery, { postsRecovered: 1, postsMissingCache: 1 });
  const recovered = JSON.stringify(report);
  await recoverCachedHistory(report, cache);
  assert.equal(JSON.stringify(report), recovered);
});

test("a failed refresh preserves successful contents, then an incremental run retries it", async () => {
  const report = newReport();
  report.posts = [{ ...post, status: "read" }];
  report.links = [{ ...post, itemName: "Aya", shopUrl: shop + "aya" }];
  await updateReport(
    report,
    { stories: [story("old")] },
    async () => {
      throw new Error("Temporary failure");
    },
    async () => {},
    true,
  );
  assert.equal(report.complete, false);
  assert.equal(report.posts[0]!.status, "read");
  assert.equal(report.links[0]!.itemName, "Aya");
  assert.match(report.posts[0]!.error!, /Temporary failure/);
  const requests: boolean[] = [];
  await updateReport(
    report,
    { stories: [story("old")] },
    async (_url, cached) => {
      requests.push(cached);
      return page({ article: { body: `<a href="${shop}rene">Rene</a>` } });
    },
    async () => {},
  );
  assert.deepEqual(requests, [false]);
  assert.equal(report.complete, true);
  assert.equal(report.posts[0]!.error, undefined);
  assert.equal(report.links.length, 1);
  assert.equal(report.links[0]!.itemName, "Rene");
});

test("malformed checkpoints are not silently replaced", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "kdm-news-test-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  await writeFile(join(output, "shop-links.json"), "broken");
  await assert.rejects(loadReport(output));
  assert.equal(await readFile(join(output, "shop-links.json"), "utf8"), "broken");
});

test("CSV escapes scraped text and parser rejects challenge pages", () => {
  const report = newReport();
  report.links = [{ ...post, title: '=HYPERLINK("bad")', itemName: 'Aya, "Hero" ♥', shopUrl: shop + "aya" }];
  assert.match(csv(report), /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv(report), /"Aya, ""Hero"" ♥"/);
  assert.throws(() => pageData("<h1>Access denied</h1>"), /Missing __NEXT_DATA__/);
});
