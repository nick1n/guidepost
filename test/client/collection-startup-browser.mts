import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import { gzipSync } from "node:zlib";
import { runBrowser } from "./browser-harness.mts";

const root = resolve("build");
const prefix = process.env.BASE_PATH ?? "";
const requests: Array<{ headers: object; status: number }> = [];
let responseStatus = 200;
let mismatch = false;
let catalogGate: Promise<void> | undefined;
let scriptGate: Promise<void> | undefined;
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    if (prefix && !path.startsWith(`${prefix}/`)) {
      response.writeHead(404).end();
      return;
    }
    const local = decodeURIComponent(path.slice(prefix.length));
    const file = resolve(root, `.${local.endsWith("/") ? `${local}index.html` : local}`);
    if (relative(root, file).startsWith("..")) {
      response.writeHead(403).end();
      return;
    }
    const isCatalog = local === "/kdm/catalog/data.json";
    const status = isCatalog ? responseStatus : 200;
    if (isCatalog) {
      requests.push({ headers: request.headers, status });
      await catalogGate;
    }
    // Hold only the two bootstrap entries, leaving connections available for the JSON preload.
    if (local.includes("/_app/immutable/entry/")) await scriptGate;
    let body = await readFile(file);
    if (scriptGate && local === "/kdm/collection/") {
      body = Buffer.from(body.toString().replace('as="fetch"', 'as="fetch" onload="window.catalogPreloaded=true"'));
    }
    if (mismatch && local === "/kdm/collection/")
      body = Buffer.from(body.toString().replace('crossorigin="anonymous"', 'crossorigin="use-credentials"'));
    const mime = types[extname(file)] ?? "application/octet-stream";
    const compressed = /text|json|javascript|svg/.test(mime) && request.headers["accept-encoding"]?.includes("gzip");
    const payload = compressed ? gzipSync(body) : body;
    response.writeHead(status, {
      "Content-Type": mime,
      "Cache-Control": "no-store",
      "Content-Length": payload.length,
      ...(compressed ? { "Content-Encoding": "gzip" } : {}),
    });
    response.end(payload);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Fixture server did not start");
const origin = `http://127.0.0.1:${address.port}`;
process.argv = [...process.argv.slice(0, 2), origin];
await mkdir("temp/browser-verification/collection-startup", { recursive: true });

