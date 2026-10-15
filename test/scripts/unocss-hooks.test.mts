import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import UnoCSS from "@unocss/svelte-scoped/vite";
import { createServer } from "vite";
import { expect, it } from "vitest";

it.each([true, false])("registers only the supported stylesheet hooks (SvelteKit: %s)", async (sveltekit) => {
  const directory = await mkdtemp(join(tmpdir(), "guidepost-unocss-hooks-"));
  const config = join(directory, "uno.config.mjs");
  const placeholder = "%unocss-" + "svelte-scoped.global%";
  try {
    await writeFile(config, "export default { presets: [] };\n");
    await writeFile(join(directory, "entry.js"), 'export const page = "' + placeholder + '";\n');
    const server = await createServer({
      root: directory,
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true },
      plugins: [
        {
          // Inspect before UnoCSS in plugin order to exercise its pre hook ordering.
          name: sveltekit ? "sveltekit:hook-probe" : "standalone:hook-probe",
          configResolved(config) {
            const styles = config.plugins.find((plugin) => plugin.name === "unocss:svelte-scoped:global-styles");
            if (!styles) throw new Error("Expected the global stylesheet plugin");
            expect(Boolean(styles.transformIndexHtml)).toBe(!sveltekit);
          },
        },
        UnoCSS({ configOrPath: config, onlyGlobal: true }),
      ],
    });
    try {
      const output = sveltekit
        ? (await server.transformRequest("/entry.js"))?.code
        : await server.transformIndexHtml("/", "<html><head>" + placeholder + "</head><body></body></html>");
      expect(output).toContain("unocss-svelte-scoped-global.css");
      expect(output).toContain("data-title");
      expect(output).not.toContain(placeholder);
    } finally {
      await server.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
