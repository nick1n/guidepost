import { mkdir, writeFile } from "node:fs/promises";
import { runBrowser } from "./browser-harness.mts";

await mkdir("temp/browser-verification", { recursive: true });
await runBrowser(
  "hunt-navigation",
  "document.body.innerText.slice(0,1000)",
  async ({ base, send, evaluate, waitFor, assert, saveScreenshot, report }) => {
    for (const width of [390, 1280]) {
      for (const motion of ["no-preference", "reduce"]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: motion }] });
        await send("Page.navigate", { url: new URL("/", base).href });
        await waitFor("document.querySelector('main.landing') && document.documentElement.hasAttribute('data-glass')");
        await evaluate("document.querySelector('main a[href*=\"/kdm/hunt\"]').click()");
        await waitFor("document.querySelector('.slide .card') && document.documentElement.hasAttribute('data-glass')");
        await evaluate("document.querySelector('[data-menu-trigger]').click()");
        await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
        await saveScreenshot(`temp/browser-verification/hunt-navigation-${width}-${motion}-before.png`);
        const result = await evaluate<{ overlap: boolean; outros: number; samples: number }>(`new Promise(resolve => {
        let overlap = false, outros = 0, samples = 0, start;
        const onoutrostart = event => { if (event.target.matches('.slide, .card')) outros++; };
        document.addEventListener('outrostart', onoutrostart, true);
        const sample = time => {
          if (document.querySelector('main.landing')) {
            start ??= time;
            samples++;
            overlap ||= !!document.querySelector('main:not(.landing)') || document.querySelectorAll('[data-menu-trigger]').length !== 1;
          }
          if (start !== undefined && time - start > 700) {
            document.removeEventListener('outrostart', onoutrostart, true);
            resolve({overlap, outros, samples});
          }
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        document.querySelector('dialog .navigation a').click();
      })`);
        await saveScreenshot(`temp/browser-verification/hunt-navigation-${width}-${motion}-after.png`);
        assert(
          result.samples > 0 && !result.overlap,
          `${width}px, ${motion}: Home never overlaps the hunt page or a duplicate menu launcher`,
        );
        assert(result.outros === 0, `${width}px, ${motion}: navigating Home starts no card exit animation`);

        for (const action of motion === "reduce" ? ["back"] : ["back", "draw", "select"]) {
          await evaluate("document.querySelector('main a[href*=\"/kdm/hunt\"]').click()");
          await waitFor("document.querySelector('.slide .card') && !document.querySelector('.slide').closest('[inert]')");
          await evaluate("Promise.all(document.querySelector('.slide').getAnimations().map(animation => animation.finished))");
          if (action !== "back") {
            await evaluate(
              action === "draw"
                ? "document.querySelector('.random').click()"
                : `(() => {
              document.querySelector('.selection').click();
              document.querySelector('[aria-label="tens 2"]').click();
              document.querySelector('dialog:has(.dice) .close').click();
            })()`,
            );
            await waitFor("document.querySelector('.slide[inert]')?.getAnimations().length > 0");
            await evaluate("document.querySelector('.slide[inert]').getAnimations().forEach(animation => animation.pause())");
          }
          await evaluate("history.back()");
          await waitFor("document.querySelector('main.landing') !== null");
          assert(
            await evaluate(
              "!document.querySelector('.slide, main:not(.landing)') && document.querySelectorAll('[data-menu-trigger]').length === 1",
            ),
            `${width}px, ${motion}: Back removes the hunt card immediately (${action})`,
          );
        }
      }
    }
    await writeFile("temp/browser-verification/hunt-navigation-report.json", JSON.stringify(report, null, 2));
  },
);
