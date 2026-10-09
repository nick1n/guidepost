import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";
import { format, resolveConfig } from "prettier";
import { editionGameplay } from "../src/lib/kdm-data.ts";
import type { Catalog } from "../src/lib/types/index.ts";

export const schemaPath = fileURLToPath(new URL("../static/kdm-catalog/data.schema.json", import.meta.url));
export const catalogPath = fileURLToPath(new URL("../static/kdm-catalog/data.json", import.meta.url));
const outputPath = fileURLToPath(new URL("../src/lib/types/gen/kdm-data.d.ts", import.meta.url));
const corePath = fileURLToPath(new URL("../src/lib/gen/core-editions.json", import.meta.url));

export async function generateCoreEditions() {
  const catalog: Catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const core = catalog.content.core;
  if (!core) throw new Error("The catalog must contain the core game for Quick Start.");
  const editions = (core.editions ?? [])
    .filter((edition) => edition.id !== "resin" && editionGameplay(core, edition))
    .map(({ id, label }) => ({ id, label }));
  if (!editions.length) throw new Error("The core game must have playable editions for Quick Start.");
  const output = await format(JSON.stringify(editions), {
    ...(await resolveConfig(corePath)),
    parser: "json",
  });
  const previous = await readFile(corePath, "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (output === previous) return false;
  await mkdir(dirname(corePath), { recursive: true });
  await writeFile(corePath, output);
  return true;
}

export async function generateTypes() {
  const coreChanged = await generateCoreEditions();
  const output = await compileFromFile(schemaPath, {
    // Catalog validation checks array cardinality; consumers work with ordinary arrays.
    ignoreMinAndMaxItems: true,
    style: (await resolveConfig(outputPath)) ?? {},
    bannerComment: "/* Generated from static/kdm-catalog/data.schema.json. Do not edit. Run pnpm generate:types to regenerate. */",
  });
  const previous = await readFile(outputPath, "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (output === previous) return coreChanged;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateTypes();
}
