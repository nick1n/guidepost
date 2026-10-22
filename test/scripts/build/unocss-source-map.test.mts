import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { SourceMap } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import UnoCSS from "@unocss/svelte-scoped/vite";
import { build } from "vite";
import { expect, it } from "vitest";

it("UnoCSS placeholder replacement preserves source locations after the inserted stylesheet", async () => {
  const directory = await mkdtemp(join(tmpdir(), "guidepost-unocss-map-"));
  try {
    const entry = join(directory, "entry.js");
    const config = join(directory, "uno.config.mjs");
    await writeFile(config, "export default { presets: [] };\n");
    const placeholder = "%unocss-" + "svelte-scoped.global%";
    await writeFile(entry, `const assets = "";\nexport const page = "${placeholder}"; export const tail = "after";\n`);
    const warnings: string[] = [];
    const result = await build({
      root: directory,
      configFile: false,
      logLevel: "silent",
      plugins: [UnoCSS({ configOrPath: config, onlyGlobal: true }), { name: "sveltekit:map-fixture" }],
      build: {
        write: false,
        minify: false,
        sourcemap: true,
        lib: { entry, formats: ["es"] },
        rollupOptions: {
          onwarn: (warning) => {
            warnings.push(warning.code ?? "unknown");
          },
        },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const chunk = outputs.flatMap((output) => ("output" in output ? output.output : [])).find((output) => output.type === "chunk");
    if (!chunk || !chunk.map) throw new Error("Expected generated JavaScript and a source map");
    expect(chunk.code).toContain("unocss-svelte-scoped-global");
    expect(chunk.code).not.toContain(placeholder);
    expect(warnings).not.toContain("SOURCEMAP_BROKEN");
    const lines = chunk.code.split("\n");
    const line = lines.findIndex((text) => text.includes('"after"'));
    const column = lines[line].indexOf('"after"');
    const location = new SourceMap(JSON.parse(chunk.map.toString())).findEntry(line, column);
    if (!("originalSource" in location)) throw new Error("Expected a mapped source location");
    expect(location.originalSource).toMatch(/entry\.js$/);
    expect(location.originalLine).toBe(1);
    expect(location.originalColumn).toBeGreaterThan(50);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
