import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fillEditions, productEditions } from "../scripts/fill-catalog-editions.mts";
import { shopProduct } from "../scripts/catalog/shop.mts";

const raw = {
  id: 1,
  title: "Example",
  handle: "example",
  description: "Photoresin miniature. First run edition limited to 500.",
  variants: [
    { id: 11, title: "First Run / US Warehouse", price: 3000, compare_at_price: 4000, requires_shipping: true, available: false },
    { id: 12, title: "First Run / UK Warehouse", price: 3200, requires_shipping: true, available: true },
    { id: 13, title: "Encore", price: 3000, requires_shipping: true, available: false },
  ],
};

test("edition retrieval groups warehouses, preserves Ajax cents, and keeps release selectors", () => {
  const result = productEditions({ name: "Example", tags: ["generic"], releaseDate: "2025-01-01" }, shopProduct(raw, "ajax"));
  assert.deepEqual(result.selectors, { 11: "First Run", 12: "First Run", 13: "Encore" });
  assert.equal(result.editions.length, 2);
  assert.deepEqual(result.editions[0]?.$, [3000, 3200, 4000]);
  assert.equal(result.editions[0]?.runSize, 500);
  assert.equal(result.editions[0]?.available, true);
  assert.equal(result.editions[1]?.available, undefined);
  assert.equal(result.editions[1]?.r, "2025-01-01");
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "edition-retrieval-"));
  const folder = join(root, "exports/kdm-catalog");
  await mkdir(folder, { recursive: true });
  await mkdir(join(root, "exports/kingdom-death-news"), { recursive: true });
  const path = join(folder, "kdm-data.json");
  await writeFile(
    path,
    JSON.stringify({
      content: { example: { name: "Example", kind: "model", tags: ["generic"], releaseDate: "2025-01-01", url: "/products/example" } },
      accessories: {},
      bundles: {},
      homebrew: {},
      "included-only": {},
    }),
  );
  await writeFile(join(folder, "kdm-data.schema.json"), await readFile("exports/kdm-catalog/kdm-data.schema.json"));
  await writeFile(join(root, "exports/kingdom-death-news/news-shop-links.json"), JSON.stringify({ links: [] }));
  return { root, path };
}

test("retrieval writes editions and mappings while failed listings retain their item facts", async () => {
  const { root, path } = await fixture();
  try {
    const failed = await fillEditions({
      catalog: path,
      client: {
        get: async () => {
          throw new Error("HTTP 404");
        },
      },
    });
    assert.equal(failed.unreachable.length, 1);
    assert.equal(JSON.parse(await readFile(path, "utf8")).content.example.releaseDate, "2025-01-01");
    const success = await fillEditions({ catalog: path, client: { get: async (url) => ({ url, checkedAt: "2026-10-04", data: raw }) } });
    assert.equal(success.reachable.length, 1);
    const item = JSON.parse(await readFile(path, "utf8")).content.example;
    assert.equal(item.releaseDate, undefined);
    assert.equal(item.editions.length, 2);
    const mappings = JSON.parse(await readFile(join(root, "temp/kdm-catalog/shopify-products/kdm-shop-mappings.json"), "utf8"));
    assert.equal(mappings.example.variantEditions[13], "Encore");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("retrieval refuses to overwrite edits made during product downloads", async () => {
  const { root, path } = await fixture();
  try {
    const updated = JSON.parse(await readFile(path, "utf8"));
    updated.content.example.notes = "User edit";
    await assert.rejects(
      fillEditions({
        catalog: path,
        client: {
          get: async (url) => {
            await writeFile(path, JSON.stringify(updated));
            return { url, checkedAt: "2026-10-04", data: raw };
          },
        },
      }),
      /changed during retrieval/,
    );
    assert.equal(JSON.parse(await readFile(path, "utf8")).content.example.notes, "User edit");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
