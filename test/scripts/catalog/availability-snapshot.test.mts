import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";
import { refreshAvailability } from "#scripts/catalog/commands/refresh-catalog-availability.mts";

const pageDate = new Date("2026-10-06T00:00:00.000Z");
const product = {
  id: 1,
  title: "Example",
  handle: "example",
  description: "",
  variants: [
    { id: 1, title: "HQ Warehouse (USA) - First Run Collectors Edition", price: "70.00", requires_shipping: true, available: false },
    { id: 2, title: "Encore Edition- HQ Warehouse (USA)", price: "70.00", requires_shipping: true, available: true },
  ],
};
const noNetwork = {
  get: async () => {
    throw new Error("Unexpected network request");
  },
};
async function fixture(run: (paths: { root: string; catalog: string; folder: string; original: string }) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "guidepost-availability-snapshot-"));
  try {
    const catalog = join(root, "static/kdm/catalog/data.json");
    const folder = join(root, ".cache/kdm-catalog/shopify-products");
    await mkdir(dirname(catalog), { recursive: true });
    await mkdir(folder, { recursive: true });
    for (const page of [1, 2]) {
      const path = join(folder, "products-page-" + page + ".json");
      await writeFile(path, JSON.stringify({ products: page === 2 ? [product] : [] }));
      await utimes(path, pageDate, pageDate);
    }
    const original = JSON.stringify({
      content: {
        example: {
          name: "Example",
          handle: "example",
          tags: ["model"],
          editions: [
            { id: "first-run", label: "Painters: First Run" },
            { id: "encore", label: "Painters: Encore" },
          ],
        },
      },
      accessories: {},
      bundles: {},
      "included-only": {},
      homebrew: { files: { name: "Files", tags: ["homebrew"], editions: [{ id: "files", label: "3D Files", available: true }] } },
    });
    await writeFile(catalog, original);
    await run({ root, catalog, folder, original });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

it("defaults to both saved pages and ignores all individual product caches", async () => {
  await fixture(async ({ root, catalog, folder }) => {
    for (const directory of [join(root, ".cache/kdm-shop"), join(folder, "edition-cache")]) {
      await mkdir(directory, { recursive: true });
      for (const extension of ["js", "json"]) {
        const url = "https://shop.kingdomdeath.com/products/example." + extension;
        await writeFile(join(directory, createHash("sha256").update(url).digest("hex") + ".json"), "invalid JSON");
      }
    }
    const result = await refreshAvailability({ catalog, client: noNetwork });
    const saved = JSON.parse(await readFile(catalog, "utf8"));
    expect(
      saved.content.example.editions.map((edition: { shop: string; available?: boolean }) => [edition.shop, edition.available]),
    ).toEqual([
      ["out-of-stock", undefined],
      ["in-stock", true],
    ]);
    expect(saved.content.example.tags).toContain("in-stock");
    expect(saved.homebrew.files.editions[0].available).toBe(true);
    expect(saved.shopUpdated).toBe("2026-10-06");
    expect(result.pages).toBe(2);
  });
});

it("explicit fetch requests only pages one and two and refreshes those caches", async () => {
  await fixture(async ({ catalog, folder }) => {
    const urls: string[] = [];
    const soldOut = { ...product, variants: product.variants.map((variant) => ({ ...variant, available: false })) };
    await refreshAvailability({
      catalog,
      offline: false,
      client: {
        get: async (url) => {
          urls.push(url);
          return { url, checkedAt: "2026-10-15T00:00:00.000Z", data: { products: urls.length === 1 ? [soldOut] : [] } };
        },
      },
    });
    expect(urls).toEqual([
      "https://shop.kingdomdeath.com/products.json?limit=250&page=1",
      "https://shop.kingdomdeath.com/products.json?limit=250&page=2",
    ]);
    expect(JSON.parse(await readFile(join(folder, "products-page-1.json"), "utf8")).products).toEqual([soldOut]);
    expect(JSON.parse(await readFile(join(folder, "products-page-2.json"), "utf8")).products).toEqual([]);
    expect(JSON.parse(await readFile(catalog, "utf8")).content.example.editions[1].shop).toBe("out-of-stock");
  });
});

it("missing page two never triggers a fallback request or changes the catalog", async () => {
  await fixture(async ({ catalog, folder, original }) => {
    await unlink(join(folder, "products-page-2.json"));
    await expect(refreshAvailability({ catalog, client: noNetwork })).rejects.toThrow("catalog:availability --fetch");
    expect(await readFile(catalog, "utf8")).toBe(original);
  });
});

it("a failed second download preserves both cached pages and catalog", async () => {
  await fixture(async ({ catalog, folder, original }) => {
    const paths = [1, 2].map((page) => join(folder, "products-page-" + page + ".json"));
    const previous = await Promise.all(paths.map((path) => readFile(path, "utf8")));
    await expect(
      refreshAvailability({
        catalog,
        offline: false,
        client: {
          get: async (url) => {
            if (url.endsWith("page=2")) throw new Error("Download failed");
            return { url, checkedAt: "2026-10-15T00:00:00.000Z", data: { products: [product] } };
          },
        },
      }),
    ).rejects.toThrow("Download failed");
    expect(await Promise.all(paths.map((path) => readFile(path, "utf8")))).toEqual(previous);
    expect(await readFile(catalog, "utf8")).toBe(original);
  });
});

it("incomplete variant availability cannot overwrite the catalog", async () => {
  await fixture(async ({ catalog, folder, original }) => {
    const incomplete = structuredClone(product);
    Reflect.deleteProperty(incomplete.variants[1], "available");
    await writeFile(join(folder, "products-page-2.json"), JSON.stringify({ products: [incomplete] }));
    await expect(refreshAvailability({ catalog, client: noNetwork })).rejects.toThrow("Missing variant availability on page 2");
    expect(await readFile(catalog, "utf8")).toBe(original);
  });
});

it("refuses a potentially truncated snapshot without requesting a third page", async () => {
  await fixture(async ({ catalog, original }) => {
    const urls: string[] = [];
    await expect(
      refreshAvailability({
        catalog,
        offline: false,
        client: {
          get: async (url) => {
            urls.push(url);
            return { url, checkedAt: "2026-10-15T00:00:00.000Z", data: { products: Array.from({ length: 250 }, () => product) } };
          },
        },
      }),
    ).rejects.toThrow("exceeds two pages");
    expect(urls).toHaveLength(2);
    expect(await readFile(catalog, "utf8")).toBe(original);
  });
});
