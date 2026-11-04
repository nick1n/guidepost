import { readFile } from "node:fs/promises";
import { runBrowser } from "../support/harness.mts";

type StoredRow = { contentId: string; state: { owned?: boolean } };

await runBrowser(
  { name: "collection", diagnostics: "document.body.innerText.slice(0,4000)" },
  async ({ base, send, evaluate, waitFor, activate, assert, saveScreenshot, frames, viewport }) => {
    const rows = async () => {
      const records = await evaluate<StoredRow[]>(
        `(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('guidepost');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});try{return await new Promise((r,j)=>{const q=db.transaction('entries','readonly').objectStore('entries').getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})}finally{db.close()}})()`,
      );
      if (!Array.isArray(records)) throw new Error("Expected stored collection rows");
      return records;
    };
    const savedRows = async (matches: (rows: StoredRow[]) => unknown) => {
      let saved: StoredRow[] = [];
      await waitFor(async () => {
        saved = await rows();
        return matches(saved);
      });
      return saved;
    };
    const navigate = async (url: string) => {
      await send("Page.navigate", { url });
      const target = new URL(url);
      const query = new URLSearchParams(target.hash.split("?")[1]).get("q") ?? "";
      await waitFor(`document.querySelector('#catalog-search')?.value === ${JSON.stringify(query)}`);
      await waitFor("document.querySelector('article input[type=checkbox]:not(:disabled)') !== null");
    };
    const coreUrl = new URL("/kdm/collection/#/content?q=kingdom%20death%20monster", base).href;
    await viewport(1280);
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
    await activate("Have Kingdom Death: Monster, 1.6");
    await evaluate("document.querySelector('.edition-detail:not(.inactive) details.contents summary').click()");
    await progress("Remove ownership of Kingdom Death: Monster, 1.6", 100);
    await activate("View Kingdom Death: Monster, 1.3, includes gameplay");
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
      await viewport(width, 900, width === 390);
      await progress("Have Kingdom Death: Monster, 1.3", partial);
      await saveScreenshot(`collection-${width}.png`);
    }
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    assert(
      await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--duration-medium').trim()==='0s'"),
      "Reduced motion removes progress animation duration",
    );
    await send("Emulation.setEmulatedMedia", { features: [] });
    await activate("View Kingdom Death: Monster, 1.6, includes gameplay");
    await activate("Mark Butcher, Plastic missing");
    await waitFor("document.querySelector('.edition-detail:not(.inactive) .contents-count').textContent.includes('19 of 20 owned')");
    assert(
      await evaluate("document.querySelector('input[aria-label=\"Remove ownership of Kingdom Death: Monster, 1.6\"]').checked"),
      "Missing component leaves product owned",
    );
    await activate("Remove ownership of Kingdom Death: Monster, 1.6");
    await activate("Have Kingdom Death: Monster, 1.6");
    await waitFor("document.querySelector('.edition-detail:not(.inactive) .contents-count').textContent.includes('20 of 20')");
    let saved = await savedRows((rows) => rows.length === 1 && rows[0].contentId === "core" && rows[0].state.owned);
    assert(
      saved.length === 1 && saved[0].contentId === "core" && saved[0].state.owned,
      "Rechecking restores contents and removes missing record",
    );
    await activate("Remove ownership of Kingdom Death: Monster, 1.6");
    await activate("Have Butcher, Plastic");
    await activate("Have Kingdom Death: Monster, 1.6");
    await activate("Remove ownership of Kingdom Death: Monster, 1.6");
    saved = await savedRows((rows) => rows.length === 1 && rows[0].contentId === "butcher" && rows[0].state.owned);
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
    saved = await savedRows((rows) => rows.some((r) => r.contentId === "butcher" && r.state.owned));
    assert(
      saved.some((r) => r.contentId === "butcher" && r.state.owned),
      "Separate component ownership survives reload",
    );
    await activate("Mark Butcher, Plastic missing");
    await waitFor("document.querySelector('input[aria-label=\"Have Butcher, Plastic\"]')?.checked === false");
    assert(
      (await savedRows((rows) => rows.length === 0)).length === 0,
      "Unchecking a standalone component removes its empty record without a missing override",
    );
    for (const width of [1280, 390]) {
      await viewport(width, 900, width === 390);
      await navigate(new URL("/kdm/collection/", base).href);
      await evaluate("document.querySelectorAll('article')[80].scrollIntoView()");
      await waitFor("!document.querySelectorAll('article')[80].querySelector('.pending')");
      await frames();
      const height = await evaluate<number>("document.querySelectorAll('article')[80].getBoundingClientRect().height");
      await evaluate("scrollTo(0, 0); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
      await evaluate("document.querySelector('.collapse-all').click()");
      await waitFor("document.querySelectorAll('article')[80].querySelector('.card-body').hidden");
      await frames();
      await evaluate("document.querySelector('.collapse-all').click()");
      await waitFor("!document.querySelectorAll('article')[80].querySelector('.card-body').hidden");
      await frames();
      assert(
        Math.abs((await evaluate<number>("document.querySelectorAll('article')[80].getBoundingClientRect().height")) - height) < 1,
        `Offscreen card retains its expanded height after collapse and expand at ${width}px`,
      );
    }
    const category = (name: string) =>
      `[...document.querySelectorAll('.categories button')].find(e => e.textContent.trim() === ${JSON.stringify(name)})`;
    const search = async (value: string) => {
      await evaluate("document.querySelector('#catalog-search').focus(); document.querySelector('#catalog-search').select()");
      await send("Input.insertText", { text: value });
    };
    for (const width of [1280, 390]) {
      await viewport(width, 900, width === 390);
      await navigate(new URL("/kdm/collection/#/accessories?q=dice&tag=dice", base).href);
      await waitFor(
        `${category("Accessories")}.getAttribute('aria-pressed') === 'true' && document.querySelector('#catalog-search').value === 'dice'`,
      );
      assert(
        await evaluate("location.search === '' && document.querySelector('.active-tag')?.textContent.trim() === 'dice'"),
        `Hash deep link restores category, search, and tags at ${width}px`,
      );
      await evaluate("document.querySelector('.active-tag').click()");
      await search("black dice");
      await waitFor("location.hash === '#/accessories?q=black+dice'");
      assert(await evaluate("document.activeElement.id === 'catalog-search'"), `Search hash updates retain focus at ${width}px`);
      await evaluate(`${category("Content")}.click()`);
      await waitFor("location.hash === '#/content?q=black+dice'");
      await evaluate("document.querySelector('.clear-text').click()");
      await waitFor("location.hash === ''");
      assert(await evaluate("location.search === ''"), `Clearing the default content view removes the hash at ${width}px`);
      await evaluate("location.hash = '/bundles'");
      await waitFor(`${category("Bundles")}.getAttribute('aria-pressed') === 'true'`);
      await evaluate("location.hash = '/homebrew'");
      await waitFor(`${category("Homebrew")}.getAttribute('aria-pressed') === 'true'`);
      await evaluate("history.back()");
      await waitFor(`${category("Bundles")}.getAttribute('aria-pressed') === 'true'`);
      await evaluate("history.forward()");
      await waitFor(`${category("Homebrew")}.getAttribute('aria-pressed') === 'true'`);
      assert(true, `Native hash changes and Back/Forward restore categories at ${width}px`);
      await activate("Open menu");
      await waitFor("document.querySelector('dialog[data-swipe-ignore]')?.open");
      await evaluate(`${category("Accessories")}.click()`);
      await waitFor(`${category("Accessories")}.getAttribute('aria-pressed') === 'true'`);
      if (await evaluate("document.querySelector('dialog[data-swipe-ignore]')?.open")) await activate("Close menu");
      await waitFor("!document.querySelector('dialog[data-swipe-ignore]')?.open");
      assert(
        await evaluate("location.hash === '#/accessories' && document.querySelector('#catalog-search').value === ''"),
        `Menu dismissal retains the latest collection hash at ${width}px`,
      );
      await evaluate("document.querySelector('.stat-owned').click()");
      assert(await evaluate("location.hash === '#/accessories'"), `Ownership filtering stays out of the URL at ${width}px`);
      await saveScreenshot(`collection-hash-${width}.png`);
    }
    const card = (id: string) => `document.getElementById(${JSON.stringify(`card-body-${id}`)})?.closest('article')`;
    const disciple = card("disciple-of-the-witch-6");
    const disciples = card("set-disciples-of-the-witch");
    const data = JSON.parse(await readFile("static/kdm/catalog/data.json", "utf8"));
    const label = data.content["disciple-of-the-witch-6"].editions.find((edition: { id: string }) => edition.id === "plastic").label;
    await viewport(590, 900, false);
    await navigate(new URL("/kdm/collection/#/content?q=disciple%20of%20the%20witch", base).href);
    await waitFor(`${disciples} !== undefined`);
    await evaluate(`${disciples}.scrollIntoView()`);
    const setOwned = `${disciples}.querySelector('.editions input[type=checkbox]')`;
    await waitFor(`${setOwned} && !${setOwned}.disabled`);
    await evaluate(`${setOwned}.click()`);
    await waitFor(`${setOwned}.checked`);
    const component = `${disciples}.querySelector('.contents input[aria-label*="Disciple of the Witch 6,"]')`;
    await evaluate(`${disciples}.querySelector('.contents summary').click()`);
    await waitFor(`${component}?.checked===true`);
    await evaluate(`${component}.click()`);
    await waitFor(`${component}?.checked===false`);
    await evaluate(`${component}.click()`);
    await waitFor(`${component}?.checked===true`);
    await evaluate(`${disciple}.scrollIntoView()`);
    await saveScreenshot("disciples-component-restored.png");
    const owned = `${disciple}.querySelector('input[aria-label=${JSON.stringify(`Remove ownership of Disciple of the Witch 6, ${label}`)}]')`;
    assert(await evaluate(`${owned}?.checked`), "Rechecking an included Disciple restores its individual ownership checkbox");
    for (const width of [590, 390, 1280]) {
      await viewport(width, 900, width === 390);
      await evaluate(`${disciple}.scrollIntoView(); new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      assert(
        await evaluate(
          `(()=>{const e=${disciple}.querySelector('.edition-summary:not(.inactive)');const b=e.querySelector('.badges').getBoundingClientRect();return !e.querySelector('.edition-value') && Math.abs(b.right-e.getBoundingClientRect().right)<1})()`,
        ),
        `Included-only edition has no price and Models only badge stays right at ${width}px`,
      );
      await saveScreenshot(`disciples-after-${width}.png`);
    }
    await evaluate(`${setOwned}.click()`);
    await waitFor(`${setOwned}.checked===false`);
    await evaluate(`${setOwned}.click()`);
    await waitFor(`${setOwned}.checked===true`);
    assert(
      await evaluate(`${disciple}.querySelectorAll('.edition').length===3`),
      "Disciples have one Plastic edition after acquiring the set",
    );
    assert(await evaluate(`${owned}?.checked`), "Rechecking the set owns the canonical Plastic model");

    await saveScreenshot("ownership.png");
  },
);
