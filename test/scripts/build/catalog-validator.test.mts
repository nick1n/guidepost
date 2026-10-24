import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { expect, it } from "vitest";
import schema from "#catalog/data.schema.json";
import catalog from "#catalog/data.json";
import validate from "#lib/gen/catalog-validator.js";
import { generateTypes, renderCatalogValidator, validatorPath } from "#scripts/generate-types.mts";

const authoritative = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
const item = { name: "Model", tags: ["model"] };
const edition = { id: "first-run", label: "First Run", format: "physical" };
const sample = (fields: object) => ({ ...catalog, content: { model: { ...item, ...fields } } });

it.each([
  ["live catalog", catalog, true],
  ["unknown references are tooling-only", sample({ requires: ["unknown-item"] }), true],
  ["Unicode name", sample({ name: "\u{1F30D}\u00E9" }), true],
  ["missing categories", {}, false],
  ["unknown property", sample({ unexpected: true }), false],
  ["empty tags", sample({ tags: [] }), false],
  ["duplicate strings", sample({ aliases: ["same", "same"] }), false],
  ["duplicate objects", sample({ includes: [{ item: "child" }, { item: "child" }] }), false],
  ["empty string", sample({ notes: "" }), false],
  ["date pattern", sample({ releaseDate: "2026" }), false],
  ["year range", sample({ releaseYear: 1800 }), false],
  ["handle pattern", sample({ handle: "Bad Handle" }), false],
  ["kind enum", sample({ kind: "unknown" }), false],
  ["category prefix", sample({ kind: "expansion" }), false],
  ["accessory prefix", { ...catalog, accessories: { model: { ...item, accessoryType: "dice" } } }, false],
  ["reserved edition ID", sample({ editions: [{ ...edition, id: "item" }] }), false],
  ["edition ID pattern", sample({ editions: [{ ...edition, id: "First Run" }] }), false],
  ["label enum", sample({ editions: [{ ...edition, label: "Unknown" }] }), false],
  ["included-only price", sample({ editions: [{ ...edition, includedOnly: true, prices: [0] }] }), false],
  ["minimum price", sample({ editions: [{ ...edition, prices: [-1] }] }), false],
] as const)("standalone agrees with the authoritative schema: %s", (_, input, valid) => {
  expect(authoritative(input)).toBe(valid);
  expect(validate(input)).toBe(valid);
});

it("keeps generated artifacts fresh and leaves unchanged files untouched", async () => {
  const before = await stat(validatorPath);
  expect(await renderCatalogValidator(schema)).toBe(await readFile(validatorPath, "utf8"));
  expect(await generateTypes()).toBe(false);
  expect((await stat(validatorPath)).mtimeMs).toBe(before.mtimeMs);
});

it("generates changed constraints from the supplied source schema", async () => {
  const output = await renderCatalogValidator({ type: "string", minLength: 3 });
  const generated = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  expect(generated.default("ab")).toBe(false);
  expect(generated.default("abc")).toBe(true);
});

it("runs as browser ESM with no imports, CommonJS globals, or runtime code generation", async () => {
  const source = await readFile(validatorPath, "utf8");
  const result = execFileSync(
    process.execPath,
    [
      "--experimental-vm-modules",
      "--input-type=module",
      "-e",
      `
    import { SourceTextModule, createContext, runInContext } from "node:vm";
    let source = "";
    for await (const part of process.stdin) source += part;
    const payload = JSON.parse(source);
    const context = createContext({ inputJSON: JSON.stringify(payload) }, { codeGeneration: { strings: false, wasm: false } });
    const input = runInContext("JSON.parse(inputJSON)", context);
    const module = new SourceTextModule(payload.source, { context });
    await module.link(() => { throw new Error("Unexpected browser dependency"); });
    await module.evaluate();
    if (!module.namespace.default(input.catalog)) throw new Error("Invalid module");
    if (module.namespace.default(input.duplicate)) throw new Error("Missing runtime helpers");
    if (module.namespace.default({})) throw new Error("Missing validation");
  `,
    ],
    {
      input: JSON.stringify({ source, catalog, duplicate: sample({ includes: [{ item: "child" }, { item: "child" }] }) }),
      encoding: "utf8",
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    },
  );
  expect(result).toBe("");
});
