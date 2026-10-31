import { mkdir, readFile, writeFile } from "node:fs/promises";
import { runBrowser } from "./browser-harness.mts";

const data = JSON.parse(await readFile("static/kdm/catalog/data.json", "utf8"));
const core = data.content.core.editions.find((edition: { label: string }) => edition.label === "1.6");
const cents = Math.max(...core.prices);
const gbp = new Intl.NumberFormat("en-US", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(cents / 150);

await mkdir("temp/browser-verification", { recursive: true });
await runBrowser(
  "currency",
  "document.body.innerText.slice(0, 4000)",
  async ({ base, send, evaluate, waitFor, click, assert, errors, report, saveScreenshot }) => {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await send("Page.navigate", { url: base.href });
    await waitFor("document.documentElement.hasAttribute('data-glass')");
    await evaluate(`(async () => {
    const cache = await caches.open('guidepost-exchange-rates-v1');
    await cache.put('https://api.frankfurter.dev/v2/rates?base=EUR&providers=ecb', Response.json({
      fetchedAt: Date.now(), rates: [
        {base:'EUR',quote:'USD',date:'2026-10-29',rate:1.2},
        {base:'EUR',quote:'GBP',date:'2026-10-29',rate:0.8}
      ]
    }));
  })()`);
    await send("Page.navigate", { url: new URL("/kdm/collection/#/content?q=kingdom%20death%20monster", base).href });
    await waitFor("document.querySelector('input[aria-label=\"Have Kingdom Death: Monster, 1.6\"]:not(:disabled)')");
    await click("Have Kingdom Death: Monster, 1.6");
    await waitFor(`document.querySelector('.stat-value strong')?.textContent.includes(${JSON.stringify(String(cents / 100))})`);
    const usd = await evaluate<string>("document.querySelector('.stat-value strong').textContent");
    await click("Open menu");
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
    await evaluate("[...document.querySelectorAll('dialog button')].find(e=>e.textContent.trim().startsWith('Settings')).click()");
    await waitFor("document.querySelector('select[id$=\"-currency\"]')");
    await waitFor("document.querySelector('dialog .rate-note')?.textContent.includes('2026-10-29')");
    assert(await evaluate("!document.querySelector('.stat-value .rate-note')"), "The rate date is removed from the collection total");
    assert(
      await evaluate(
        "document.querySelector('select[id$=\"-currency\"]').getAttribute('aria-describedby') === document.querySelector('dialog .rate-note').id",
      ),
      "The rate status replaces the currency dropdown description",
    );
    assert(
      await evaluate(
        "JSON.stringify([...document.querySelector('select[id$=\"-currency\"]').options].map(option => option.value)) === JSON.stringify(['USD','EUR','GBP','CAD','AUD','JPY'])",
      ),
      "Settings offers the six common currencies",
    );
    await evaluate(
      "const select=document.querySelector('select[id$=\"-currency\"]'); select.value='GBP'; select.dispatchEvent(new Event('change',{bubbles:true}))",
    );
    await waitFor(`document.querySelector('.stat-value strong')?.textContent === ${JSON.stringify(gbp)}`);
    assert(true, "Changing the setting immediately converts the collection total");
    for (const width of [1280, 390]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
      await evaluate("document.fonts.ready");
      await saveScreenshot(`temp/browser-verification/currency-settings-${width}.png`);
      assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Settings fits at ${width}px`);
    }
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await waitFor("!document.querySelector('dialog[data-swipe-ignore]').open");
    for (const width of [1280, 390]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
      await saveScreenshot(`temp/browser-verification/currency-total-${width}.png`);
      assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Collection total fits at ${width}px`);
    }
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.currencyStartupTotals = [];
        new MutationObserver(() => {
          const total = document.querySelector('.stat-value strong')?.textContent.trim();
          if (total && window.currencyStartupTotals.at(-1) !== total) window.currencyStartupTotals.push(total);
        }).observe(document, {childList: true, characterData: true, subtree: true});
        const open = CacheStorage.prototype.open;
        CacheStorage.prototype.open = async function(name) {
          if (name === 'guidepost-exchange-rates-v1') await new Promise(resolve => setTimeout(resolve, 400));
          return open.call(this, name);
        };
      `,
    });
    await evaluate("window.currencyReloadSentinel = true");
    await send("Page.reload");
    await waitFor("!window.currencyReloadSentinel && document.querySelector('.stat-value strong')");
    await saveScreenshot("temp/browser-verification/currency-startup.png");
    await waitFor(`!window.currencyReloadSentinel && document.querySelector('.stat-value strong')?.textContent === ${JSON.stringify(gbp)}`);
    const startupTotals = await evaluate<string[]>("window.currencyStartupTotals");
    assert(
      !startupTotals.some((total) => total.includes("$")),
      `A saved GBP preference never flashes USD on refresh: ${JSON.stringify(startupTotals)}`,
    );
    assert(true, "Saved ownership, chosen currency, and cached rates survive reload");
    await click("Open menu");
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
    await evaluate("[...document.querySelectorAll('dialog button')].find(e=>e.textContent.trim().startsWith('Settings')).click()");
    await waitFor("document.querySelector('select[id$=\"-currency\"]')?.value === 'GBP'");
    await evaluate(
      "document.querySelector('select[id$=\"-currency\"]').value='USD'; document.querySelector('select[id$=\"-currency\"]').dispatchEvent(new Event('change',{bubbles:true}))",
    );
    await waitFor(`document.querySelector('.stat-value strong')?.textContent === ${JSON.stringify(usd)}`);
    assert(true, "Switching back to USD restores the original total");
    await evaluate("caches.delete('guidepost-exchange-rates-v1')");
    await evaluate("window.currencyReloadSentinel = true");
    await send("Page.navigate", { url: base.href });
    await waitFor("!window.currencyReloadSentinel && document.documentElement.hasAttribute('data-glass')");
    await click("Open menu");
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
    await evaluate("[...document.querySelectorAll('dialog button')].find(e=>e.textContent.trim().startsWith('Settings')).click()");
    await waitFor("document.querySelector('dialog .rate-note')?.textContent.includes('Default estimate: €1 = $1.13')");
    assert(true, "Settings identifies the built-in euro estimate before any rates are downloaded");
    for (const width of [1280, 390]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
      await saveScreenshot(`temp/browser-verification/currency-default-${width}.png`);
    }
    assert(errors.length === 0, `No browser runtime errors: ${JSON.stringify(errors)}`);
    await writeFile("temp/browser-verification/currency-report.json", JSON.stringify({ report, errors }, null, 2));
  },
);
