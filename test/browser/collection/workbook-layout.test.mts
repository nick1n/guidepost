import { resolve } from "node:path";
import { runBrowser } from "../support/harness.mts";

type Layout = { height: number; width: number; gap: number; text: string; status: string; fits: boolean };

const directory = resolve("temp/browser-verification/workbook-layout");

await runBrowser(
  { name: "workbook-layout", diagnostics: "document.querySelector('dialog[data-swipe-ignore]')?.innerText" },
  async ({
    base,
    send,
    evaluate,
    waitFor,
    activate,
    assert,
    saveScreenshot,
    frames,
    viewport,
    menuButton,
    activateMenuButton,
    details,
  }) => {
    await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: directory });
    await send("Network.enable");
    await send("Network.setCacheDisabled", { cacheDisabled: true });
    await send("Network.setBypassServiceWorker", { bypass: true });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    const button = menuButton("Export workbook");
    const measure = `(()=>{
      const button=${button}, dialog=button.closest('dialog');
      const control=button.getBoundingClientRect(), navigation=dialog.querySelector('nav[aria-label=Site]').getBoundingClientRect();
      return {height:control.height, width:control.width, gap:navigation.top-control.bottom,
        text:button.textContent.trim(), status:dialog.querySelector('p[role=status]')?.textContent ?? '',
        fits:document.documentElement.scrollWidth <= innerWidth};
    })()`;
    const measurements: Array<{ width: number; idle: Layout; pending: Layout; complete: Layout }> = [];
    details.measurements = measurements;
    for (const width of [1280, 390, 320]) {
      await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await viewport(width);
      await evaluate("window.workbookLayoutPreviousDocument = true");
      await send("Page.navigate", { url: new URL("/kdm/collection/", base).href });
      await waitFor("!window.workbookLayoutPreviousDocument && document.querySelector('article input[type=checkbox]:not(:disabled)')");
      if (!(await evaluate("document.querySelector('dialog[data-swipe-ignore]')?.open"))) await activate("Open menu");
      await waitFor(`${button} && !${button}.disabled`);
      await evaluate("document.querySelector('dialog[data-swipe-ignore] .body').scrollTop=10000");
      await frames();
      const idle = await evaluate<Layout>(measure);
      await saveScreenshot(`${width}-idle.png`);
      await send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 1000,
        downloadThroughput: 10000000,
        uploadThroughput: 10000000,
      });
      await activateMenuButton("Export workbook");
      await waitFor(`${button}.disabled`);
      await frames();
      const pending = await evaluate<typeof idle>(measure);
      await saveScreenshot(`${width}-pending.png`);
      await waitFor("document.querySelector('dialog[data-swipe-ignore]').textContent.includes('Workbook downloaded.')");
      // The existing outside-click handling dismisses the drawer when the download anchor is clicked.
      await waitFor("!document.querySelector('dialog[data-swipe-ignore]').open");
      await activate("Open menu");
      await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
      await evaluate("document.querySelector('dialog[data-swipe-ignore] .body').scrollTop=10000");
      await frames();
      const complete = await evaluate<typeof idle>(measure);
      await saveScreenshot(`${width}-complete.png`);
      measurements.push({ width, idle, pending, complete });
      console.log(
        `${width}px: gap ${idle.gap} -> ${pending.gap} -> ${complete.gap}, button height ${idle.height} -> ${pending.height} -> ${complete.height}`,
      );
    }
    for (const result of measurements) {
      const { width, idle, pending, complete } = result;
      assert(idle.fits && pending.fits && complete.fits, `Workbook controls fit at ${width}px while idle, pending, and completed`);
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
  },
);
