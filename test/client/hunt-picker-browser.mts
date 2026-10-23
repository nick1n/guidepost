import { mkdir, writeFile } from "node:fs/promises";
import { runBrowser } from "./browser-harness.mts";

await mkdir("temp/browser-verification", { recursive: true });
await runBrowser(
  "hunt-picker",
  "JSON.stringify({text:document.body.innerText,active:document.activeElement?.outerHTML})",
  async ({ base, send, evaluate, waitFor, assert, errors, report, saveScreenshot }) => {
    const picker = "document.querySelector('dialog:has(.dice)')";
    const sheet = `${picker}.querySelector('.sheet')`;
    const frames = () => evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
    const settled = () => evaluate(`Promise.all(${picker}.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))`);
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
          const d=${sheet},a=d.getAnimations().find(a=>a.transitionProperty==='translate');
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
        distances.push(await evaluate(`parseFloat(getComputedStyle(${sheet}).translate.split(' ').at(-1))`));
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
    const key = async (key: string, code = key, modifiers = 0) => {
      const windowsVirtualKeyCode =
        ({ Tab: 9, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35 } as Record<string, number>)[key] ??
        key.charCodeAt(0);
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode, modifiers });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode, modifiers });
      await frames();
    };
    const assertDigitFocus = async (place: string, digit: number) =>
      assert(
        await evaluate(`document.activeElement.getAttribute('aria-label').toLowerCase()==='${place.toLowerCase()} ${digit}'`),
        `Keyboard focus reaches ${place.toLowerCase()} ${digit}`,
      );
    const assertEvent = async (value: number) =>
      assert(
        await evaluate(`document.querySelector('.selection').getAttribute('aria-label').endsWith('event ${value}')`),
        `Keyboard selects event ${value}`,
      );
    const assertColumn = async (place?: number) => {
      const highlighted = await evaluate<number[]>(`[...${picker}.querySelectorAll('fieldset')]
        .filter(column=>getComputedStyle(column.querySelector('legend'),'::before').content!=='none')
        .map(column=>Number(column.dataset.place))`);
      assert(
        JSON.stringify(highlighted) === JSON.stringify(place ? [place] : []),
        place
          ? `Only the ${place === 10 ? "tens" : "ones"} column has a keyboard indicator`
          : "No column indicator is shown for pointer input or Close",
      );
    };
    const cardReady = () =>
      waitFor(`(()=>{
      const slide=document.querySelector('.slide:not([inert])');
      return slide&&document.querySelectorAll('.slide').length===1&&!document.querySelector('.stage .load-status')
        &&getComputedStyle(slide).transform==='none'&&!slide.getAnimations().some(a=>a.playState==='running');
    })()`);
    const verifySelectionBurst = async (
      input: "click" | "numbers" | "arrows",
      expected: number,
      sequence = "1234567890123456",
      gap = 40,
    ) => {
      await cardReady();
      const during = await evaluate<{ out: number; in: number }>(`(async()=>{
        const stage=document.querySelector('.stage'),counts={out:0,in:0};
        const count=event=>{if(event.target.matches('.slide'))counts[event.type==='outrostart'?'out':'in']++};
        stage.addEventListener('outrostart',count,true);stage.addEventListener('introstart',count,true);
        window.selectionCounts=counts;
        window.stopCountingSelection=()=>{
          stage.removeEventListener('outrostart',count,true);stage.removeEventListener('introstart',count,true);
        };
        const picker=${picker};
        if(${JSON.stringify(input)}==='arrows')picker.querySelector('[data-place="10"] [aria-pressed="true"]').focus();
        const sequence=${JSON.stringify(sequence)};
        for(let index=0;index<sequence.length;index++){
          const digit=sequence[index];
          if(${JSON.stringify(input)}==='click')picker.querySelector('[data-place="10"] [data-digit="'+digit+'"]').click();
          else document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{
            key:${JSON.stringify(input)}==='numbers'?digit:'ArrowDown',bubbles:true,cancelable:true
          }));
          await new Promise(resolve=>setTimeout(resolve,index===sequence.length-1?40:${gap}));
        }
        return {...counts};
      })()`);
      assert(
        during.out === 1 && during.in === 0,
        `${input} (${gap}ms gaps): selection slides out once and stays offscreen during input, got ${JSON.stringify(during)}`,
      );
      await waitFor("window.selectionCounts.in>=1");
      await cardReady();
      const final = await evaluate<{ out: number; in: number; src: string }>(
        "({...window.selectionCounts,src:document.querySelector('.slide:not([inert]) .card .front').src})",
      );
      assert(
        final.out === 1 && final.in === 1 && final.src.endsWith(`-${expected}.jpg`),
        `${input} (${gap}ms gaps): only the final selected card slides in after input pauses, got ${JSON.stringify(final)}`,
      );
      await evaluate("window.stopCountingSelection()");
    };

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
    await assertColumn();
    await key("Tab");
    await assertColumn(1);
    await key("Tab", "Tab", 8);
    await assertColumn(10);
    assert(
      await evaluate(`[...${picker}.querySelectorAll('fieldset')].every(column=>{
        const style=getComputedStyle(column);
        return style.boxShadow==='none'&&style.backgroundColor==='rgba(0, 0, 0, 0)';
      })`),
      "Keyboard highlighting is confined to the label, with no column tint or bottom bar",
    );
    await saveScreenshot("temp/browser-verification/hunt-column-tens.png");
    await clickAt(
      await evaluate(`(()=>{
      const r=${picker}.querySelector('[data-place="10"] [data-digit="0"]').getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2};
    })()`),
    );
    await assertColumn();
    await assertDigitFocus("Tens", 0);
    await key("ArrowDown");
    await assertColumn(10);
    await assertEvent(11);
    await assertDigitFocus("Tens", 1);
    await key("ArrowUp");
    await assertEvent(1);
    await key("ArrowUp");
    await assertEvent(91);
    await key("Home");
    await assertEvent(11);
    await key("End");
    await assertEvent(1);
    await key("ArrowRight");
    await assertColumn(1);
    await assertDigitFocus("Ones", 1);
    await key("ArrowDown");
    await assertEvent(2);
    await key("ArrowUp");
    await assertEvent(1);
    await key("ArrowLeft");
    await assertColumn(10);
    await assertDigitFocus("Tens", 0);
    await key("Tab");
    await assertDigitFocus("Ones", 1);
    await key("Tab");
    assert(await evaluate("document.activeElement.matches('dialog:has(.dice) .close')"), "Tab skips unselected dice and reaches Close");
    await assertColumn();
    for (const [digit, event, column] of [
      [3, 31, 10],
      [7, 37, 1],
      [4, 47, 10],
      [2, 42, 1],
      [0, 2, 10],
      [0, 100, 1],
    ]) {
      await key(String(digit), `Digit${digit}`);
      await assertEvent(event);
      await assertColumn(column);
    }
    await saveScreenshot("temp/browser-verification/hunt-column-ones.png");
    await key("8", "Numpad8");
    await key("5", "Numpad5");
    await assertEvent(85);
    await evaluate(`${picker}.dispatchEvent(new KeyboardEvent('keydown',{key:'9',ctrlKey:true,bubbles:true}));
      ${picker}.dispatchEvent(new KeyboardEvent('keydown',{key:'7',repeat:true,bubbles:true}));
      ${picker}.dispatchEvent(new KeyboardEvent('keydown',{key:'6',isComposing:true,bubbles:true}));`);
    await key("q", "KeyQ");
    await assertEvent(85);
    await key("6", "Digit6");
    await assertEvent(65);
    await closeButton();
    await key("8", "Digit8");
    await assertEvent(65);
    await open();
    await assertColumn();
    await key("2", "Digit2");
    await assertEvent(25);
    await closeButton();
    await open();
    await key("0", "Digit0");
    await key("1", "Digit1");
    await assertEvent(1);
    await verifySelectionBurst("click", 61);
    await verifySelectionBurst("numbers", 56);
    await verifySelectionBurst("arrows", 16);
    await verifySelectionBurst("click", 36, "123", 220);
    await verifySelectionBurst("numbers", 12, "12", 220);
    await verifySelectionBurst("arrows", 42, "123", 220);
    await key("0", "Digit0");
    await key("1", "Digit1");
    await assertEvent(1);
    await closeButton();
    await assertFocus();
    await open();
    await gesture("header", 0, 32, "mouse");
    await assertOpen("A short mouse drag snaps back without dismissing");
    assert(
      await evaluate(`getComputedStyle(${sheet}).translate==='0px' || getComputedStyle(${sheet}).translate==='0px 0px'`),
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
    await key("ArrowRight");
    await assertColumn(1);
    const movement = await gesture("header", 0, 110, "touch");
    await closed();
    assert(
      movement.slice(-3).every((distance, i) => Math.abs(distance - 110 * [0.5, 0.75, 1][i]) < 1),
      "Touch drag follows the finger and dismisses on release",
    );
    await assertFocus();
    await open();
    await key("ArrowLeft");
    await assertColumn(10);
    const diePoint = await evaluate<{ x: number; y: number }>(`(()=>{
      const r=${picker}.querySelector('[aria-pressed="true"]').getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2};
    })()`);
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...diePoint, id: 1 }] });
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await frames();
    await assertColumn();
    await evaluate(
      `${picker}.querySelector('[data-place="10"] [data-digit="1"]').click();${picker}.querySelector('[data-place="1"] [data-digit="7"]').click()`,
    );
    await settled();
    const selection = await evaluate<string>("document.querySelector('.selection').getAttribute('aria-label')");
    await gesture('[data-place="10"] [data-digit="2"]', 0, 110, "touch");
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
