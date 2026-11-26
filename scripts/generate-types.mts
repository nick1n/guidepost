import { readOptional } from "#scripts/read-optional.mts";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import { build } from "vite";
import { compileFromFile } from "json-schema-to-typescript";
import { format, resolveConfig } from "prettier";
import { Schema } from "effect";
import { WorkbookMapSchema } from "#lib/types/workbook.ts";
import { editionGameplay } from "#lib/kdm-data.ts";
import type { Catalog } from "#lib/types/index.ts";

export const schemaPath = fileURLToPath(import.meta.resolve("#static/kdm/catalog/data.schema.json"));
export const catalogPath = fileURLToPath(import.meta.resolve("#static/kdm/catalog/data.json"));
export const gameplaySchemaPath = fileURLToPath(import.meta.resolve("#static/kdm/data/schema.json"));
const gameplayTypesPath = fileURLToPath(new URL("../src/lib/types/gen/kdm-gameplay.d.ts", import.meta.url));
const workbookSchemaPath = fileURLToPath(import.meta.resolve("#static/kdm/catalog/workbook-map.schema.json"));
const outputPath = fileURLToPath(new URL("../src/lib/types/gen/kdm-data.d.ts", import.meta.url));
const corePath = fileURLToPath(new URL("../src/lib/gen/core-editions.json", import.meta.url));

export const validatorPath = fileURLToPath(new URL("../src/lib/gen/catalog-validator.js", import.meta.url));
const validatorTypesPath = validatorPath.replace(/\.js$/, ".d.ts");
const banner = "/* Generated from static/kdm/catalog/data.schema.json. Do not edit. Run pnpm generate:types to regenerate. */";

export async function renderCatalogValidator(schema: object) {
  const ajv = new Ajv2020({ strict: false, allErrors: true, code: { source: true } });
  const source = standaloneCode(ajv, ajv.compile(schema));
  const directory = await mkdtemp(join(tmpdir(), "catalog-validator-"));
  try {
    const entry = join(directory, "catalog-validator.cjs");
    await writeFile(entry, source);
    // Bundle standalone's CommonJS runtime helpers, never the Ajv compiler.
    const result = await build({
      configFile: false,
      logLevel: "silent",
      resolve: { alias: { ajv: dirname(fileURLToPath(import.meta.resolve("ajv/package.json"))) } },
      build: { write: false, minify: true, lib: { entry, formats: ["es"] }, rolldownOptions: { output: { comments: false } } },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const chunks = outputs.flatMap((output) => ("output" in output ? output.output : []));
    if (chunks.length !== 1 || chunks[0].type !== "chunk" || chunks[0].imports.length || chunks[0].dynamicImports.length) {
      throw new Error("Catalog validator must be one self-contained browser module.");
    }
    return await format("// @ts-nocheck\n" + banner + "\n" + chunks[0].code, { ...(await resolveConfig(validatorPath)), parser: "babel" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeChanged(path: string, output: string) {
  const previous = await readOptional(path);
  if (previous === output) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, output);
  return true;
}

export async function generateCatalogValidator() {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const output = await renderCatalogValidator(schema);
  const changed = await writeChanged(validatorPath, output);
  const types = await format(
    banner +
      '\nimport type { Catalog } from "#lib/types/index.ts";\nimport type { ValidateFunction } from "ajv";\ndeclare const validate: ValidateFunction<Catalog>;\nexport default validate;\n',
    {
      ...(await resolveConfig(validatorTypesPath)),
      parser: "typescript",
    },
  );
  const typesChanged = await writeChanged(validatorTypesPath, types);
  return changed || typesChanged;
}

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
  return writeChanged(corePath, output);
}

async function generateWorkbookSchema() {
  const document = Schema.toJsonSchemaDocument(WorkbookMapSchema, { onExcessProperty: "error" });
  const output = await format(
    JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...document.schema, $defs: document.definitions }),
    {
      ...(await resolveConfig(workbookSchemaPath)),
      parser: "json",
    },
  );
  return writeChanged(workbookSchemaPath, output);
}

async function generateSchemaTypes(schema: string, outputPath: string, source: string) {
  const output = await compileFromFile(schema, {
    // The schemas check array cardinality; consumers work with ordinary arrays.
    ignoreMinAndMaxItems: true,
    style: (await resolveConfig(outputPath)) ?? {},
    bannerComment: "/* Generated from " + source + ". Do not edit. Run pnpm generate:types to regenerate. */",
  });
  return writeChanged(outputPath, output);
}

export async function generateTypes() {
  const validatorChanged = await generateCatalogValidator();
  const coreChanged = await generateCoreEditions();
  const workbookChanged = await generateWorkbookSchema();
  const catalogTypesChanged = await generateSchemaTypes(schemaPath, outputPath, "static/kdm/catalog/data.schema.json");
  const gameplayTypesChanged = await generateSchemaTypes(gameplaySchemaPath, gameplayTypesPath, "static/kdm/data/schema.json");
  return validatorChanged || coreChanged || workbookChanged || catalogTypesChanged || gameplayTypesChanged;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateTypes();
}
