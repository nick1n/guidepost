import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { captureInputs, digest, loadMappings } from "#scripts/catalog/inputs.mts";
import { catalogData } from "#scripts/catalog/paths.mts";
import { publishFiles } from "#scripts/catalog/publication.mts";
import { tagSchema } from "#scripts/catalog/tags.mts";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "catalog-inputs-"));
  roots.push(directory);
  const root = join(directory, "static/kdm/catalog");
  await mkdir(root, { recursive: true });
  await mkdir(catalogData(root), { recursive: true });
  const catalog = {
    content: { lantern: { name: "Lantern", tags: ["gear"] } },
    "included-only": {},
    bundles: {},
    homebrew: {},
    accessories: {},
  };
  await writeFile(join(root, "data.json"), JSON.stringify(catalog));
  await writeFile(join(root, "data.schema.json"), "{}");
  return root;
}

it("derives fallback tags from the captured catalog and keeps generated schemas separate from physical inputs", async () => {
  const root = await fixture();
  const physicalSchema = JSON.stringify(tagSchema(["unrelated"]));
  await writeFile(join(catalogData(root), "tags.schema.json"), physicalSchema);
  const capture = await captureInputs(root);
  expect(capture.master.tags.content.lantern).toEqual(capture.catalog.content.lantern!.tags);
  expect(capture.master.reviewed).toBe(false);
  expect(JSON.parse(capture.master.schemaText).$defs.tag.enum).toEqual(["gear", "in-stock"]);
  expect(capture.sources.tagSchema.text).toBe(physicalSchema);
  expect(capture.sources.tags.text).toBeUndefined();
  expect(capture.sources.catalog.hash).toBe(digest(capture.sources.catalog.text));
  await publishFiles([], { baselines: capture.baselines });
});

it.each(["catalog", "schema", "mappings", "tags", "tagSchema"] as const)(
  "guards changes and creation of captured %s files",
  async (key) => {
    const root = await fixture();
    const capture = await captureInputs(root);
    await writeFile(capture.sources[key].path, "changed");
    await expect(publishFiles([], { baselines: capture.baselines })).rejects.toThrow("changed; regenerate");
  },
);

it("guards deletion of an existing optional input and preserves exact empty text", async () => {
  const root = await fixture();
  const path = join(catalogData(root), "tags.schema.json");
  await writeFile(path, "");
  const capture = await captureInputs(root);
  expect(capture.sources.tagSchema.text).toBe("");
  await rm(path);
  await expect(publishFiles([], { baselines: capture.baselines })).rejects.toThrow("Tag schema changed");
});

it("validates local tags instead of silently falling back for empty or invalid files", async () => {
  const root = await fixture();
  const path = join(catalogData(root), "tags.json");
  await writeFile(path, "{}");
  await expect(captureInputs(root)).rejects.toThrow("Master tags require");
  await writeFile(join(dirname(path), "tags.schema.json"), JSON.stringify(tagSchema(["gear"])));
  await expect(captureInputs(root)).rejects.toThrow("Master tag errors");
  await writeFile(path, "");
  await expect(captureInputs(root)).rejects.toThrow();
});

it("uses reviewed local tags with their exact schema rather than catalog fallback tags", async () => {
  const root = await fixture();
  const dataRoot = catalogData(root);
  const tags = {
    $schema: "./tags.schema.json",
    content: { lantern: ["reviewed"] },
    "included-only": {},
    bundles: {},
    homebrew: {},
    accessories: {},
  };
  const text = JSON.stringify(tags, null, 2);
  const schemaText = JSON.stringify(tagSchema(["reviewed"]), null, 2);
  await writeFile(join(dataRoot, "tags.json"), text);
  await writeFile(join(dataRoot, "tags.schema.json"), schemaText);
  const capture = await captureInputs(root);
  expect(capture.master.reviewed).toBe(true);
  expect(capture.master.tags.content.lantern).toEqual(["reviewed"]);
  expect(capture.catalog.content.lantern!.tags).toEqual(["gear"]);
  expect(capture.master.text).toBe(text);
  expect(capture.master.schemaText).toBe(schemaText);
  await publishFiles([], { baselines: capture.baselines });
});

it("loads optional mappings through the same strict parser as captured inputs", async () => {
  const root = await fixture();
  expect(await loadMappings(root)).toEqual({});
  const path = join(catalogData(root), "shop-mappings.json");
  await writeFile(path, JSON.stringify({ lantern: { category: "content", itemId: "lantern", editionId: "resin" } }));
  expect(await loadMappings(root)).toEqual((await captureInputs(root)).mappings);
  await writeFile(path, JSON.stringify({ lantern: { category: "content", itemId: "lantern", edition: "Resin" } }));
  await expect(loadMappings(root)).rejects.toThrow("Invalid mappings");
});

it.each(["workbook-map.json", "workbook-map.schema.json"])("guards creation, changes, and deletion of %s", async (name) => {
  const root = await fixture();
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  const absent = await captureInputs(root);
  await writeFile(path, "original");
  await expect(publishFiles([], { baselines: absent.baselines })).rejects.toThrow("Workbook");
  const existing = await captureInputs(root);
  await writeFile(path, "changed");
  await expect(publishFiles([], { baselines: existing.baselines })).rejects.toThrow("Workbook");
  await rm(path);
  await expect(publishFiles([], { baselines: existing.baselines })).rejects.toThrow("Workbook");
});
