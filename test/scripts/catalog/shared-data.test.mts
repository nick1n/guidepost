import { access, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { captureInputs, loadMappings } from "#scripts/catalog/inputs.mts";
import { catalogData } from "#scripts/catalog/paths.mts";
import { prepareUpdate } from "#scripts/catalog/review/prepare.mts";
import { applyReview } from "#scripts/catalog/review/apply.mts";
import { validateCatalog } from "#scripts/catalog/validate.mts";
import { writeWorkbookMap } from "#scripts/catalog/workbook/map.mts";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "kdm-shared-state-"));
  roots.push(root);
  const catalog = join(root, "static/kdm/catalog");
  const news = join(root, "scripts/news");
  await mkdir(catalog, { recursive: true });
  await mkdir(news, { recursive: true });
  await cp("scripts/catalog/data", catalogData(catalog), { recursive: true });
  for (const name of ["data.json", "data.schema.json", "workbook-map.json", "workbook-map.schema.json"])
    await copyFile(join("static/kdm/catalog", name), join(catalog, name));
  await copyFile("scripts/news/shop-links.json", join(news, "shop-links.json"));
  return { root, catalog, news };
}

it("validates, maintains workbook mappings, and stages/applies updates without preexisting local-data", async () => {
  const f = await fixture();
  const mapPath = join(f.catalog, "workbook-map.json");
  const originalMap = await readFile(mapPath, "utf8");
  const capture = await captureInputs(f.catalog);
  expect(capture.master.reviewed).toBe(true);
  expect(Object.keys(capture.mappings).length).toBeGreaterThan(0);
  expect((await validateCatalog(capture.catalog, join(f.catalog, "data.schema.json"))).importRows).toBeGreaterThan(0);
  await writeWorkbookMap(f.root);
  expect(JSON.parse(await readFile(mapPath, "utf8"))).toEqual(JSON.parse(originalMap));
  const checkpoint = JSON.parse(await readFile(join(f.news, "shop-links.json"), "utf8"));
  const post = checkpoint.posts.find((entry: { status: string; error?: string }) => entry.status === "read" && !entry.error);
  const newsUrl = "https://kingdomdeath.com/news";
  const importsPath = join(catalogData(f.catalog), "news-imports.json");
  const imported = JSON.parse(await readFile(importsPath, "utf8"));
  const prepared = await prepareUpdate({
    catalog: f.catalog,
    news: f.news,
    newsCache: join(f.root, ".cache/news"),
    fetch: true,
    downloader: {
      requests: 0,
      async get(url) {
        if (url !== newsUrl) throw new Error("Already imported announcements must not be requested again");
        const index = { stories: [{ date: post.date, title: post.title, slug: post.postUrl.split("/").at(-1) }] };
        return `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { data: index } } })}</script>`;
      },
    },
    client: {
      async get(url) {
        const product = {
          id: 1,
          title: "Internal test",
          handle: "another-preorder-item-test",
          variants: [{ id: 1, title: "US Warehouse", price: "0.00", requires_shipping: true, available: false }],
        };
        return { url, checkedAt: "2026-11-01T00:00:00Z", data: { products: url.endsWith("page=1") ? [product] : [] } };
      },
      async product() {
        throw new Error("Already imported listings must not be requested again");
      },
    },
  });
  expect(prepared.announcements).toBe(0);
  expect(prepared.review.unresolved).toEqual([]);
  await expect(access(join(f.root, "local-data"))).rejects.toMatchObject({ code: "ENOENT" });
  await applyReview(prepared.review, f.catalog, join(f.news, "shop-links.json"));
  expect(JSON.parse(await readFile(importsPath, "utf8"))).toEqual(imported);
  await expect(access(join(f.root, "local-data/kdm-catalog/imports"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("reads shared decisions and ignores conflicting private copies", async () => {
  const f = await fixture();
  const expected = JSON.parse(await readFile(join(catalogData(f.catalog), "shop-mappings.json"), "utf8"));
  const privateFolder = join(f.root, "local-data/kdm-catalog");
  await mkdir(privateFolder, { recursive: true });
  await writeFile(join(privateFolder, "kdm-shop-mappings.json"), "invalid JSON");
  expect(await loadMappings(f.catalog)).toEqual(expected);
});
