import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { resolveConfig } from "prettier";
import { afterEach, expect, it, vi } from "vitest";
import { publishFiles, PublicationError } from "#scripts/catalog/publication.mts";
import { applyReview } from "#scripts/update-catalog.mts";
import { refreshAvailability } from "#scripts/refresh-catalog-availability.mts";
import { fillEditions } from "#scripts/fill-catalog-editions.mts";
import { catalogTemp } from "#scripts/catalog/paths.mts";
import { loadTags } from "#scripts/catalog/tags.mts";

// Faults and preparation races use internal dependencies; callers still use the real filesystem.
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
vi.mock("prettier", async (original) => {
  const actual = await original<typeof import("prettier")>();
  return { ...actual, resolveConfig: vi.fn(actual.resolveConfig) };
});

const actualFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
const actualPrettier = await vi.importActual<typeof import("prettier")>("prettier");
const roots: string[] = [];

afterEach(async () => {
  vi.mocked(rename).mockReset().mockImplementation(actualFs.rename);
  vi.mocked(resolveConfig).mockReset().mockImplementation(actualPrettier.resolveConfig);
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "catalog-publication-"));
  roots.push(root);
  return { root, path: join(root, "data.json") };
}

async function temporaryFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(root, entry.name);
        return entry.isDirectory() ? temporaryFiles(path) : entry.name.endsWith(".tmp") ? [path] : [];
      }),
    )
  ).flat();
}

it("publishes formatted JSON and archive bytes, then the completion report", async () => {
  const { root, path } = await fixture();
  await writeFile(path, "{}");
  const archivePath = join(root, "archive/review.json.gz");
  const reportPath = join(root, "report.json");
  const bytes = gzipSync("review");
  await publishFiles(
    [
      { path: archivePath, bytes },
      { path, json: { owned: true } },
      { path: reportPath, json: { complete: true } },
    ],
    { baselines: [{ path, text: "{}", message: "Catalog changed" }] },
  );
  expect(await readFile(archivePath)).toEqual(bytes);
  expect(await readFile(path, "utf8")).toBe('{ "owned": true }\n');
  expect(JSON.parse(await readFile(reportPath, "utf8"))).toEqual({ complete: true });
  expect(await temporaryFiles(root)).toEqual([]);
});

it("rejects an edit made during output preparation before publishing any destinations", async () => {
  const { root, path } = await fixture();
  await writeFile(path, "original");
  vi.mocked(resolveConfig).mockImplementationOnce(async () => {
    await writeFile(path, "user edit");
    return null;
  });
  await expect(
    publishFiles([{ path, json: {} }], { baselines: [{ path, text: "original", message: "Catalog changed" }] }),
  ).rejects.toMatchObject({ published: [], pending: [path], message: expect.stringContaining("Catalog changed") });
  expect(await readFile(path, "utf8")).toBe("user edit");
  expect(await temporaryFiles(root)).toEqual([]);
});

it("guards missing inputs against newly created files", async () => {
  const { root, path } = await fixture();
  const mappingPath = join(root, "mappings.json");
  await writeFile(mappingPath, "user mapping");
  await expect(
    publishFiles([{ path, json: {} }], { baselines: [{ path: mappingPath, text: undefined, message: "Mappings changed" }] }),
  ).rejects.toThrow("Mappings changed");
  await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(mappingPath, "utf8")).toBe("user mapping");
  expect(await temporaryFiles(root)).toEqual([]);
});

it("rejects deletion of an input, including for a no-op publication", async () => {
  const { path } = await fixture();
  await expect(publishFiles([], { baselines: [{ path, text: "original", message: "Catalog deleted" }] })).rejects.toThrow(
    "Catalog deleted",
  );
});

it("cleans staged files when a later output cannot be prepared", async () => {
  const { root, path } = await fixture();
  await writeFile(path, "original");
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  await expect(
    publishFiles([
      { path, json: {} },
      { path: join(root, "report.json"), json: cycle },
    ]),
  ).rejects.toMatchObject({ published: [] });
  expect(await readFile(path, "utf8")).toBe("original");
  expect(await temporaryFiles(root)).toEqual([]);
});

