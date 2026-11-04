import { runBrowser } from "../support/harness.mts";

await runBrowser(
  {
    name: "menu",
    diagnostics:
      "JSON.stringify({text:document.body.innerText.slice(0,4000),state:history.state,dialog:document.querySelector('dialog[data-swipe-ignore]')?.outerHTML.slice(0,700),active:document.activeElement?.outerHTML.slice(0,400)})",
  },
  async ({ base, send, evaluate, waitFor, activate, assert, saveScreenshot, viewport, key, activateMenuButton, settle }) => {
    const settings = async () => {
      await activateMenuButton("Settings");
      await waitFor("document.querySelector('dialog[data-swipe-ignore] select') !== null");
    };
    const open = async () => {
      await evaluate("document.querySelector('[data-menu-trigger]').focus()");
      await activate("Open menu");
      await waitFor("document.querySelector('dialog[data-swipe-ignore]')?.open && document.activeElement?.matches('[data-menu-trigger]')");
      await settle("dialog[data-swipe-ignore] .sheet", false);
    };
    const closed = async () => {
      await waitFor(
        "!document.querySelector('dialog[data-swipe-ignore]')?.open && getComputedStyle(document.documentElement).overflow !== 'hidden'",
      );
    };
    const escape = async () => {
      await key("Escape");
      await closed();
    };
    const screenshot = async (name: string) => {
      await saveScreenshot(`menu-${name}.png`);
    };
    const gesture = async (selector: string, dy: number, input: "mouse" | "touch" = "mouse") => {
      const point = await evaluate<{ x: number; y: number }>(
        `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+Math.min(r.height/2,20)}})()`,
      );
      if (input === "touch") await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
      else await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      const samples: number[] = [];
      for (const fraction of [0.05, 0.1, 0.25, 0.5, 0.75, 1]) {
        const position = { x: point.x, y: point.y + dy * fraction };
        if (input === "touch") await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...position, id: 1 }] });
        else await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...position, button: "left", buttons: 1 });
        await evaluate("new Promise(requestAnimationFrame)");
        samples.push(
          await evaluate(
            "parseFloat(getComputedStyle(document.querySelector('dialog[data-swipe-ignore] .sheet')).translate.split(' ')[1])",
          ),
        );
      }
      if (input === "touch") await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      else await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y + dy, button: "left", clickCount: 1 });
      return samples;
    };

    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await viewport(1280);
    const keyboardRoutes = new Set(["/", "/kdm/hunt/", "/kdm/start/", "/kdm/showdown1/"]);
    for (const path of ["/", "/credits/", "/kdm/hunt/", "/kdm/start/", "/kdm/showdown1/", "/kdm/showdown2/", "/kdm/showdown3/"]) {
      await send("Page.navigate", { url: new URL(path, base).href });
      await waitFor("document.querySelector('[data-menu-trigger]') && document.querySelector('dialog[data-swipe-ignore]')");
      await waitFor("document.documentElement.hasAttribute('data-glass')");
      if (!keyboardRoutes.has(path)) {
        await activate("Open menu");
        await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
        assert(true, `${path}: menu mounts and opens`);
        await activate("Close menu");
        await closed();
        continue;
      }
      await evaluate("document.fonts.ready");
      await evaluate(`document.querySelector('[data-menu-trigger]').focus()`);
      await key("Escape");
      await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
      assert(
        await evaluate("document.activeElement?.matches('[data-menu-trigger][aria-label=\"Close menu\"]')"),
        `${path}: Escape focuses the close button`,
      );
      await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',repeat:true}))");
      assert(
        await evaluate("document.querySelector('dialog[data-swipe-ignore]').open"),
        `${path}: Escape opens the menu and ignores held-key repeats`,
      );
      await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
      await closed();
      assert(true, `${path}: Escape closes the menu`);
      if (path === "/kdm/hunt/") {
        await evaluate("document.querySelector('.selection').click()");
        await waitFor("document.querySelector('dialog:has(.dice)').open");
        await key("Escape");
        await waitFor("!document.querySelector('dialog:has(.dice)').open");
        assert(
          await evaluate("!document.querySelector('dialog[data-swipe-ignore]').open"),
          "Escape dismisses the active picker without opening the menu",
        );
      }
    }
    await send("Page.navigate", { url: new URL("/kdm/collection/#/content?q=kingdom%20death%20monster", base).href });
    await waitFor("document.querySelector('article input[type=checkbox]:not(:disabled)') !== null");
    await evaluate(`(()=>{
      const input=document.querySelector('input[type=search]');
      input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      for(const modifier of ['ctrlKey','altKey','metaKey','isComposing'])window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',[modifier]:true}));
    })()`);
    assert(
      await evaluate("!document.querySelector('dialog[data-swipe-ignore]').open"),
      "Escape in a search field and modified shortcuts leave the menu closed",
    );
    await evaluate("document.querySelector('[data-menu-trigger]').focus()");
    await evaluate("window.menuButtonIdentity = document.querySelector('[data-menu-trigger]')");
    await open();
    assert(
      await evaluate(
        "document.querySelectorAll('[data-menu-trigger]').length === 1 && document.querySelector('[data-menu-trigger]') === window.menuButtonIdentity && !document.querySelector('dialog[data-swipe-ignore]').matches(':modal')",
      ),
      "One persistent menu button remains usable with a nonmodal drawer",
    );
    assert(await evaluate("getComputedStyle(document.documentElement).overflow === 'hidden'"), "Desktop menu locks background scrolling");
    await screenshot("desktop-main");
    await escape();
    assert(
      await evaluate("document.querySelector('[data-menu-trigger]') === window.menuButtonIdentity"),
      "Closing retains the same menu button element",
    );
    assert(await evaluate("document.activeElement?.matches('[data-menu-trigger]')"), "Escape restores launcher focus");
    await evaluate("history.forward()");
    await waitFor("document.querySelector('dialog[data-swipe-ignore]')?.open");
    assert(true, "Forward reopens the menu history entry");
    await evaluate("history.back()");
    await closed();
    assert(true, "Back dismisses the menu and releases scrolling");
    await open();
    await gesture("dialog[data-swipe-ignore] [data-drag-handle]", 110);
    await closed();
    assert(true, "Desktop mouse drag still dismisses the menu");
    await open();
    await gesture("dialog[data-swipe-ignore] .row", 40);
    assert(
      await evaluate(
        "document.querySelector('dialog[data-swipe-ignore]').open && document.querySelector('dialog[data-swipe-ignore] h2').textContent.trim()==='Menu'",
      ),
      "Short mouse drag from a button snaps back without activating it",
    );
    await gesture("dialog[data-swipe-ignore] .row", 110);
    await closed();
    assert(true, "Desktop mouse drag from a button dismisses the menu");
    await open();
    await gesture("dialog[data-swipe-ignore] .navigation a", 40);
    assert(
      await evaluate("document.querySelector('dialog[data-swipe-ignore]').open && location.pathname.includes('collection')"),
      "Short mouse drag from a link does not navigate",
    );
    await gesture("dialog[data-swipe-ignore] .navigation a", 110);
    await closed();
    assert(await evaluate("location.pathname.includes('collection')"), "Desktop mouse drag from a link dismisses without navigating");
    await open();
    await gesture("dialog[data-swipe-ignore] .row:nth-child(2)", 0);
    await waitFor("document.querySelector('dialog[data-swipe-ignore] select') !== null");
    assert(true, "Desktop mouse click still opens Settings");
    await evaluate(
      "(()=>{const select=document.querySelector('dialog[data-swipe-ignore] select');select.value='day-first';select.dispatchEvent(new Event('change',{bubbles:true}))})()",
    );
    await waitFor(`new Promise((resolve,reject)=>{
      const request=indexedDB.open('guidepost');
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result,transaction=db.transaction('preferences'),row=transaction.objectStore('preferences').get('app');
        row.onsuccess=()=>resolve(row.result?.dateFormat==='day-first');
        row.onerror=()=>reject(row.error);
        transaction.oncomplete=()=>db.close();
      };
    })`);
    await screenshot("desktop-settings");
    await escape();
    await evaluate("window.menuReloadSentinel = true");
    await send("Page.reload");
    await waitFor("!window.menuReloadSentinel && /\\d{2}\\/\\d{2}\\/\\d{4}/.test(document.body?.innerText ?? '')");
    await waitFor("document.querySelector('article input[type=checkbox]:not(:disabled)') !== null");
    await open();
    await settings();
    assert(
      await evaluate("document.querySelector('dialog[data-swipe-ignore] select').value === 'day-first'"),
      "Date preference survives reload",
    );
    await evaluate("[...document.querySelectorAll('dialog[data-swipe-ignore] a')].find(e=>e.textContent.trim()==='Obsidian').click()");
    await waitFor("location.pathname.includes('showdown1') && document.querySelector('main.showdown')");
    await closed();
    await open();
    await settings();
    await activateMenuButton("Comfortable");
    await waitFor("document.querySelector('main.showdown').dataset.density === 'comfortable'");
    await evaluate("[...document.querySelectorAll('dialog[data-swipe-ignore] a')].find(e=>e.textContent.trim()==='Folio').click()");
    await waitFor("location.pathname.includes('showdown2') && document.querySelector('main.showdown')?.dataset.density === 'comfortable'");
    await closed();
    assert(true, "Showdown density survives theme link navigation");
    await viewport(390, 844);
    await send("Emulation.setTouchEmulationEnabled", { enabled: true });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await open();
    await screenshot("mobile-main");
    await gesture("dialog[data-swipe-ignore] .row", 40, "touch");
    assert(
      await evaluate(
        "document.querySelector('dialog[data-swipe-ignore]').open && document.querySelector('dialog[data-swipe-ignore] h2').textContent.trim()==='Menu'",
      ),
      "Short row drag snaps back without activating the row",
    );
    await settle("dialog[data-swipe-ignore] .sheet", false);
    const rowDrag = await gesture("dialog[data-swipe-ignore] .row", 110, "touch");
    await closed();
    assert(
      rowDrag.slice(-3).every((value, index) => Math.abs(value - 110 * [0.5, 0.75, 1][index]) < 1),
      "Touch row drag follows the finger each frame and dismisses",
    );
    await open();
    await gesture("dialog[data-swipe-ignore] .row:nth-child(2)", 0, "touch");
    await waitFor("document.querySelector('dialog[data-swipe-ignore] select') !== null");
    assert(true, "Touch tap still opens Settings");
    await screenshot("mobile-settings");
    await gesture("dialog[data-swipe-ignore] input[type=range]", 90, "touch");
    assert(
      await evaluate("document.querySelector('dialog[data-swipe-ignore]').open"),
      "Dragging a range control does not dismiss the menu",
    );
    await evaluate("document.querySelector('dialog[data-swipe-ignore] .body').scrollTop=200");
    await waitFor("document.querySelector('dialog[data-swipe-ignore] .body').scrollTop > 0");
    await gesture("dialog[data-swipe-ignore] .body", 90, "touch");
    assert(
      await evaluate("document.querySelector('dialog[data-swipe-ignore]').open"),
      "Dragging scrolled settings content does not dismiss the menu",
    );
    const handleDrag = await gesture("dialog[data-swipe-ignore] [data-drag-handle]", 240, "touch");
    await closed();
    assert(Math.abs(handleDrag.at(-1)! - 240) < 1, "Touch handle swipe stays with the finger beyond 180px and dismisses");
    await open();
    await gesture("dialog[data-swipe-ignore] header", 110, "touch");
    await closed();
    assert(true, "Touch header swipe dismisses the menu");
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await open();
    await gesture("dialog[data-swipe-ignore] .row", 110, "touch");
    await closed();
    assert(true, "Touch dismissal works with reduced motion");
    await open();
    await escape();
    assert(await evaluate("document.activeElement?.matches('[data-menu-trigger]')"), "Mobile Escape restores launcher focus");
  },
);
