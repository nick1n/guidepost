import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { importTarget, readImports } from "#scripts/catalog/workbook/imports.mts";
import { validateCatalog } from "#scripts/catalog/validate.mts";
import { catalogData } from "#scripts/catalog/paths.mts";
import { buildWorkbookMap, readWorkbookMap } from "#scripts/catalog/workbook/map.mts";
import type { Catalog } from "#scripts/catalog/types.mts";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const reference = { category: "content" as const, itemId: "example", editionId: "stable-id" };

function catalog(): Catalog {
  return {
    content: { example: { name: "Example", tags: ["generic"], editions: [{ id: "stable-id", label: "Box", format: "physical" }] } },
    accessories: {},
    bundles: {},
    homebrew: {},
    "included-only": {},
  };
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "kdm-import-ids-"));
  roots.push(root);
  const catalogRoot = join(root, "static/kdm/catalog");
  const folder = catalogData(catalogRoot);
  await mkdir(catalogRoot, { recursive: true });
  await mkdir(folder, { recursive: true });
  const schemaPath = join(catalogRoot, "data.schema.json");
  await writeFile(schemaPath, await readFile("static/kdm/catalog/data.schema.json"));
  const privateFolder = join(root, "local-data/kdm-catalog/imports");
  await mkdir(privateFolder, { recursive: true });
  const sourcePath = join(privateFolder, "kdm-import-records.json");
  const schema = { type: "object", required: ["workbook", "records"] };
  const importSchemaPath = join(folder, "import-records.schema.json");
  await writeFile(importSchemaPath, JSON.stringify(schema));
  const source = { workbook: "Example.xlsx", records: [{ sheet: "KDM Miniatures" as const, row: 2, name: "Example", ...reference }] };
  await writeFile(sourcePath, JSON.stringify(source));
  const mapPath = join(catalogRoot, "workbook-map.json");
  const map = buildWorkbookMap(source, catalog());
  await writeFile(mapPath, JSON.stringify(map));
  return { catalogRoot, catalog: catalog(), schemaPath, source, sourcePath, importSchemaPath, mapPath, map };
}

it("validates retained references after a label rename without changing the import records", async () => {
  const f = await fixture();
  const original = await readFile(f.sourcePath, "utf8");
  expect((await validateCatalog(f.catalog, f.schemaPath)).importRows).toBe(1);
  f.catalog.content.example!.editions![0]!.label = "Encore";
  expect((await validateCatalog(f.catalog, f.schemaPath)).importRows).toBe(1);
  expect(await readFile(f.sourcePath, "utf8")).toBe(original);
  f.catalog.content.example!.editions![0]!.id = "replacement";
  await expect(validateCatalog(f.catalog, f.schemaPath)).rejects.toThrow("example/stable-id");
});

it("checks primary, related, and release-column references by ID", async () => {
  const f = await fixture();
  for (const field of ["related", "releaseEditions"]) {
    const invalid = { ...f.map.rows[0]!.primary, editionId: "missing" };
    const record = { ...f.map.rows[0], ownershipScope: "source-row", [field]: field === "related" ? [invalid] : { M: [invalid] } };
    await writeFile(f.mapPath, JSON.stringify({ ...f.map, rows: [record] }));
    await expect(validateCatalog(f.catalog, f.schemaPath)).rejects.toThrow("example/missing");
  }
});

it("rejects label-only references instead of selecting a different edition", async () => {
  const f = await fixture();
  const { editionId: _, ...old } = reference;
  await writeFile(
    f.sourcePath,
    JSON.stringify({ ...f.source, records: [{ ...f.source.records[0], ...old, editionId: undefined, edition: "Box" }] }),
  );
  await expect(
    readImports(f.sourcePath, f.importSchemaPath).then((source) => importTarget(source.imports.records[0]!, f.catalog)),
  ).rejects.toThrow("replace edition labels with editionId");
});

it("checks synthetic item and bundle IDs against edition-less products", () => {
  const data = catalog();
  data.bundles.example = { name: "Example bundle", tags: [] };
  data.accessories.example = { name: "Example accessory", tags: [] };
  for (const [category, editionId] of [
    ["bundles", "bundle"],
    ["accessories", "item"],
  ] as const) {
    expect(importTarget({ category, itemId: "example", editionId }, data).editionId).toBe(editionId);
    expect(() => importTarget({ category, itemId: "example", editionId: "missing" }, data)).toThrow("Unknown workbook edition");
  }
});

it("requires explicit imports and validates their tracked schema", async () => {
  const f = await fixture();
  await writeFile(f.sourcePath, JSON.stringify({ records: [] }));
  await expect(readImports(f.sourcePath, f.importSchemaPath)).rejects.toThrow("Workbook import schema errors");
  await rm(f.sourcePath);
  await expect(readImports(f.sourcePath, f.importSchemaPath)).rejects.toMatchObject({ code: "ENOENT" });
  await rm(f.mapPath);
  expect(await readWorkbookMap(f.catalogRoot, f.catalog)).toBeUndefined();
  expect((await validateCatalog(f.catalog, f.schemaPath)).importRows).toBe(0);
});

it("default validation ignores private import records", async () => {
  const f = await fixture();
  await writeFile(f.sourcePath, "invalid private input");
  expect((await validateCatalog(f.catalog, f.schemaPath)).importRows).toBe(1);
});
