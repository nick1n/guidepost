import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { runBrowser } from "./browser-harness.mts";

const assets = resolve("build/_app/immutable/assets");
const stylesheet = (await readdir(assets).catch(() => [])).find((name) => name.startsWith("unocss-svelte-scoped-global."));
if (!stylesheet) throw new Error("Missing production icon stylesheet. Run pnpm build before pnpm test:error-browser.");

const fixture = resolve("test/client/fixtures/retry");
const kit = resolve(fixture, "kit.ts");
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: resolve("build"),
  cacheDir: resolve("node_modules/.vite/retry-browser"),
  plugins: [
    svelte({ configFile: false, preprocess: vitePreprocess() }),
    {
      name: "retry-fixture-icons",
      transformIndexHtml: () => [
        { tag: "link", attrs: { rel: "stylesheet", href: `/_app/immutable/assets/${stylesheet}` }, injectTo: "head" },
      ],
    },
  ],
  resolve: {
    alias: [
      { find: /^#lib\//, replacement: `${resolve("src/lib").replaceAll("\\", "/")}/` },
      ...["$app/navigation", "$app/paths", "$app/state"].map((find) => ({ find, replacement: kit })),
    ],
  },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [resolve(".")] } },
});

const output = "temp/browser-verification/error";
await mkdir(output, { recursive: true });
try {
  await server.listen();
  const origin = server.resolvedUrls?.local[0];
  if (!origin) throw new Error("Retry fixture server did not start");
  process.argv = [...process.argv.slice(0, 2), origin];
  await runBrowser(
    "error-retry",
    "document.body.innerText",
    async ({ send, evaluate, waitFor, assert, errors, report, saveScreenshot }) => {
      const button = "document.querySelector('main .actions button')";
      const status = "document.querySelector('main .retry-status')";
      const frame = () => evaluate("new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))");
      const geometry = () =>
        evaluate(`JSON.stringify([...document.querySelectorAll('main .message, main .actions > *')].map(element => {
        const {x,y,width,height} = element.getBoundingClientRect(); return {x,y,width,height};
      }))`);

      for (const width of [390, 1280]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
        for (const motion of ["no-preference", "reduce"]) {
          const scenario = `${width}-${motion}`;
          await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: motion }] });
          await send("Page.navigate", { url: origin });
          await waitFor(`window.retryTest !== undefined && ${button} !== null`);
          await evaluate("document.fonts.ready.then(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))");
          const idle = await geometry();
          assert(await evaluate(`!${button}.disabled && ${button}.textContent === 'Try again'`), `Retry starts idle at ${scenario}`);
          assert(
            await evaluate("window.retryTest.attempts.length === 0 && window.retryTest.notices.length === 0"),
            `Navigation is deferred at ${scenario}`,
          );
          await saveScreenshot(`${output}/idle-${scenario}.png`);

          await evaluate(`${button}.click()`);
          await waitFor(`${button}.disabled && ${status}.innerText.includes('Opening the page...')`);
          assert((await geometry()) === idle, `Pending feedback preserves the panel and controls at ${scenario}`);
          assert(
            await evaluate(`(() => {
          const [{href,options}] = window.retryTest.attempts;
          return href === location.origin + '/retry-route/' && options.invalidateAll === true && options.replaceState === true;
        })()`),
            `Retry forwards the current URL and navigation options at ${scenario}`,
          );
          await evaluate(`${button}.click()`);
          assert(await evaluate("window.retryTest.attempts.length === 1"), `Pending retry cannot start another navigation at ${scenario}`);
          await saveScreenshot(`${output}/pending-${scenario}.png`);

          await evaluate("window.retryTest.finish('failure')");
          await waitFor(`!${button}.disabled && ${status}.innerText.includes("We couldn't retry.")`);
          assert((await geometry()) === idle, `Failure feedback preserves the panel and controls at ${scenario}`);
          assert(
            await evaluate("JSON.stringify(window.retryTest.notices) === JSON.stringify(['Page retry failed'])"),
            `Failure is reported once at ${scenario}`,
          );
          await saveScreenshot(`${output}/failed-${scenario}.png`);

          await evaluate(`${button}.click()`);
          await waitFor(`${button}.disabled && !${status}.innerText.includes("We couldn't retry.")`);
          await evaluate("window.retryTest.finish('success')");
          await waitFor(`!${button}.disabled && ${status}.innerText.trim() === ''`);
          assert((await geometry()) === idle, `Successful retry clears feedback without moving controls at ${scenario}`);
          assert(await evaluate("window.retryTest.notices.length === 1"), `Successful retry does not announce a save at ${scenario}`);
          await saveScreenshot(`${output}/completed-${scenario}.png`);

          // Test both outcomes after teardown. An interrupted adapter promise can settle either way.
          for (const outcome of ["success", "failure"]) {
            if (outcome === "failure") {
              await send("Page.navigate", { url: origin });
              await waitFor(`window.retryTest !== undefined && ${button} !== null`);
            }
            const notices = await evaluate<number>("window.retryTest.notices.length");
            await evaluate(`${button}.click()`);
            await waitFor(`${button}.disabled`);
            await evaluate("window.retryTest.unmount()");
            await waitFor("document.querySelector('main') === null");
            await evaluate(`window.retryTest.finish('${outcome}')`);
            await frame();
            assert(await evaluate(`window.retryTest.notices.length === ${notices}`), `Unmount silences late ${outcome} at ${scenario}`);
          }
        }
      }
      assert(errors.length === 0, "No runtime exceptions, error logs, or unhandled rejections");
      await writeFile(`${output}/report.json`, JSON.stringify({ report, errors }, null, 2));
    },
  );
} finally {
  await server.close();
}
