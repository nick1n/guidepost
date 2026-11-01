import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { parseMappings } from "#scripts/catalog/mappings.mts";
import { captureInputs } from "#scripts/catalog/inputs.mts";
import { fillEditions } from "#scripts/catalog/commands/fill-catalog-editions.mts";
import { catalogTemp, catalogData } from "#scripts/catalog/paths.mts";
import { CatalogInputError } from "#scripts/catalog/review/schema.mts";
import type { Mapping } from "#scripts/catalog/types.mts";

const base = { category: "content", itemId: "lantern" };
const path = "fixture/shop-mappings.json";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

it("preserves retired, stable ID, variant, and creation facts", () => {
  const mappings = {
    lantern: {
      ...base,
      editionId: "first-run",
      variantEditionIds: { "42048655753399": "first-run" },
      variantIds: [42048655753399],
      retired: "Reviewed replacement listing",
      gameplay: false,
      materials: ["Resin"],
      replaceUrl: true,
      releaseDate: "2025-11-28",
    },
    newcomer: {
      ...base,
      editionLabel: "Encore",
      create: {
        name: "New lantern",
        tags: ["gear"],
        kind: "model",
        includes: [{ item: "another-item", editionId: "plastic" }],
        editions: [{ label: "Encore", materials: ["Resin"] }],
        reviewedFact: { preserved: true },
      },
    },
  };
  const decoded: Record<string, Mapping> = parseMappings(JSON.stringify(mappings), path);
  expect(decoded).toEqual(mappings);
  expect(parseMappings(undefined, path)).toEqual({});
});

it.each([
  { edition: "Encore" },
  { variantEditions: { "123": "Encore" } },
  { edtionId: "first-run" },
  { retired: "" },
  { retired: "  \n" },
  { retired: true },
  { retired: { reason: "old" } },
  { editionId: "first-run", editionLabel: "Encore" },
  { editionId: "First Run" },
  { itemId: "bad_id" },
  { variantIds: [0] },
  { variantIds: [1.5] },
  { variantIds: [Number.MAX_SAFE_INTEGER + 1] },
  { variantIds: ["123"] },
  { variantEditionIds: { "01": "first-run" } },
  { variantEditionIds: { default: "first-run" } },
  { variantEditionIds: { "9007199254740992": "first-run" } },
  { variantEditionIds: { "123": "First Run" } },
  { category: "models" },
  { gameplay: "true" },
  { materials: "Resin" },
  { materials: [false] },
  { replaceUrl: 1 },
  { releaseDate: 2025 },
  { create: {} },
  { create: { name: false } },
  { create: [] },
])("rejects invalid mapping fields: %j", (fields) => {
  expect(() => parseMappings(JSON.stringify({ lantern: { ...base, ...fields } }), path)).toThrow(CatalogInputError);
});

it.each([null, [], true, { lantern: [] }, { lantern: null }, { lantern: { itemId: "lantern" } }])(
  "rejects invalid structural input: %j",
  (value) => {
    expect(() => parseMappings(JSON.stringify(value), path)).toThrow(CatalogInputError);
  },
);

it("reports the file and field with the original validation cause", () => {
  try {
    parseMappings(JSON.stringify({ lantern: { ...base, retired: false } }), path);
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(CatalogInputError);
    expect(error).toMatchObject({ message: expect.stringContaining(path), cause: expect.any(Error) });
    expect((error as CatalogInputError).message).toContain("retired");
  }
});

it.each(["", "{", '{"lantern":}'])("wraps malformed JSON with its path and syntax cause: %j", (text) => {
  expect(() => parseMappings(text, path)).toThrow(
    expect.objectContaining({
      _tag: "CatalogInputError",
      message: expect.stringContaining(path),
      cause: expect.any(SyntaxError),
    }),
  );
});

async function fixture(text: string) {
  const directory = await mkdtemp(join(tmpdir(), "catalog-mappings-"));
  roots.push(directory);
  const root = join(directory, "static/kdm/catalog");
  await mkdir(root, { recursive: true });
  await mkdir(catalogData(root), { recursive: true });
  await writeFile(join(root, "data.json"), JSON.stringify({ content: { lantern: { name: "Lantern", tags: [] } } }));
  await writeFile(join(root, "data.schema.json"), "{}");
  await writeFile(join(catalogData(root), "shop-mappings.json"), text);
  return root;
}

it("validates capture inputs before loading tags, retaining the mapping path", async () => {
  const root = await fixture(JSON.stringify({ lantern: { ...base, retired: false } }));
  await writeFile(join(catalogData(root), "tags.json"), "invalid tag JSON");
  await expect(captureInputs(root)).rejects.toMatchObject({
    _tag: "CatalogInputError",
    message: expect.stringContaining(join(catalogData(root), "shop-mappings.json")),
  });
});

it("rejects mappings before edition retrieval requests or output", async () => {
  const root = await fixture("{");
  const get = vi.fn();
  await expect(fillEditions({ catalog: join(root, "data.json"), client: { get } })).rejects.toBeInstanceOf(CatalogInputError);
  expect(get).not.toHaveBeenCalled();
  await expect(readdir(catalogTemp(root))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(join(catalogData(root), "shop-mappings.json"), "utf8")).toBe("{");
});
