import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";
import { resolveConfig } from "prettier";

export const schemaPath = fileURLToPath(new URL("../src/lib/schema.json", import.meta.url));
const outputPath = fileURLToPath(new URL("../src/lib/types/gen/kdm-data.d.ts", import.meta.url));

export async function generateTypes() {
  const output = await compileFromFile(schemaPath, {
    style: (await resolveConfig(outputPath)) ?? {},
    bannerComment: "/* Generated from src/lib/schema.json. Do not edit. Run pnpm generate:types to regenerate. */",
  });
  const previous = await readFile(outputPath, "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (output === previous) return false;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateTypes();
}