it("reports partial publication and leaves a completion report unchanged after a rename failure", async () => {
  const { root, path } = await fixture();
  const reportPath = join(root, "report.json");
  await writeFile(path, "original");
  await writeFile(reportPath, '{"complete":false}');
  const fault = new Error("Disk write failed");
  vi.mocked(rename).mockImplementation(async (source, target) => {
    if (target === reportPath) throw fault;
    return actualFs.rename(source, target);
  });
  await expect(
    publishFiles([
      { path, json: { updated: true } },
      { path: reportPath, json: { complete: true } },
    ]),
  ).rejects.toMatchObject({
    published: [path],
    pending: [reportPath],
    cause: fault,
    cleanupFailures: [],
  });
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ updated: true });
  expect(JSON.parse(await readFile(reportPath, "utf8"))).toEqual({ complete: false });
  expect(await temporaryFiles(root)).toEqual([]);
});

it("preserves edits made between replacements and reports the files already published", async () => {
  const { root, path } = await fixture();
  const mappingPath = join(root, "mappings.json");
  await writeFile(path, "original");
  vi.mocked(rename).mockImplementation(async (source, target) => {
    await actualFs.rename(source, target);
    if (target === mappingPath) await writeFile(path, "user edit");
  });
  await expect(
    publishFiles(
      [
        { path: mappingPath, json: {} },
        { path, json: {} },
      ],
      { baselines: [{ path, text: "original", message: "Catalog changed" }] },
    ),
  ).rejects.toMatchObject({ published: [mappingPath], pending: [path] });
  expect(await readFile(path, "utf8")).toBe("user edit");
  expect(await temporaryFiles(root)).toEqual([]);
});

it("stops publication if an already published guarded output is edited", async () => {
  const { root, path } = await fixture();
  const reportPath = join(root, "report.json");
  await writeFile(path, "original");
  vi.mocked(rename).mockImplementation(async (source, target) => {
    await actualFs.rename(source, target);
    if (target === path) await writeFile(path, "user edit");
  });
  await expect(
    publishFiles(
      [
        { path, json: {} },
        { path: reportPath, json: {} },
      ],
      { baselines: [{ path, text: "original", message: "Catalog changed" }] },
    ),
  ).rejects.toMatchObject({ published: [path], pending: [reportPath] });
  expect(await readFile(path, "utf8")).toBe("user edit");
  await expect(readFile(reportPath)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await temporaryFiles(root)).toEqual([]);
});

it("cleans staged files when cancellation happens during preparation", async () => {
  const { root, path } = await fixture();
  const controller = new AbortController();
  await writeFile(path, "original");
  vi.mocked(resolveConfig)
    .mockImplementationOnce(actualPrettier.resolveConfig)
    .mockImplementationOnce(async () => {
      controller.abort();
      return null;
    });
  await expect(
    publishFiles(
      [
        { path, json: {} },
        { path: join(root, "report.json"), json: {} },
      ],
      { signal: controller.signal },
    ),
  ).rejects.toBeInstanceOf(PublicationError);
  expect(await readFile(path, "utf8")).toBe("original");
  expect(await temporaryFiles(root)).toEqual([]);
});

it("reports cancellation after a completed replacement without rolling it back", async () => {
  const { root, path } = await fixture();
  const controller = new AbortController();
  const reportPath = join(root, "report.json");
  vi.mocked(rename).mockImplementation(async (source, target) => {
    await actualFs.rename(source, target);
    controller.abort();
  });
  await expect(
    publishFiles(
      [
        { path, json: {} },
        { path: reportPath, json: {} },
      ],
      { signal: controller.signal },
    ),
  ).rejects.toMatchObject({
    published: [path],
    pending: [reportPath],
    cause: expect.objectContaining({ name: "AbortError" }),
  });
  expect(await readFile(path, "utf8")).toBe("{}\n");
  await expect(readFile(reportPath)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await temporaryFiles(root)).toEqual([]);
});

it("rejects duplicate resolved destinations before preparing output", async () => {
  const { root, path } = await fixture();
  await expect(
    publishFiles([
      { path, json: {} },
      { path: join(root, "nested/../data.json"), json: {} },
    ]),
  ).rejects.toThrow("repeats an output path");
  expect(await readdir(root)).toEqual([]);
});

