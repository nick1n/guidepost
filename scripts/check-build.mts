import { access, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Parser } from "htmlparser2";

export async function checkBuild(root = "build", base = process.env.BASE_PATH ?? "") {
  const directory = resolve(root);
  for (const required of ["index.html", "404.html", "service-worker.js"]) await access(join(directory, required));
  const pages = (await readdir(directory, { recursive: true })).filter((file) => file.endsWith(".html"));
  for (const page of pages) {
    const html = await readFile(join(directory, page), "utf8");
    if (html.includes("%unocss-svelte-scoped.global%")) throw new Error(`Unresolved UnoCSS placeholder in ${page}`);
    const styles: string[] = [];
    new Parser({
      onopentag(name, attributes) {
        if (name === "link" && attributes.rel?.split(/\s+/).includes("stylesheet") && attributes.href) {
          styles.push(attributes.href);
        }
      },
    }).end(html);
    let global = false;
    for (const href of styles) {
      const url = new URL(href, `https://build.invalid${base}/${page.replaceAll("\\", "/")}`);
      if (url.origin !== "https://build.invalid") continue;
      if (!url.pathname.startsWith(`${base}/`)) throw new Error(`Stylesheet outside base path in ${page}: ${href}`);
      const file = resolve(directory, decodeURIComponent(url.pathname.slice(base.length + 1)));
      if (relative(directory, file).startsWith("..")) throw new Error(`Stylesheet outside build in ${page}: ${href}`);
      await access(file);
      if (/\/unocss-svelte-scoped-global\.[^/]+\.css$/.test(url.pathname)) {
        if (!(await readFile(file, "utf8")).trim()) throw new Error(`Empty global stylesheet: ${href}`);
        global = true;
      }
    }
    // Static reference pages have their own styles and do not load the Svelte app.
    const app = page === "index.html" || page === "404.html" || html.includes("/_app/immutable/");
    if (app && !global) throw new Error(`Missing global stylesheet in ${page}`);
  }
  console.log(`Verified ${pages.length} HTML pages, stylesheets, fallback, and service worker.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await checkBuild();
