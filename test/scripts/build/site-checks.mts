import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkBuild } from "#scripts/check-build.mts";

test("build verification checks root and subpath sites and rejects broken artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "guidepost-build-"));
  try {
    await mkdir(join(root, "assets"));
    const css = "assets/unocss-svelte-scoped-global.test.css";
    await writeFile(join(root, css), ".icon { display: inline-block; }", "utf8");
    await writeFile(join(root, "service-worker.js"), "self.addEventListener('fetch', () => {});", "utf8");
    for (const base of ["", "/guidepost"]) {
      const html = `<link rel="stylesheet" href="${base}/${css}">`;
      await writeFile(join(root, "index.html"), html, "utf8");
      await writeFile(join(root, "404.html"), html, "utf8");
      await checkBuild(root, base);
      await writeFile(join(root, "index.html"), `${html}%unocss-svelte-scoped.global%`, "utf8");
      await assert.rejects(checkBuild(root, base), /Unresolved UnoCSS/);
      await writeFile(join(root, "index.html"), "<p>No stylesheet</p>", "utf8");
      await assert.rejects(checkBuild(root, base), /Missing global stylesheet/);
      await writeFile(join(root, "index.html"), `${html}<link rel="stylesheet" href="${base}/missing.css">`, "utf8");
      await assert.rejects(checkBuild(root, base), /ENOENT/);
      if (base) {
        await writeFile(join(root, "index.html"), `<link rel="stylesheet" href="/${css}">`, "utf8");
        await assert.rejects(checkBuild(root, base), /outside base path/);
      }
      await writeFile(join(root, "index.html"), html, "utf8");
    }
    await rm(join(root, "404.html"));
    await assert.rejects(checkBuild(root, "/guidepost"), /ENOENT/);
    await writeFile(join(root, "404.html"), "", "utf8");
    await rm(join(root, "service-worker.js"));
    await assert.rejects(checkBuild(root, "/guidepost"), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
