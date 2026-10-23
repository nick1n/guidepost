import { mkdir, writeFile } from "node:fs/promises";
import { runBrowser } from "./browser-harness.mts";

await mkdir("temp/browser-verification", { recursive: true });
await runBrowser(
  "hunt-picker",
  "JSON.stringify({text:document.body.innerText,active:document.activeElement?.outerHTML})",
  async ({ base, send, evaluate, waitFor, assert, errors, report, saveScreenshot }) => {
    const picker = "document.querySelector('dialog:has(.dice)')";
    const frames = () => evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
    const settled = () => evaluate(`Promise.all(${picker}.getAnimations().map(a=>a.finished.catch(()=>{})))`);
    const closed = async () => {
      await waitFor(`!${picker}.open && getComputedStyle(${picker}).display==='none'`);
      await frames();
    };
    const open = async (inspect = false) => {
      await closed();
      await evaluate("document.querySelector('.selection').focus();document.querySelector('.selection').click()");
      await waitFor(`${picker}.open`);
      await frames();
      if (inspect) {
        const motion = await evaluate<{ start: number; halfway: number; end: number }>(`(async()=>{
          const d=${picker},a=d.getAnimations().find(a=>a.transitionProperty==='translate');
          if(!a)throw new Error('Expected the opening slide animation');
          a.pause();a.currentTime=0;await new Promise(requestAnimationFrame);
          const start=d.getBoundingClientRect().top;
          a.currentTime=Number(a.effect.getTiming().duration)/2;await new Promise(requestAnimationFrame);
          const halfway=d.getBoundingClientRect().top;
          a.finish();await new Promise(requestAnimationFrame);
          return {start,halfway,end:d.getBoundingClientRect().top};
        })()`);
        assert(motion.start >= 900 && motion.halfway > motion.end, "Dialog opens from below the screen and slides upward");
      }
      await settled();
      await frames();
    };
    const clickAt = async (point: { x: number; y: number }) => {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
    };
    const closeButton = async () => {
      const point = await evaluate<{ x: number; y: number }>(
        `(()=>{const r=${picker}.querySelector('.close').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
      );
      await clickAt(point);
      await closed();
    };
    const gesture = async (selector: string, dx: number, dy: number, input: "mouse" | "touch", cancel = false) => {
      const point = await evaluate<{ x: number; y: number }>(
        `(()=>{const r=${picker}.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
      );
      if (input === "touch") await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
      else await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
      const distances: number[] = [];
      for (const fraction of [0.05, 0.15, 0.3, 0.5, 0.75, 1]) {
        const position = { x: point.x + dx * fraction, y: point.y + dy * fraction };
        if (input === "touch") await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...position, id: 1 }] });
        else await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...position, button: "left", buttons: 1 });
        await evaluate("new Promise(requestAnimationFrame)");
        distances.push(await evaluate(`parseFloat(getComputedStyle(${picker}).translate.split(' ').at(-1))`));
      }
      if (input === "touch") await send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
      else
        await send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x: point.x + dx,
          y: point.y + dy,
          button: "left",
          clickCount: 1,
        });
      await frames();
      await settled();
      await frames();
      return distances;
    };
    const assertOpen = async (message: string) => assert(await evaluate(`${picker}.open`), message);
    const assertFocus = async () =>
      assert(await evaluate("document.activeElement.matches('.selection')"), "Closing restores focus to event selection");

    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: new URL("/kdm/hunt/", base).href });
    await waitFor("document.querySelector('.card') && getComputedStyle(document.querySelector('.slide')).transform==='none'");
    await open(true);
    assert(
      await evaluate(`(()=>{
        const d=${picker},button=d.querySelector('.close'),r=button.getBoundingClientRect(),body=d.querySelector('.dice').getBoundingClientRect();
        return !d.querySelector('header button')&&button.textContent==='Close'&&r.top>=body.bottom&&Math.abs(r.width-body.width+32)<1;
      })()`),
      "A full-width Close button replaces the header icon below the dice",
    );
    assert(
      await evaluate(`(()=>{const b=${picker}.querySelector('.dice');return b.clientHeight===b.scrollHeight})()`),
      "The dice do not scroll when all ten rows fit",
    );
    await saveScreenshot("temp/browser-verification/hunt-picker-desktop.png");
    await closeButton();
    await assertFocus();
    await open();
    await gesture("header", 0, 32, "mouse");
    await assertOpen("A short mouse drag snaps back without dismissing");
    assert(
      await evaluate(`getComputedStyle(${picker}).translate==='0px' || getComputedStyle(${picker}).translate==='0px 0px'`),
      "Short drag returns the dialog to its starting position",
    );
    await gesture("header", 0, 110, "mouse");
    await closed();
    await assertFocus();
    assert(true, "Mouse swipe down dismisses the dialog");
    await open();
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await closed();
    await assertFocus();
    await open();
    const backdrop = await evaluate<{ x: number; y: number }>(
      `(()=>{const r=${picker}.getBoundingClientRect();return {x:r.x-12,y:r.y+r.height/2}})()`,
    );
    await clickAt(backdrop);
    await closed();
    assert(true, "Backdrop click still dismisses the dialog");

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await open();
    const movement = await gesture("header", 0, 110, "touch");
    await closed();
    assert(
      movement.slice(-3).every((distance, i) => Math.abs(distance - 110 * [0.5, 0.75, 1][i]) < 1),
      "Touch drag follows the finger and dismisses on release",
    );
    await assertFocus();
    await open();
    await evaluate(`${picker}.querySelector('[aria-label="Tens 1"]').click();${picker}.querySelector('[aria-label="Ones 7"]').click()`);
    await settled();
    const selection = await evaluate<string>("document.querySelector('.selection').getAttribute('aria-label')");
    await gesture('[aria-label="Tens 2"]', 0, 110, "touch");
    await closed();
    assert(
      await evaluate(`document.querySelector('.selection').getAttribute('aria-label')===${JSON.stringify(selection)}`),
      "Dragging a die dismisses without selecting it",
    );
    await open();
    await gesture("header", 0, 32, "touch");
    await assertOpen("A short touch swipe keeps the dialog open");
    await gesture("header", 100, 0, "touch");
    await assertOpen("A sideways gesture keeps the dialog open");
    await gesture("header", 0, -100, "touch");
    await assertOpen("An upward gesture keeps the dialog open");
    await gesture("header", 0, 110, "touch", true);
    await assertOpen("A canceled touch gesture snaps back without closing");
    await saveScreenshot("temp/browser-verification/hunt-picker-mobile.png");
    await closeButton();

    await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
    await open();
    assert(
      await evaluate(
        `(()=>{const d=${picker},r=d.getBoundingClientRect(),b=d.querySelector('.dice'),c=d.querySelector('.close').getBoundingClientRect();return b.scrollHeight>b.clientHeight&&r.top>=0&&r.bottom<=innerHeight&&c.bottom<=r.bottom&&c.top>=r.top})()`,
      ),
      "Short screens scroll the dice while keeping Close visible",
    );
    await evaluate(`${picker}.querySelector('.dice').scrollTop=100`);
    await gesture(".dice", 0, 90, "touch");
    await assertOpen("Dragging scrolled dice content preserves native scrolling");
    await evaluate(`${picker}.querySelector('.dice').scrollTop=100`);
    await saveScreenshot("temp/browser-verification/hunt-picker-landscape.png");
    await gesture("header", 0, 110, "touch");
    await closed();
    assert(true, "The drag handle dismisses even when dice content is scrolled");

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await open();
    assert(
      await evaluate(`getComputedStyle(${picker}).transitionDuration.split(',').every(d=>d.trim()==='0s')`),
      "Reduced motion disables the opening and closing animations",
    );
    await gesture("header", 0, 110, "touch");
    await closed();
    await assertFocus();
    assert(true, "Swipe dismissal still works with reduced motion");
    assert(errors.length === 0, `No browser runtime errors: ${JSON.stringify(errors)}`);
    await writeFile("temp/browser-verification/hunt-picker-report.json", JSON.stringify({ report, errors }, null, 2));
  },
);
