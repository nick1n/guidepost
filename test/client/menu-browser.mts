import { mkdir, writeFile } from "node:fs/promises";
import { runBrowser } from "./browser-harness.mts";

await mkdir("temp/browser-verification", { recursive: true });
await runBrowser(
  "menu",
  "JSON.stringify({text:document.body.innerText.slice(0,4000),state:history.state,dialog:document.querySelector('dialog[data-swipe-ignore]')?.outerHTML.slice(0,700),active:document.activeElement?.outerHTML.slice(0,400)})",
  async ({ base, send, evaluate, waitFor, click, errors, report, assert, saveScreenshot }) => {
    const button = (text: string) =>
      `[...document.querySelectorAll('dialog[data-swipe-ignore] button')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(text)}))`;
    const settings = async () => {
      await evaluate(`${button("Settings")}.click()`);
      await waitFor("document.querySelector('dialog[data-swipe-ignore] select') !== null");
    };
    const open = async () => {
      await evaluate("document.querySelector('[data-menu-trigger]').focus()");
      await click("Open menu");
      await waitFor(
        "document.querySelector('dialog[data-swipe-ignore]')?.open && document.activeElement?.closest('dialog[data-swipe-ignore]')",
      );
    };
    const closed = async () => {
      await waitFor(
        "!document.querySelector('dialog[data-swipe-ignore]')?.open && getComputedStyle(document.documentElement).overflow !== 'hidden'",
      );
    };
    const escape = async () => {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await closed();
    };
    const screenshot = async (name: string) => {
      await saveScreenshot(`temp/browser-verification/menu-${name}.png`);
    };
    const gesture = async (selector: string, dy: number) => {
      const point = await evaluate<{ x: number; y: number }>(
        `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+Math.min(r.height/2,20)}})()`,
      );
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      for (const fraction of [0.25, 0.5, 0.75, 1])
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y + dy * fraction, button: "left", buttons: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y + dy, button: "left", clickCount: 1 });
    };

    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: new URL("/kdm/collection/?q=kingdom%20death%20monster", base).href });
    await waitFor("document.querySelector('article input[type=checkbox]:not(:disabled)') !== null");
    await evaluate("document.querySelector('[data-menu-trigger]').focus()");
    await open();
    assert(await evaluate("getComputedStyle(document.documentElement).overflow === 'hidden'"), "Desktop menu locks background scrolling");
    await screenshot("desktop-main");
    await escape();
    assert(await evaluate("document.activeElement?.matches('[data-menu-trigger]')"), "Escape restores launcher focus");
    await evaluate("history.forward()");
    await waitFor("document.querySelector('dialog[data-swipe-ignore]')?.open");
    assert(true, "Forward reopens the menu history entry");
    await evaluate("history.back()");
    await closed();
    assert(true, "Back dismisses the menu and releases scrolling");
    await open();
    await settings();
    await evaluate(
      "(()=>{const select=document.querySelector('dialog[data-swipe-ignore] select');select.value='day-first';select.dispatchEvent(new Event('change',{bubbles:true}))})()",
    );
    await waitFor("localStorage.getItem('guidepost.date-format') === 'day-first'");
    await screenshot("desktop-settings");
    await escape();
    await evaluate("window.menuReloadSentinel = true");
    await send("Page.reload");
    await waitFor("!window.menuReloadSentinel && /\\d{2}\\/\\d{2}\\/\\d{4}/.test(document.body.innerText)");
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
    await evaluate(`${button("Comfortable")}.click()`);
    await waitFor("document.querySelector('main.showdown').dataset.density === 'comfortable'");
    await evaluate("[...document.querySelectorAll('dialog[data-swipe-ignore] a')].find(e=>e.textContent.trim()==='Folio').click()");
    await waitFor("location.pathname.includes('showdown2') && document.querySelector('main.showdown')?.dataset.density === 'comfortable'");
    await closed();
    assert(true, "Showdown density survives theme link navigation");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await open();
    await screenshot("mobile-main");
    await settings();
    await screenshot("mobile-settings");
    await gesture("dialog[data-swipe-ignore] input[type=range]", 90);
    assert(
      await evaluate("document.querySelector('dialog[data-swipe-ignore]').open"),
      "Dragging a range control does not dismiss the menu",
    );
    await evaluate("document.querySelector('dialog[data-swipe-ignore] .body').scrollTop=200");
    await waitFor("document.querySelector('dialog[data-swipe-ignore] .body').scrollTop > 0");
    await gesture("dialog[data-swipe-ignore] .body", 90);
    assert(
      await evaluate("document.querySelector('dialog[data-swipe-ignore]').open"),
      "Dragging scrolled settings content does not dismiss the menu",
    );
    await gesture("dialog[data-swipe-ignore] [data-drag-handle]", 110);
    await closed();
    assert(true, "Downward handle swipe dismisses the menu");
    await open();
    await escape();
    assert(await evaluate("document.activeElement?.matches('[data-menu-trigger]')"), "Mobile Escape restores launcher focus");
    assert(errors.length === 0, "No browser runtime exceptions, window errors, or error logs");
    await writeFile("temp/browser-verification/menu-report.json", JSON.stringify({ report, errors }, null, 2));
  },
);