async function catalogFixture(editions = true) {
  const { root } = await fixture();
  const folder = join(root, "static/kdm-catalog");
  await mkdir(folder, { recursive: true });
  const path = join(folder, "data.json");
  const catalog = {
    content: {
      example: {
        name: "Example",
        kind: "model",
        tags: ["generic"],
        handle: "example",
        ...(editions ? { editions: [{ id: "resin", label: "Resin", format: "physical" as const, materials: ["Resin"] }] } : {}),
      },
    },
    "included-only": {},
    accessories: {},
    bundles: {},
    homebrew: {},
  };
  const original = JSON.stringify(catalog);
  await writeFile(path, original);
  await writeFile(join(folder, "data.schema.json"), await readFile("static/kdm-catalog/data.schema.json"));
  const newsPath = join(root, "exports/kingdom-death-news/news-shop-links.json");
  await mkdir(dirname(newsPath), { recursive: true });
  await writeFile(newsPath, '{"links":[]}');
  return { root, folder, path, catalog, original, newsPath };
}

it.each(["catalog", "schema", "news", "mappings", "tags", "tag schema", "merge report"])(
  "review application preserves a late edit to %s and publishes nothing",
  async (input) => {
    const { root, folder, path, catalog, original, newsPath } = await catalogFixture();
    const master = await loadTags(folder);
    const hash = (text: string) => createHash("sha256").update(text).digest("hex");
    const targets = {
      catalog: path,
      schema: join(folder, "data.schema.json"),
      news: newsPath,
      mappings: join(catalogTemp(folder), "shopify-products/kdm-shop-mappings.json"),
      tags: join(catalogTemp(folder), "kdm-tags.json"),
      "tag schema": join(catalogTemp(folder), "kdm-tags.schema.json"),
      "merge report": join(catalogTemp(folder), "reports/kdm-merge-report.json"),
    };
    const target = targets[input as keyof typeof targets];
    vi.mocked(resolveConfig).mockImplementationOnce(async () => {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, "late user edit");
      return null;
    });
    await expect(
      applyReview(
        {
          baselineHash: hash(original),
          schemaHash: hash(await readFile(targets.schema, "utf8")),
          newsHash: hash(await readFile(newsPath, "utf8")),
          tagsHash: hash(master.text),
          tagSchemaHash: hash(master.schemaText),
          changes: [
            {
              category: "content",
              itemId: "example",
              before: catalog.content.example,
              after: { ...catalog.content.example, description: "Reviewed" },
            },
          ],
          unresolved: [],
        },
        folder,
        newsPath,
      ),
    ).rejects.toMatchObject({ published: [] });
    expect(await readFile(target, "utf8")).toBe("late user edit");
    if (input !== "catalog") expect(await readFile(path, "utf8")).toBe(original);
    expect(await temporaryFiles(root)).toEqual([]);
  },
);

const product = {
  id: 1,
  title: "Example",
  handle: "example",
  description: "Resin miniature.",
  variants: [{ id: 1, title: "Resin", price: 1000, requires_shipping: true, available: true }],
};

it("availability refresh preserves an edit made while preparing its publication", async () => {
  const { root, path } = await catalogFixture();
  vi.mocked(resolveConfig).mockImplementationOnce(async () => {
    await writeFile(path, "late user edit");
    return null;
  });
  await expect(
    refreshAvailability({
      catalog: path,
      client: { get: async (url) => ({ url, checkedAt: "2026-10-09", data: { products: [product] } }) },
    }),
  ).rejects.toMatchObject({ published: [] });
  expect(await readFile(path, "utf8")).toBe("late user edit");
  await expect(readFile(join(root, "temp/kdm-catalog/reports/availability-refresh.json"))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await temporaryFiles(root)).toEqual([]);
});

it("edition retrieval preserves mappings created during final publication preparation", async () => {
  const { root, path, folder, original } = await catalogFixture(false);
  const mappingsPath = join(catalogTemp(folder), "shopify-products/kdm-shop-mappings.json");
  vi.mocked(resolveConfig).mockImplementation(async (target, options) => {
    if (target === mappingsPath) {
      await mkdir(dirname(mappingsPath), { recursive: true });
      await writeFile(mappingsPath, "late mapping edit");
    }
    return actualPrettier.resolveConfig(target, options);
  });
  await expect(
    fillEditions({ catalog: path, client: { get: async (url) => ({ url, checkedAt: "2026-10-09", data: product }) } }),
  ).rejects.toMatchObject({ published: [] });
  expect(await readFile(path, "utf8")).toBe(original);
  expect(await readFile(mappingsPath, "utf8")).toBe("late mapping edit");
  const report = JSON.parse(await readFile(join(catalogTemp(folder), "reports/edition-retrieval.json"), "utf8"));
  expect(report.complete).toBe(false);
  expect(report.applied).toBe(false);
  expect(await temporaryFiles(root)).toEqual([]);
});
