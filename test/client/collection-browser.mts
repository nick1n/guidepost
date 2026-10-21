import { mkdir, writeFile } from "node:fs/promises";
import { runBrowser } from "./browser-harness.mts";

type StoredRow = { contentId: string; state: { owned?: boolean } };

await mkdir("temp/browser-verification", { recursive: true });
await runBrowser(
  "browser",
  "document.body.innerText.slice(0,4000)",
  async ({ base, send, evaluate, waitFor, click, errors, report, assert, saveScreenshot }) => {
    const rows = async () => {
      const records = await evaluate<StoredRow[]>(
        `(async()=>{await new Promise(r=>setTimeout(r,200));const db=await new Promise((r,j)=>{const q=indexedDB.open('guidepost-collection');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});try{return await new Promise((r,j)=>{const q=db.transaction('entries','readonly').objectStore('entries').getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})}finally{db.close()}})()`,
      );
      if (!Array.isArray(records)) throw new Error("Expected stored collection rows");
      return records;
    };
    const navigate = async (url: string) => {
      await send("Page.navigate", { url });
      await waitFor("document.querySelector('article input[type=checkbox]:not(:disabled)') !== null");
    };
    const coreUrl = new URL("/kdm/collection/?q=kingdom%20death%20monster", base).href;
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await navigate(coreUrl);
    async function progress(label: string, expected: number) {
      const selector = `document.querySelector('input[aria-label="${label}"]').closest('.edition')`;
      await waitFor(`Math.abs(parseFloat(getComputedStyle(${selector}).getPropertyValue('--ownership-progress')) - ${expected}) < 0.1`);
      const settled = `(()=>{
      const row=${selector};
      const probe=document.createElement('div');
      row.append(probe);
      probe.style.borderImageSource='linear-gradient(to left, var(--grey-7) ${expected}%, var(--grey-8) 0)';
      const expected=getComputedStyle(probe).borderImageSource;
      probe.remove();
      return getComputedStyle(row).borderImageSource===expected && getComputedStyle(row).transitionProperty.includes('--ownership-progress');
    })()`;
      // The progress reaches its target before the temporary highlight finishes fading back to grey.
      await waitFor(settled);
      assert(await evaluate(settled), `Grey right-to-left animated progress at ${expected}%`);
    }
    await progress("Have Kingdom Death: Monster, 1.6", 0);
    await click("Have Kingdom Death: Monster, 1.6");
    await evaluate("document.querySelector('.edition-detail:not(.inactive) details.contents summary').click()");
    await progress("Remove ownership of Kingdom Death: Monster, 1.6", 100);
    await click("View Kingdom Death: Monster, 1.3, includes gameplay");
    assert(
      await evaluate(
        "[...document.querySelectorAll('.edition-detail:not(.inactive) .included-owned')].some(e=>e.textContent.trim().startsWith('Owned:'))",
      ),
      "Other-edition labels use Owned text",
    );
    assert(
      await evaluate("[...document.querySelectorAll('input[type=checkbox]')].every(e=>!e.indeterminate)"),
      "Other-edition ownership does not draw minus indicators",
    );
    const partial = await evaluate<number>(
      "parseFloat(document.querySelector('input[aria-label=\"Have Kingdom Death: Monster, 1.3\"]').closest('.edition').style.getPropertyValue('--ownership-progress'))",
    );
    assert(typeof partial === "number" && partial > 0 && partial < 100, "Other editions count only matching contents toward progress");
    await progress("Have Kingdom Death: Monster, 1.3", partial);
    assert(
      await evaluate("document.querySelector('.edition-detail:not(.inactive) details.contents').open"),
      "Included contents stay open when editions change",
    );
    for (const width of [1280, 390]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
      await progress("Have Kingdom Death: Monster, 1.3", partial);
      await saveScreenshot(`temp/browser-verification/collection-${width}.png`);
    }
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    assert(
      await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--duration-medium').trim()==='0s'"),
      "Reduced motion removes progress animation duration",
    );
    await send("Emulation.setEmulatedMedia", { features: [] });
    await click("View Kingdom Death: Monster, 1.6, includes gameplay");
    await click("Mark Butcher, Plastic missing");
    await waitFor("document.querySelector('.edition-detail:not(.inactive) .contents-count').textContent.includes('19 of 20 owned')");
    assert(
      await evaluate("document.querySelector('input[aria-label=\"Remove ownership of Kingdom Death: Monster, 1.6\"]').checked"),
      "Missing component leaves product owned",
    );
    await click("Remove ownership of Kingdom Death: Monster, 1.6");
    await click("Have Kingdom Death: Monster, 1.6");
    await waitFor("document.querySelector('.edition-detail:not(.inactive) .contents-count').textContent.includes('20 of 20')");
    let saved = await rows();
    assert(
      saved.length === 1 && saved[0].contentId === "core" && saved[0].state.owned,
      "Rechecking restores contents and removes missing record",
    );
    await click("Remove ownership of Kingdom Death: Monster, 1.6");
    await click("Have Butcher, Plastic");
    await click("Have Kingdom Death: Monster, 1.6");
    await click("Remove ownership of Kingdom Death: Monster, 1.6");
    saved = await rows();
    assert(
      saved.length === 1 && saved[0].contentId === "butcher" && saved[0].state.owned,
      "Removing product preserves separately acquired component and removes empty product row",
    );
    await evaluate("window.verificationReloadSentinel = true");
    await send("Page.reload");
    await waitFor(
      "!window.verificationReloadSentinel && document.querySelector('input[aria-label=\"Have Kingdom Death: Monster, 1.6\"]:not(:disabled)') !== null && document.querySelector('.edition-detail:not(.inactive) details.contents summary') !== null",
    );
    await evaluate("document.querySelector('.edition-detail:not(.inactive) details.contents summary').click()");
    await waitFor("document.querySelector('input[aria-label=\"Mark Butcher, Plastic missing\"]')?.checked === true");
    assert(
      (await rows()).some((r) => r.contentId === "butcher" && r.state.owned),
      "Separate component ownership survives reload",
    );
    await click("Mark Butcher, Plastic missing");
    await waitFor("document.querySelector('input[aria-label=\"Have Butcher, Plastic\"]')?.checked === false");
    assert((await rows()).length === 0, "Unchecking a standalone component removes its empty record without a missing override");
    assert(errors.length === 0, "No browser runtime exceptions, window errors, or error logs");
    await saveScreenshot("temp/browser-verification/ownership.png");
    await writeFile("temp/browser-verification/report.json", JSON.stringify({ report, errors }, null, 2));
  },
);
