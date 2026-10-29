import { mkdir, writeFile } from "node:fs/promises";
import { runBrowser } from "./browser-harness.mts";

await mkdir("temp/browser-verification", { recursive: true });
await runBrowser(
  "hunt",
  "JSON.stringify({url:location.href,text:document.body.innerText,active:document.activeElement?.getAttribute('aria-label')})",
  async ({ base, send, evaluate, waitFor, click, assert, errors, report, saveScreenshot }) => {
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.huntIntervals = new Set();
        const startInterval = window.setInterval.bind(window);
        const stopInterval = window.clearInterval.bind(window);
        window.setInterval = (...args) => {
          const id = startInterval(...args);
          window.huntIntervals.add(id);
          return id;
        };
        window.clearInterval = (id) => {
          window.huntIntervals.delete(id);
          stopInterval(id);
        };
      `,
    });
    const card = "document.querySelector('button.card')";
    const live = "document.querySelector('main > p[aria-live]')";
    const picker = "document.querySelector('dialog:has(.dice)')";
    const menu = "document.querySelector('dialog[data-swipe-ignore]')";
    const option = "document.querySelector('select[id$=\"-option\"]')";
    const frames = () => evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    const ready = async () => {
      // Card intros start on the frame after insertion.
      await frames();
      await waitFor(
        `${card} && !${card}.closest('[inert]') && ${card}.getAttribute('aria-disabled')!=='true' && !document.querySelector('.stage .load-status') && !document.querySelector('.random').disabled && ![...${card}.getAnimations(),...${card}.parentElement.getAnimations()].some(a=>a.playState==='running')`,
      );
    };
    const navigate = async (hash = "") => {
      await send("Page.navigate", { url: "about:blank" });
      await waitFor("location.href==='about:blank'");
      await send("Page.navigate", { url: new URL(`/kdm/hunt/${hash}`, base).href });
      await ready();
    };
    const state = (event: number, face: string) => `${card}?.getAttribute('aria-label')==='Flip hunt event ${event}, showing ${face}'`;
    const announced = (event: number, face: string) => `${live}?.textContent.trim()==='Hunt event ${event}, ${face}.'`;
    const key = async (key: string, code = key, windowsVirtualKeyCode = key.charCodeAt(0)) => {
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code,
        windowsVirtualKeyCode,
        ...(key === "Enter" ? { text: "\r" } : {}),
      });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
      await frames();
    };
    const openPicker = async () => {
      await evaluate("document.querySelector('.selection').focus();document.querySelector('.selection').click()");
      await waitFor(`${picker}.open`);
      await evaluate(`Promise.all(${picker}.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))`);
    };
    const closedPicker = async () => {
      await waitFor(`!${picker}.open && getComputedStyle(${picker}).display==='none'`);
      assert(await evaluate("document.activeElement.matches('.selection')"), "Picker dismissal restores selection focus");
    };
    const settings = async () => {
      await click("Open menu");
      await evaluate(`[...${menu}.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Settings')).click()`);
      await waitFor(option);
    };
    const closeMenu = async () => {
      await evaluate("document.querySelector('[data-menu-trigger]').click()");
      await waitFor(`${menu}.querySelector('.navigation')`);
      await frames();
      await click("Close menu");
      await waitFor(`!${menu}.open && getComputedStyle(${menu}).display==='none'`);
    };
    const artwork = (value: string) =>
      evaluate(
        `(()=>{const select=${option};select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`,
      );
    const pauseExit = async () => {
      await waitFor("document.querySelector('.slide')?.getAnimations().some(a=>a.effect.getKeyframes().some(k=>k.translate))");
      await evaluate(
        "window.huntExit=document.querySelector('.slide').getAnimations().find(a=>a.effect.getKeyframes().some(k=>k.translate));window.huntExit.pause()",
      );
    };
    const swipe = async (selector: string, dx: number, dy: number, cancel = false) => {
      const point = await evaluate<{ x: number; y: number }>(
        `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
      );
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
      for (const fraction of [0.2, 0.4, 0.6, 0.8, 1]) {
        await send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: point.x + dx * fraction, y: point.y + dy * fraction, id: 1 }],
        });
        await frames();
      }
      await send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
      await frames();
    };

    await navigate("#/73/kekasi/reverse");
    assert(
      await evaluate(`(()=>{
      const paths=performance.getEntriesByType('resource').map(entry=>new URL(entry.name).pathname);
      return paths.some(path=>path.endsWith('/kekasi-73.jpg')) && !paths.some(path=>path.endsWith('/kekasi-1.jpg')||path.endsWith('/ccg-back.png'));
    })()`),
      "Initial deep link loads the requested event without fetching event 1 or the default CCG back",
    );

    // Exercise the main journey with real motion on desktop and reduced motion on mobile.
    for (const [width, motion] of [
      [1280, "no-preference"],
      [390, "reduce"],
    ] as const) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: width === 390 });
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: motion }] });
      await navigate("#/1/fen/front");
      assert(
        await evaluate(`${state(1, "front")} && document.querySelector('.front').src.endsWith('/fen/fen-1.png')`),
        "Link restores event, artwork, and face",
      );
      assert(await evaluate(announced(1, "front")), "Ready card announcement matches its event and face");
      const historyLength = await evaluate<number>("history.length");
      await evaluate(`${card}.focus();${card}.click()`);
      await waitFor("location.hash==='#/1/fen'");
      if (motion === "no-preference") {
        await waitFor(`${card}.getAnimations().some(a=>a.transitionProperty==='transform')`);
        await evaluate(`window.huntFlip=${card}.getAnimations().find(a=>a.transitionProperty==='transform');window.huntFlip.pause()`);
        await evaluate("new Promise(resolve=>setTimeout(resolve,600))");
        assert(
          await evaluate(`${card}.getAttribute('aria-disabled')==='true' && document.querySelector('.random').disabled`),
          "Paused flip stays locked while the URL already reflects its destination",
        );
        await evaluate("window.huntFlip.finish()");
      }
      await ready();
      assert(
        await evaluate(`history.length===${historyLength} && document.activeElement===${card} && ${state(1, "card back")}`),
        "Flip preserves focus and replaces history",
      );
      await evaluate("window.huntReload=true");
      await send("Page.reload");
      await waitFor("!window.huntReload && document.readyState==='complete'");
      await ready();
      assert(await evaluate(state(1, "card back")), "Reload restores the linked face");

      await openPicker();
      await click("tens 0");
      await click("ones 0");
      await evaluate(`${picker}.querySelector('.close').click()`);
      await closedPicker();
      await ready();
      assert(await evaluate(`${state(0, "card back")} && location.hash==='#/0/fen'`), "Picker selects 00 and conceals the event");

      const idleIntervals = await evaluate<number>("window.huntIntervals.size");
      await evaluate(
        "window.huntRandom=Math.random;Math.random=()=>0.42;document.querySelector('.random').click();Math.random=window.huntRandom",
      );
      await waitFor("location.hash==='#/42/fen'");
      if (motion === "no-preference") {
        await pauseExit();
        await evaluate("new Promise(resolve=>setTimeout(resolve,600))");
        assert(
          await evaluate("document.querySelector('.front').src.endsWith('fen-0.png') && document.querySelector('.random').disabled"),
          "Draw preserves the outgoing card until its actual animation finishes",
        );
        assert(
          await evaluate(`${state(0, "card back")} && ${live}.textContent.trim()===''`),
          "Pending draw keeps the outgoing card's label and waits to announce the incoming card",
        );
        await saveScreenshot(`temp/browser-verification/hunt-${width}-drawing.png`);
        assert(await evaluate(`window.huntIntervals.size===${idleIntervals + 1}`), "A paused draw keeps one dice timer active");
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        await frames();
        await evaluate("window.huntRandom=Math.random;window.huntRolls=0;Math.random=()=>{window.huntRolls++;return 0.9}");
        await evaluate("new Promise(resolve=>setTimeout(resolve,450))");
        assert(await evaluate("window.huntRolls===0"), "Enabling reduced motion stops dice updates during a paused draw");
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
        await waitFor("window.huntRolls>0");
        assert(await evaluate("window.huntRolls>0"), "Disabling reduced motion resumes dice updates during the same draw");
        await evaluate("Math.random=window.huntRandom");
        await evaluate("window.huntExit.finish()");
      }
      await ready();
      assert(await evaluate(state(42, "card back")), "Random draw completes on the concealed requested event");
      assert(await evaluate(announced(42, "card back")), "Completed draw announces the committed event and face");
      assert(await evaluate(`window.huntIntervals.size===${idleIntervals}`), "Completing a draw releases its dice timer");
      assert(
        await evaluate("document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight+2"),
        `${width}px: card and controls fit the viewport`,
      );
      await saveScreenshot(`temp/browser-verification/hunt-${width}.png`);
    }

    // Gesture edge cases also have unit coverage in test/client/gestures/.
    await navigate("#/1");
    await evaluate("document.querySelector('.selection').focus()");
    await key("/", "Slash", 191);
    await waitFor(`${picker}.open`);
    await key("ArrowDown", "ArrowDown", 40);
    await key("r", "KeyR", 82);
    assert(
      await evaluate("document.querySelector('.selection').getAttribute('aria-label').endsWith('event 11')"),
      "Picker arrow keys select digits and block random drawing",
    );
    await key("Escape", "Escape", 27);
    await closedPicker();
    await ready();
    await key("ArrowLeft", "ArrowLeft", 37);
    await ready();
    assert(await evaluate(state(11, "front")), "Arrow shortcut flips the card");
    await swipe(".card", -100, 0);
    await ready();
    assert(await evaluate(state(11, "card back")), "Touch swipe flips exactly once");
    await swipe(".card", 0, 100);
    await swipe(".card", -100, 0, true);
    assert(await evaluate(state(11, "card back")), "Vertical and canceled gestures leave the face unchanged");
    await evaluate(`(()=>{
      const input=document.createElement('input');document.body.append(input);input.focus();
      for(const key of ['r','/','ArrowLeft'])input.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
      input.remove();
      for(const flags of [{repeat:true},{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true}])
        window.dispatchEvent(new KeyboardEvent('keydown',{key:'r',...flags}));
    })()`);
    assert(
      await evaluate(`!${picker}.open && ${state(11, "card back")}`),
      "Typing, modifiers, composition, and held keys do not trigger shortcuts",
    );
    await click("Open menu");
    await key("r", "KeyR", 82);
    await key("/", "Slash", 191);
    await key("ArrowLeft", "ArrowLeft", 37);
    assert(await evaluate(`!${picker}.open && ${state(11, "card back")}`), "Open menu blocks hunt shortcuts");
    await click("Close menu");

    await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
    await openPicker();
    assert(
      await evaluate(
        `(()=>{const d=${picker},r=d.getBoundingClientRect(),c=d.querySelector('.close').getBoundingClientRect(),dice=d.querySelector('.dice');return r.top>=0&&r.bottom<=innerHeight&&c.bottom<=r.bottom&&dice.scrollHeight>dice.clientHeight})()`,
      ),
      "Short-screen picker scrolls its dice and keeps Close visible",
    );
    await swipe("dialog:has(.dice) header", 0, 110);
    await closedPicker();

    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 844, deviceScaleFactor: 1, mobile: false });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await navigate("#/42/fen/front");
    await evaluate(
      "window.huntRandom=Math.random;Math.random=()=>0.42;document.querySelector('.random').click();Math.random=window.huntRandom",
    );
    await ready();
    assert(await evaluate(state(42, "card back")), "Drawing the current event still completes and conceals it");
    await evaluate("document.querySelector('.random').click()");
    await pauseExit();
    await evaluate("location.hash='#/73/kekasi/reverse'");
    await waitFor("document.querySelector('.selection').getAttribute('aria-label').endsWith('73')");
    await evaluate("window.huntExit.finish()");
    await ready();
    assert(
      await evaluate(`${state(73, "reverse")} && document.querySelector('.front').src.endsWith('kekasi-73.jpg')`),
      "Navigation during a draw replaces its pending event, artwork, and face",
    );

    // Artwork replacement shares one sequencing check with rapid URL changes.
    await navigate("#/11/kekasi/reverse");
    assert(await evaluate("document.querySelector('.back').src.endsWith('kekasi-11-back.jpg')"), "Links restore event-specific reverses");
    await settings();
    await artwork("fen");
    await pauseExit();
    await artwork("ccg");
    await closeMenu();
    await evaluate("location.hash='#/85/ccg/front'");
    await waitFor("document.querySelector('.selection').getAttribute('aria-label').endsWith('85')");
    assert(
      await evaluate("document.querySelectorAll('.card').length===1 && document.querySelector('.front').src.endsWith('kekasi-11.jpg')"),
      "Rapid artwork and URL changes retain one intact outgoing card",
    );
    assert(await evaluate(`${live}.textContent.trim()===''`), "Pending artwork changes do not announce an unready card");
    await evaluate("window.huntExit.finish()");
    await ready();
    assert(
      await evaluate(
        `${state(85, "front")} && document.querySelector('.front').src.endsWith('ccg-85.png') && [...${card}.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)`,
      ),
      "Latest URL wins and the incoming artwork is loaded on the requested face",
    );
    assert(await evaluate(announced(85, "front")), "Rapid navigation announces the final committed card");

    await navigate("#/85/ccg/front");
    await settings();
    await artwork("kekasi");
    for (const suffix of ["devil-satan", "bravado-beta", "gregalope-ce"])
      await evaluate(`document.querySelector('input[id$="-${suffix}"]').click()`);
    await closeMenu();
    await ready();
    await waitFor(`(async()=>{
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('guidepost-preferences');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
      try{return await new Promise((resolve,reject)=>{const r=db.transaction('preferences').objectStore('preferences').get('hunt');r.onsuccess=()=>{const p=r.result;resolve(p?.option==='kekasi'&&p.bravadoBeta&&p.devilSatan&&p.gregalopeCE)};r.onerror=()=>reject(r.error)})}
      finally{db.close()}
    })()`);
    await navigate("#/1/fen/front");
    await navigate();
    assert(
      await evaluate("document.querySelector('.front').src.endsWith('kekasi-1.jpg')"),
      "Opening a link does not overwrite saved artwork",
    );
    await settings();
    assert(
      await evaluate(
        `${option}.value==='kekasi' && [...document.querySelectorAll('input[id$="-devil-satan"],input[id$="-bravado-beta"],input[id$="-gregalope-ce"]')].every(e=>e.checked)`,
      ),
      "Artwork and expansion settings survive reload and hydrate their controls",
    );
    await closeMenu();

    // Native history restores the entire card state, independently of menu history.
    await navigate("#/11/kekasi/front");
    await evaluate("location.hash='#/73/ccg/reverse'");
    await waitFor(state(73, "reverse"));
    await ready();
    await evaluate("history.back()");
    await waitFor(state(11, "front"));
    await ready();
    assert(await evaluate("document.querySelector('.front').src.includes('/kekasi/')"), "Back restores event, artwork, and face");
    await evaluate("history.forward()");
    await waitFor(state(73, "reverse"));
    await ready();
    assert(await evaluate("document.querySelector('.front').src.includes('/ccg/')"), "Forward restores event, artwork, and face");
    await evaluate(`${card}.click()`);
    await ready();
    await evaluate("location.hash='#/11/kekasi/front'");
    await waitFor(state(11, "front"));
    await ready();
    await settings();
    assert(
      await evaluate(`${state(11, "front")} && ${option}.value==='kekasi'`),
      "Opening the menu preserves native hash changes after shallow navigation",
    );
    await closeMenu();
    await navigate("#/1/fen/reverse");
    assert(await evaluate(state(1, "card back")), "Missing event reverse falls back to the deck back");

    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await send("Network.enable");
    await send("Network.setBlockedURLs", { urls: ["*fen-79.png"] });
    await evaluate("location.hash='#/79/fen/front'");
    await waitFor("document.querySelector('.retry')");
    assert(
      await evaluate("location.hash==='#/79/fen/front' && !document.querySelector('.random').disabled"),
      "Failed artwork retains the requested URL and leaves drawing available",
    );
    assert(await evaluate(`${live}.textContent.trim()===''`), "Failed artwork does not announce a card as ready");
    await send("Network.setBlockedURLs", { urls: [] });
    await evaluate("document.querySelector('.retry').focus()");
    await waitFor("document.activeElement.matches('.retry')");
    await key("Enter", "Enter", 13);
    await ready();
    assert(await evaluate(`${state(79, "front")} && document.activeElement===${card}`), "Keyboard retry loads the card and restores focus");
    assert(await evaluate(announced(79, "front")), "Successful retry announces the loaded card");

    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    const idleIntervals = await evaluate<number>("window.huntIntervals.size");
    await evaluate("document.querySelector('.random').click()");
    await pauseExit();
    await click("Open menu");
    await evaluate(`${menu}.querySelector('.navigation a').click()`);
    await waitFor("document.querySelector('main.landing')");
    assert(
      await evaluate("!document.querySelector('.slide,main:not(.landing)') && document.querySelectorAll('[data-menu-trigger]').length===1"),
      "Home removes hunt controls immediately, even during a paused exit",
    );
    assert(await evaluate(`window.huntIntervals.size===${idleIntervals}`), "Leaving during a draw releases its dice timer");
    assert(errors.length === 0, `No browser runtime errors: ${JSON.stringify(errors)}`);
    await writeFile("temp/browser-verification/hunt-report.json", JSON.stringify({ report, errors }, null, 2));
  },
);