try {
  await runBrowser(
    "collection-startup",
    "JSON.stringify({text:document.body.innerText.slice(0,1000),seen:window.startupCards})",
    async ({ send, evaluate, waitFor, assert, errors, report, saveScreenshot }) => {
      await send("Network.enable");
      await send("Page.addScriptToEvaluateOnNewDocument", {
        source: `
      // Isolate preload/consumer reuse from the application's independent SW retention requests.
      if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve();
      window.startupCards = [];
      new MutationObserver(() => {
        for (const article of document.querySelectorAll('.catalog [data-category] article')) {
          const body = article.querySelector('[id^="card-body-"]');
          if (!body) continue;
          const id = body.id.slice(10), category = article.closest('[data-category]').dataset.category;
          if (!window.startupCards.some(value => value.id === id && value.category === category)) window.startupCards.push({id, category});
        }
      }).observe(document, {subtree:true,childList:true});
    `,
      });
      const navigate = async (path: string) => {
        await send("Page.navigate", { url: "about:blank" });
        await waitFor("location.href === 'about:blank'");
        await send("Page.navigate", { url: `${origin}${prefix}${path}` });
      };
      const spa = async (path: string) => {
        await evaluate(
          `(()=>{const link=document.createElement('a');link.href=${JSON.stringify(prefix)}+${JSON.stringify(path)};link.dataset.sveltekitPreloadData='false';document.body.append(link);link.click();link.remove()})()`,
        );
      };
      const ready = () => waitFor("document.querySelector('.catalog article input[type=checkbox]:not(:disabled)') !== null");
      const frame = () => evaluate("new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))");
      const only = async (id: string) => {
        await ready();
        await frame();
        assert(
          await evaluate(
            `document.querySelectorAll('.catalog article').length === 1 && window.startupCards.length === 1 && window.startupCards[0].id === ${JSON.stringify(id)}`,
          ),
          `Only ${id} is constructed from startup, including hidden panels`,
        );
      };
      const gateCatalog = () => {
        let release: () => void = () => {};
        catalogGate = new Promise<void>((done) => {
          release = done;
        });
        return () => {
          catalogGate = undefined;
          release();
        };
      };

      for (const width of [390, 1280]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
        requests.length = 0;
        const release = gateCatalog();
        await navigate("/kdm/collection/#/content/woe-white-speaker");
        await waitFor("document.documentElement.hasAttribute('data-glass') && document.querySelector('.startup') !== null");
        assert(
          await evaluate("document.querySelectorAll('article').length === 0 && document.body.innerText.includes('Loading catalog...')"),
          `Delayed startup shows the shell without cards at ${width}px`,
        );
        await saveScreenshot(`temp/browser-verification/collection-startup/pending-${width}.png`);
        await evaluate("document.querySelector('[data-menu-trigger]').click()");
        await waitFor("document.querySelector('dialog[data-swipe-ignore]')?.open");
        assert(
          await evaluate(`(() => {
            const buttons = [...document.querySelectorAll('dialog button')].filter(button => /^(Import|Export) workbook/.test(button.textContent.trim()));
            return buttons.length === 2 && buttons.every(button => button.disabled);
          })()`),
          `Workbook transfers wait for the full catalog at ${width}px`,
        );
        await evaluate("document.querySelector('[data-menu-trigger]').click()");
        await waitFor("!document.querySelector('dialog[data-swipe-ignore]')?.open");
        release();
        await only("woe-white-speaker");
        assert(requests.length === 1, `In-flight JSON preload is consumed once at ${width}px`);
        await saveScreenshot(`temp/browser-verification/collection-startup/item-${width}.png`);
        await spa("/credits/");
        await waitFor(`location.pathname === ${JSON.stringify(`${prefix}/credits/`)} && !document.querySelector('.catalog')`);
        requests.length = 0;
        await evaluate("window.startupCards = []");
        await spa("/kdm/collection/#/accessories");
        await ready();
        await frame();
        assert(
          await evaluate("window.startupCards.length > 0 && window.startupCards.every(item => item.category === 'accessories')"),
          `Client re-entry initializes the fresh category at ${width}px`,
        );
        assert(requests.length === 0, `Installed-catalog revisit skips both preload and consumer at ${width}px`);
      }

      requests.length = 0;
      let releaseScripts: () => void = () => {};
      scriptGate = new Promise<void>((done) => {
        releaseScripts = done;
      });
      await navigate("/kdm/collection/#/content/woe-white-speaker");
      await waitFor("window.catalogPreloaded === true");
      assert(
        await evaluate("document.querySelectorAll('article').length === 0"),
        "Completed preload does not render any cards before JavaScript",
      );
      scriptGate = undefined;
      releaseScripts();
      await only("woe-white-speaker");
      assert(requests.length === 1, "Completed, noncacheable preload is reused by the real Effect request");

      requests.length = 0;
      mismatch = true;
      await navigate("/kdm/collection/#/content/woe-white-speaker");
      await only("woe-white-speaker");
      assert(requests.length === 2, "Credentials-mismatch negative control exposes the duplicate download");
      mismatch = false;

      requests.length = 0;
      const release = gateCatalog();
      await navigate("/kdm/collection/#/content/woe-white-speaker");
      await waitFor("document.documentElement.hasAttribute('data-glass') && document.querySelector('.startup') !== null");
      // Use a known item from the live catalog, so the latest destination has an exact assertion.
      const data = JSON.parse(await readFile("static/kdm/catalog/data.json", "utf8"));
      const accessory = Object.keys(data.accessories)[0];
      await evaluate(`location.hash = '/accessories/' + ${JSON.stringify(accessory)}`);
      release();
      await only(accessory);
      assert(true, "A hash change during loading selects the latest destination without intermediate cards");

      responseStatus = 503;
      await navigate("/kdm/collection/#/content/woe-white-speaker");
      await waitFor("document.querySelector('.startup [role=alert]') !== null");
      assert(
        await evaluate("document.querySelectorAll('article').length === 0"),
        "Catalog failure keeps cards unmounted and offers inline retry",
      );
      await saveScreenshot("temp/browser-verification/collection-startup/error.png");
      responseStatus = 200;
      await evaluate("document.querySelector('.startup button').click()");
      await only("woe-white-speaker");

      await navigate("/kdm/collection/#/content/not-a-real-item");
      await waitFor("document.querySelector('.catalog .empty') !== null");
      assert(
        await evaluate(
          "document.querySelectorAll('article').length === 0 && window.startupCards.length === 0 && document.body.innerText.includes('This item could not be found')",
        ),
        "Unknown item links never broaden into a catalog list",
      );
      await evaluate("document.querySelector('.item-navigation button').click()");
      await ready();
      assert(await evaluate("location.hash === ''"), "The item exit returns to its category");

      assert(errors.length === 0, "No browser runtime exceptions or unexpected error logs");
      await writeFile("temp/browser-verification/collection-startup/report.json", JSON.stringify({ report, requests, errors }, null, 2));
    },
  );
  await runBrowser("collection-offline", "document.body.innerText.slice(0,1000)", async ({ send, evaluate, waitFor, assert, errors }) => {
    await send("Network.enable");
    await send("Page.navigate", { url: `${origin}${prefix}/kdm/collection/#/content/woe-white-speaker` });
    await waitFor("document.querySelector('.catalog article input[type=checkbox]:not(:disabled)') !== null");
    await waitFor("navigator.serviceWorker.controller !== null");
    await waitFor(`(async () => {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        if (await cache.match(${JSON.stringify(`${prefix}/kdm/collection/`)}) && await cache.match(${JSON.stringify(`${prefix}/kdm/catalog/data.json`)})) return true;
      }
      return false;
    })()`);
    await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    try {
      await evaluate("window.offlineReloadSentinel = true");
      await send("Page.reload");
      await waitFor(
        "!window.offlineReloadSentinel && document.querySelector('.catalog article input[type=checkbox]:not(:disabled)') !== null",
      );
      assert(
        await evaluate(
          "document.querySelectorAll('.catalog article').length === 1 && document.querySelector('#card-body-woe-white-speaker') !== null",
        ),
        "The real service worker retains the shell and catalog for an exact-item offline reload",
      );
      assert(errors.length === 0, "Offline reload has no browser runtime exceptions");
    } finally {
      await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    }
  });
} finally {
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
}
