import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runBrowser } from "./browser-harness.mts";

const directory = resolve("temp/browser-verification/workbook-layout");
const baseline = process.argv.includes("--baseline");
await mkdir(directory, { recursive: true });

await runBrowser(
  "workbook-layout",
  "document.querySelector('dialog[data-swipe-ignore]')?.innerText",
  async ({ base, send, evaluate, waitFor, click, assert, saveScreenshot, report, errors }) => {
    await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: directory });
    await send("Network.enable");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    await send("Network.setBypassServiceWorker", { bypass: true });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    const button = `[...document.querySelectorAll('dialog[data-swipe-ignore] button')].find(button => button.textContent.trim().startsWith('Export workbook'))`;
    const measure = `(()=>{
      const button=${button}, dialog=button.closest('dialog');
      const control=button.getBoundingClientRect(), navigation=dialog.querySelector('nav[aria-label=Site]').getBoundingClientRect();
      return {height:control.height, width:control.width, gap:navigation.top-control.bottom,
        text:button.textContent.trim(), status:dialog.querySelector('p[role=status]')?.textContent ?? ''};
    })()`;
    const measurements = [];
    for (const width of [1280, 390, 320]) {
      await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      await evaluate("window.workbookLayoutPreviousDocument = true");
      await send("Page.navigate", { url: new URL("/kdm/collection/", base).href });
      await waitFor("!window.workbookLayoutPreviousDocument && document.querySelector('article input[type=checkbox]:not(:disabled)')");
      if (!(await evaluate("document.querySelector('dialog[data-swipe-ignore]')?.open"))) await click("Open menu");
      await waitFor(`${button} && !${button}.disabled`);
      await evaluate("document.querySelector('dialog[data-swipe-ignore] .body').scrollTop=10000");
      await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
      const idle = await evaluate<{ height: number; width: number; gap: number; text: string; status: string }>(measure);
      await saveScreenshot(`${directory}/${baseline ? "before" : "after"}-${width}-idle.png`);
      await send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 1000,
        downloadThroughput: 10000000,
        uploadThroughput: 10000000,
      });
      await evaluate(`${button}.click()`);
      await waitFor(`${button}.disabled`);
      await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
      const pending = await evaluate<typeof idle>(measure);
      await saveScreenshot(`${directory}/${baseline ? "before" : "after"}-${width}-pending.png`);
      await waitFor("document.querySelector('dialog[data-swipe-ignore]').textContent.includes('Workbook downloaded.')");
      // The existing outside-click handling dismisses the drawer when the download anchor is clicked.
      await waitFor("!document.querySelector('dialog[data-swipe-ignore]').open");
      await click("Open menu");
      await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
      await evaluate("document.querySelector('dialog[data-swipe-ignore] .body').scrollTop=10000");
      await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
      const complete = await evaluate<typeof idle>(measure);
      await saveScreenshot(`${directory}/${baseline ? "before" : "after"}-${width}-complete.png`);
      measurements.push({ width, idle, pending, complete });
      console.log(
        `${width}px: gap ${idle.gap} -> ${pending.gap} -> ${complete.gap}, button height ${idle.height} -> ${pending.height} -> ${complete.height}`,
      );
    }
    await writeFile(`${directory}/${baseline ? "before" : "after"}.json`, JSON.stringify({ measurements, errors }, null, 2));
    for (const result of measurements) {
      if (baseline) continue;
      const { width, idle, pending, complete } = result;
      assert(
        Math.abs(idle.height - pending.height) < 0.1 && Math.abs(idle.height - complete.height) < 0.1,
        `Export button height remains stable at ${width}px`,
      );
      assert(
        Math.abs(idle.gap - pending.gap) < 0.1 && Math.abs(idle.gap - complete.gap) < 0.1,
        `Export progress and completion do not move navigation at ${width}px`,
      );
      assert(!pending.status && !complete.status, `Export status does not appear in a paragraph below the buttons at ${width}px`);
    }
    assert(errors.length === 0, `No browser runtime errors: ${JSON.stringify(errors)}`);
    await writeFile(`${directory}/report.json`, JSON.stringify({ report, errors }, null, 2));
  },
);
