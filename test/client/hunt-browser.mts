import { mkdir, writeFile } from "node:fs/promises";
import { runBrowser } from "./browser-harness.mts";

await mkdir("temp/browser-verification", { recursive: true });
await runBrowser(
  "hunt",
  "JSON.stringify({text:document.body.innerText,active:document.activeElement?.tagName})",
  async ({ base, send, evaluate, waitFor, click, errors, assert, report, saveScreenshot }) => {
    const card = "document.querySelector('button.card')";
    const picker = "[...document.querySelectorAll('dialog')].find(d=>d.querySelector('.dice'))";
    const savedPreferences = `(async()=>{
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('guidepost-preferences');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
      try{return await new Promise((resolve,reject)=>{const r=db.transaction('preferences').objectStore('preferences').get('hunt');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
      finally{db.close()}
    })()`;
    const ready = () =>
      waitFor(
        `${card} && !${card}.closest('[inert]') && !${card}.disabled && ${card}.getAttribute('aria-disabled')!=='true' && ![...${card}.getAnimations(),...${card}.parentElement.getAnimations()].some(a=>a.playState==='running')`,
      );
    const select = async (value: number) => {
      await waitFor(`getComputedStyle(${picker}).display==='none'`);
      await evaluate("document.querySelector('.selection').focus();document.querySelector('.selection').click()");
      await waitFor(`${picker}?.open`);
      await evaluate(`Promise.all(${picker}.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})))`);
      await click(`tens ${Math.floor(value / 10) % 10}`);
      await click(`ones ${value % 10}`);
      await physicalClick("dialog:has(.dice) .close");
      await waitFor(`getComputedStyle(${picker}).display==='none'`);
      await ready();
      assert(await evaluate(`${card}.getAttribute('aria-label').includes('event ${value},')`), `Selected event ${value}`);
    };
    const settings = async () => {
      await waitFor(`getComputedStyle(${picker}).display==='none'`);
      await click("Open menu");
      await evaluate(
        "[...document.querySelectorAll('dialog[data-swipe-ignore] button')].find(b=>b.textContent.trim().startsWith('Settings')).click()",
      );
      await waitFor("document.querySelector('select[id$=\"-option\"]') !== null");
      await evaluate("Promise.all(document.querySelector('dialog[data-swipe-ignore] .sheet').getAnimations().map(a=>a.finished))");
    };
    const closeMenu = async () => {
      await evaluate("document.querySelector('[data-menu-trigger]').click()");
      await click("Close menu");
      await waitFor("!document.querySelector('dialog[data-swipe-ignore]').open");
    };
    const setOption = async (value: string) => {
      await settings();
      await evaluate(
        `(()=>{const e=document.querySelector('select[id$="-option"]');e.value='${value}';e.dispatchEvent(new Event('change',{bubbles:true}))})()`,
      );
      await closeMenu();
      await ready();
    };
    const physicalClick = async (selector: string) => {
      // Modal buttons move with their sheet, so wait for descendant transitions before sampling coordinates.
      await evaluate(
        `Promise.all((document.querySelector(${JSON.stringify(selector)})?.closest('dialog')?.getAnimations({subtree:true})??[]).map(animation=>animation.finished.catch(()=>{})))`,
      );
      await waitFor(
        `(()=>{const e=document.querySelector(${JSON.stringify(selector)});const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`,
      );
      const point = await evaluate<{ x: number; y: number }>(
        `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
      );
      await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
    };
    const clickCardSides = async (input: "touch" | "mouse") => {
      for (const side of ["left", "left", "right", "right"]) {
        await ready();
        const before = await evaluate<{ transform: string; front: boolean; x: number; y: number }>(
          `(()=>{const e=${card},r=e.getBoundingClientRect();return {transform:getComputedStyle(e).transform,front:e.getAttribute('aria-label').endsWith('showing front'),x:r.left+r.width*${side === "left" ? 0.25 : 0.75},y:r.top+r.height/2}})()`,
        );
        const point = { x: before.x, y: before.y };
        if (input === "touch") {
          await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
          await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } else {
          await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
          await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
        }
        const direction = await evaluate<number>(
          `(async()=>{
            const e=${card},animation=e.getAnimations().find(a=>a.transitionProperty==='transform');
            if(!animation)throw new Error('Expected an animated click flip');
            animation.pause();
            animation.currentTime=Number(animation.effect.getTiming().duration)*0.05;
            await new Promise(requestAnimationFrame);
            const initial=new DOMMatrix(${JSON.stringify(before.transform)});
            const current=new DOMMatrix(getComputedStyle(e).transform);
            const direction=Math.sign(initial.inverse().multiply(current).m31);
            animation.play();
            return direction;
          })()`,
        );
        assert(direction === (side === "left" ? -1 : 1), `${input}: clicking the ${side} half rotates ${side} on either face`);
        await ready();
        assert(
          await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')!==${before.front}`),
          `${input}: a side click flips exactly once`,
        );
      }
    };
    const swipeCard = async (dx: number, dy = 0, input: "touch" | "mouse" = "touch", cancel = false) => {
      await waitFor(
        "(()=>{const e=document.querySelector('.card');const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()",
      );
      const start = await evaluate<{ x: number; y: number }>(
        "(()=>{const r=document.querySelector('.card').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()",
      );
      const initialTransform = await evaluate<string>("getComputedStyle(document.querySelector('.card')).transform");
      if (input === "touch") await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 1 }] });
      else await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...start });
      for (const fraction of [0.2, 0.4, 0.6, 0.8, 1]) {
        const point = { x: start.x + dx * fraction, y: start.y + dy * fraction };
        if (input === "touch") await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, id: 1 }] });
        else await send("Input.dispatchMouseEvent", { type: "mouseMoved", button: "left", buttons: 1, ...point });
        await evaluate("new Promise(requestAnimationFrame)");
      }
      if (input === "touch") await send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
      else
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, x: start.x + dx, y: start.y + dy });
      await evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
      if (!cancel && Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const direction = await evaluate<number | null>(
          `(async()=>{
            if(matchMedia('(prefers-reduced-motion: reduce)').matches)return null;
            const card=document.querySelector('.card');
            const animation=card.getAnimations().find(a=>a.transitionProperty==='transform');
            if(!animation)throw new Error('Expected an animated swipe flip');
            animation.pause();
            animation.currentTime=Number(animation.effect.getTiming().duration)*0.05;
            await new Promise(requestAnimationFrame);
            const initial=new DOMMatrix(${JSON.stringify(initialTransform)});
            const current=new DOMMatrix(getComputedStyle(card).transform);
            const direction=Math.sign(initial.inverse().multiply(current).m31);
            animation.play();
            return direction;
          })()`,
        );
        if (direction !== null) assert(direction === Math.sign(dx), `${input}: card rotates in the swipe direction (${dx})`);
      }
      await ready();
    };
    const startPausedFlip = async () => {
      await ready();
      await evaluate(`${card}.click()`);
      await waitFor(`${card}.getAnimations().some(a=>a.transitionProperty==='transform')`);
      await evaluate(
        `window.flipAnimation=${card}.getAnimations().find(a=>a.transitionProperty==='transform');window.flipAnimation.pause()`,
      );
    };
    const verifyFlipCompletion = async () => {
      await startPausedFlip();
      await evaluate(`(async()=>{
        await new Promise(resolve=>setTimeout(resolve,600));
        ${card}.querySelector('.front').dispatchEvent(new TransitionEvent('transitionend',{propertyName:'transform',bubbles:true}));
        ${card}.dispatchEvent(new TransitionEvent('transitionend',{propertyName:'opacity'}));
      })()`);
      assert(
        await evaluate(`${card}.getAttribute('aria-disabled')==='true'&&document.querySelector('.random').disabled`),
        "A paused flip stays locked beyond 500ms and ignores unrelated transition events",
      );
      await evaluate("window.flipAnimation.finish()");
      await ready();
      assert(await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')`), "Finishing the rotation unlocks the card");

      await startPausedFlip();
      await evaluate(`${card}.style.transition='none'`);
      await ready();
      await evaluate(`${card}.style.removeProperty('transition')`);
      assert(await evaluate(`!document.querySelector('.random').disabled`), "Canceling the rotation unlocks drawing");

      await startPausedFlip();
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      await ready();
      await evaluate(`${card}.click()`);
      await ready();
      assert(
        await evaluate(`${card}.getAttribute('aria-label').endsWith('showing card back')&&!document.querySelector('.random').disabled`),
        "Enabling reduced motion during a flip unlocks the card and subsequent flips finish immediately",
      );
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    };
    const verifyRemovedFlip = async () => {
      await settings();
      await startPausedFlip();
      await evaluate(`(()=>{
        const select=document.querySelector('select[id$="-option"]');
        select.value='fen';select.dispatchEvent(new Event('change',{bubbles:true}));
      })()`);
      await closeMenu();
      await ready();
      assert(
        await evaluate(`!document.querySelector('.random').disabled`),
        "Removing a flipping card during a deck change unlocks drawing",
      );
      await setOption("kekasi");
      await physicalClick(".card");
      await ready();
    };
    const verifyLayout = async (label: string) => {
      const layout = await evaluate<{ centered: boolean; aligned: boolean; separate: boolean; fills: boolean }>(
        `(()=>{
          const rect=s=>document.querySelector(s).getBoundingClientRect();
          const main=rect('main'),stage=rect('.stage'),card=rect('.card'),random=rect('.random'),selection=rect('.selection'),menu=rect('[data-menu-trigger]');
          const center=r=>r.y+r.height/2;
          const ratio=Number(getComputedStyle(document.querySelector('.stage')).getPropertyValue('--aspect'));
          return {
            centered:Math.abs(random.x+random.width/2-main.x-main.width/2)<1,
            aligned:Math.abs(center(random)-center(selection))<1&&Math.abs(center(random)-center(menu))<1,
            separate:selection.right<=random.left&&random.right<=menu.left,
            fills:Math.abs(card.height-Math.min(stage.height,stage.width/ratio))<1
          };
        })()`,
      );
      assert(layout.centered && layout.aligned && layout.separate, `${label}: controls stay centered, aligned, and separate`);
      assert(layout.fills, `${label}: card fills the available space while preserving its aspect ratio`);
    };
    const verifyFlipOverflow = async (label: string) => {
      for (let direction = 0; direction < 2; direction++) {
        await physicalClick(".card");
        const samples = await evaluate<
          { progress: number; width: number; height: number; viewportWidth: number; viewportHeight: number }[]
        >(
          `(async()=>{
            const card=document.querySelector('.card');
            const animation=card.getAnimations().find(a=>a.transitionProperty==='transform');
            if(!animation)throw new Error('Expected an animated card flip');
            animation.pause();
            const duration=Number(animation.effect.getTiming().duration);
            const samples=[];
            for(const progress of [0,0.05,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1]){
              animation.currentTime=duration*progress;
              await new Promise(requestAnimationFrame);
              samples.push({progress,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewportWidth:innerWidth,viewportHeight:innerHeight});
            }
            animation.finish();
            return samples;
          })()`,
        );
        assert(
          samples.every((sample) => sample.width <= sample.viewportWidth && sample.height <= sample.viewportHeight + 1),
          `${label}: flip ${direction + 1} creates no viewport overflow at any sampled animation position`,
        );
        await ready();
      }
    };
    const verifyDrawSlide = async () => {
      const initialSrc = await evaluate<string>("document.querySelector('.card .front').src");
      await evaluate("window.originalRandom=Math.random;Math.random=()=>0;document.querySelector('.random').click()");
      for (const phase of ["out", "in"] as const) {
        await waitFor(
          `(()=>{const s=document.querySelector('.slide${phase === "in" ? ":not([inert])" : ""}');return s?.getAnimations().some(a=>Number(a.effect.getTiming().duration)>0&&a.effect.getKeyframes().some(k=>k.translate))})()`,
        );
        const result = await evaluate<{
          duration: number;
          src: string;
          awaitingExit: boolean;
          samples: { x: number; angle: number; opacity: number; overflow: boolean }[];
        }>(
          `(async()=>{
            const s=document.querySelector('.slide${phase === "in" ? ":not([inert])" : ""}'),c=s.querySelector('.card');
            const animation=s.getAnimations().find(a=>Number(a.effect.getTiming().duration)>0&&a.effect.getKeyframes().some(k=>k.translate));
            animation.pause();
            const duration=Number(animation.effect.getTiming().duration);
            let awaitingExit=true;
            if(${phase === "out"}){
              await new Promise(resolve=>setTimeout(resolve,600));
              awaitingExit=document.querySelector('.random').disabled;
            }
            const samples=[];
            for(const progress of [0,0.25,0.5,0.75,1]){
              animation.currentTime=duration*progress;
              await new Promise(requestAnimationFrame);
              const style=getComputedStyle(s);
              const x=style.translate==='none'?0:parseFloat(style.translate)/(style.translate.includes('%')?100:parseFloat(style.width));
              samples.push({x,angle:parseFloat(style.rotate)||0,
                opacity:Number(style.opacity),
                overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1});
            }
            const result={duration,src:c.querySelector('.front').src,awaitingExit,samples};
            animation.finish();
            return result;
          })()`,
        );
        if (phase === "out") assert(result.awaitingExit, "Drawing waits for the outgoing animation even when it takes longer than 500ms");
        assert(
          result.duration === 500 &&
            Math.abs(result.samples[0].x - (phase === "in" ? -1.5 : 0)) < 0.005 &&
            Math.abs(result.samples.at(-1)!.x - (phase === "in" ? 0 : 1.5)) < 0.005 &&
            result.samples.every((sample) => Math.abs(sample.angle - sample.x * 10) < 0.05),
          `Slide ${phase} preserves its 500ms duration, 150% travel, and matching 15-degree tilt`,
        );
        assert(
          Math.abs(result.samples[0].opacity - (phase === "in" ? 0 : 1)) < 0.005 &&
            Math.abs(result.samples.at(-1)!.opacity - (phase === "in" ? 1 : 0)) < 0.005 &&
            result.samples.every((sample) => sample.opacity >= 0 && sample.opacity <= 1),
          `Slide ${phase} fades between transparent and opaque`,
        );
        if (phase === "in")
          assert(
            result.samples.some((sample) => sample.x > 0),
            "Svelte backOut gives the incoming card a settling overshoot",
          );
        else
          assert(
            result.samples.every((sample, index, samples) => index === 0 || sample.x >= samples[index - 1].x),
            "The outgoing card moves smoothly to the right",
          );
        assert(
          result.samples.every((sample) => !sample.overflow),
          `Slide ${phase} creates no viewport overflow`,
        );
        assert(result.src === initialSrc, `Slide ${phase} preserves the cached card artwork`);
      }
      await ready();
      await evaluate("Math.random=window.originalRandom");
    };
    const verifyReverseDraw = async () => {
      const reverse = await evaluate<string>("document.querySelector('.card .back').src");
      await saveScreenshot("temp/browser-verification/hunt-reverse-before-draw.png");
      await evaluate("window.originalRandom=Math.random;Math.random=()=>0.11;document.querySelector('.random').click()");
      await waitFor("document.querySelector('.slide')?.getAnimations().some(a=>a.playState==='running')");
      assert(
        await evaluate(`document.querySelector('.card .back').src===${JSON.stringify(reverse)}`),
        "Drawing preserves the visible reverse while the old card slides out",
      );
      await ready();
      await evaluate("Math.random=window.originalRandom");
      assert(await evaluate(`${card}.getAttribute('aria-label').includes('card back')`), "Drawing the same event restores its deck back");
    };
    const verifyOverlappingDraw = async () => {
      await settings();
      await evaluate(`(()=>{
        window.olderSlide=document.querySelector('.slide');
        const e=document.querySelector('select[id$="-option"]');
        e.value='fen';e.dispatchEvent(new Event('change',{bubbles:true}));
      })()`);
      await waitFor(
        "window.olderSlide.getAnimations().some(a=>Number(a.effect.getTiming().duration)>0&&a.effect.getKeyframes().some(k=>k.translate))",
      );
      await evaluate(
        "window.olderExit=window.olderSlide.getAnimations().find(a=>Number(a.effect.getTiming().duration)>0&&a.effect.getKeyframes().some(k=>k.translate));window.olderExit.pause()",
      );
      await closeMenu();
      await evaluate("window.originalRandom=Math.random;Math.random=()=>0;document.querySelector('.random').click()");
      await evaluate("new Promise(resolve=>setTimeout(resolve,600))");
      assert(
        await evaluate(
          "window.olderSlide.isConnected && document.querySelectorAll('.card').length===1 && !document.querySelector('.card .front').src.endsWith('fen-0.png')",
        ),
        "Drawing during an artwork change waits for the retiring card's actual exit",
      );
      await evaluate("window.olderExit.finish()");
      await ready();
      assert(
        await evaluate("document.querySelector('.card .front').src.endsWith('fen-0.png')"),
        "The latest draw replaces the retiring artwork after its exit",
      );
      await evaluate("Math.random=window.originalRandom");
      await setOption("kekasi");
    };
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
      window.huntLocalStorageCalls=[];
      localStorage.setItem('setting-option','fen');
      for(const method of ['getItem','setItem','removeItem']){
        const original=Storage.prototype[method];
        Storage.prototype[method]=function(key,...args){
          if(String(key).startsWith('setting-'))window.huntLocalStorageCalls.push(method+':'+key);
          return original.call(this,key,...args);
        };
      }
    `,
    });
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Emulation.setScriptExecutionDisabled", { value: true });
    await send("Page.navigate", { url: new URL("/kdm/hunt/", base).href });
    await waitFor("document.querySelector('.selection .die') && document.querySelector('.load-status')");
    assert(
      await evaluate("document.querySelector('link[rel=prefetch][as=image]')?.getAttribute('href').endsWith('ccg-back.png')"),
      "Initial HTML prefetches the default card back before preferences load",
    );
    assert(
      await evaluate(`(()=>{
        const dice=[...document.querySelectorAll('.selection .die')];
        return dice.length===2&&dice.every((die,index)=>{
          const angle=Number.parseFloat(getComputedStyle(die).rotate);
          const face=Number.parseFloat(getComputedStyle(die.firstElementChild).rotate);
          return angle===(index===0?-45:45)&&angle+face===0;
        })&&dice[1].textContent.trim()==='1';
      })()`),
      "Initial loading keeps diamond-shaped dice with upright faces and the current event",
    );
    await saveScreenshot("temp/browser-verification/hunt-initial-loading.png");
    await send("Emulation.setScriptExecutionDisabled", { value: false });
    await send("Page.navigate", { url: new URL("/kdm/hunt/", base).href });
    await ready();
    assert(
      await evaluate(
        `(()=>{const r=document.querySelector('.ripple'),style=getComputedStyle(r),frames=r.getAnimations()[0].effect.getKeyframes();
          return style.animationDelay==='5s'&&style.animationDuration==='2s'&&style.animationTimingFunction==='ease-out'
            &&Number(frames[0].opacity)===0.8&&frames.at(-1).transform.includes('scale(1)')
            &&parseFloat(style.width)===25*parseFloat(getComputedStyle(document.documentElement).fontSize)})()`,
      ),
      "Ripple preserves its original timing and final size without scaling above its rendered resolution",
    );
    assert(
      await evaluate("document.querySelectorAll('[data-menu-trigger]').length===1"),
      "One menu button, with no extra clearance scrolling",
    );
    assert(await evaluate("document.documentElement.scrollHeight<=innerHeight+2"), "Hunt fits the desktop viewport");
    assert(
      await evaluate("!document.querySelector('main header,main .home,main .utility')"),
      "Page back and fullscreen controls are removed",
    );
    await verifyLayout("Desktop");
    await verifyFlipOverflow("Desktop");
    assert(await evaluate("document.querySelector('.front').src.endsWith('ccg-1.png')"), "Default deck is CCG and initial event is 1");
    assert(
      await evaluate("window.huntLocalStorageCalls.length===0"),
      "Fresh hunt settings ignore legacy localStorage without migrating it",
    );
    await saveScreenshot("temp/browser-verification/hunt-desktop-back.png");
    await setOption("kekasi");
    await physicalClick(".card");
    await ready();
    assert(await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')`), "Card flips to its front");
    assert(await evaluate("document.activeElement.matches('.card')"), "Flipping keeps keyboard focus on the card");
    await saveScreenshot("temp/browser-verification/hunt-desktop-front.png");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await ready();
    assert(await evaluate(`!${card}.getAttribute('aria-label').endsWith('showing front')`), "Space flips the focused card back");
    await clickCardSides("mouse");
    await swipeCard(-100, 0, "mouse");
    assert(
      await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')`),
      "Mouse swipe left flips once without a duplicate click",
    );
    await swipeCard(-100, 0, "mouse");
    assert(
      await evaluate(`!${card}.getAttribute('aria-label').endsWith('showing front')`),
      "A second mouse swipe left keeps turning left to the back",
    );
    await swipeCard(100, 0, "mouse");
    assert(
      await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')`),
      "Mouse swipe right reverses direction to the front",
    );
    await swipeCard(100, 0, "mouse");
    assert(await evaluate(`!${card}.getAttribute('aria-label').endsWith('showing front')`), "Mouse swipe right flips back once");
    await verifyFlipCompletion();
    await verifyRemovedFlip();
    await select(11);
    assert(await evaluate(`${card}.getAttribute('aria-label').includes('card back')`), "Selection conceals the prior front");
    await physicalClick(".card");
    await ready();
    await physicalClick(".card");
    await ready();
    assert(await evaluate(`${card}.getAttribute('aria-label').includes('reverse')`), "Kekasi event 11 flips to its event-specific reverse");
    await verifyReverseDraw();
    await select(73);
    await physicalClick(".card");
    await ready();
    await physicalClick(".card");
    await ready();
    assert(await evaluate(`${card}.getAttribute('aria-label').includes('reverse')`), "Kekasi event 73 has its reverse");
    await select(0);
    assert(await evaluate("[...document.querySelectorAll('.selection .kd-icon')].length===2"), "Event 0 displays two lanterns");
    await verifyDrawSlide();
    await verifyOverlappingDraw();
    assert(await evaluate(`${card}.getAttribute('aria-label').includes('event 0,')`), "Drawing an already-cached event 0 finishes loading");
    await settings();
    await saveScreenshot("temp/browser-verification/hunt-desktop-settings.png");
    for (const suffix of ["devil-satan", "bravado-beta", "gregalope-ce"])
      await evaluate(`document.querySelector('input[id$="-${suffix}"]').click()`);
    await closeMenu();
    await select(78);
    assert(await evaluate("document.querySelector('.front').src.endsWith('kekasi-78-beta.jpg')"), "Bravado beta variant is selected");
    await select(85);
    assert(await evaluate("document.querySelector('.front').src.endsWith('kekasi-85-devil.jpg')"), "Devil Satan variant is selected");
    await select(38);
    assert(
      await evaluate("document.querySelector('.front').src.endsWith('kekasi-38.jpg')"),
      "Gregalope CE does not request a missing Kekasi variant",
    );
    await setOption("ccg");
    assert(await evaluate("document.querySelector('.front').src.endsWith('ccg-38-ce.png')"), "CCG uses the Gregalope CE variant");
    await select(73);
    await physicalClick(".card");
    await ready();
    await physicalClick(".card");
    await ready();
    assert(await evaluate(`${card}.getAttribute('aria-label').includes('reverse')`), "CCG event 73 has its reverse");
    await setOption("fen");
    assert(
      await evaluate(`${card}.getAttribute('aria-label').includes('card back')`),
      "Switching to a single-sided deck resets the event reverse",
    );
    await physicalClick(".card");
    await ready();
    await physicalClick(".card");
    await ready();
    assert(await evaluate(`${card}.getAttribute('aria-label').includes('card back')`), "Fen flips back to the general deck back");
    await setOption("ccg");
    assert(
      await evaluate(`${card}.getAttribute('aria-label').includes('card back')`),
      "Returning to a previous double-sided deck starts with its general back",
    );
    await setOption("fen");
    await waitFor(`(async()=>{const p=await ${savedPreferences};return p?.option==='fen'&&p.bravadoBeta&&p.devilSatan&&p.gregalopeCE})()`);
    await send("Page.reload");
    await waitFor("document.querySelector('.front')?.src.endsWith('fen-1.png')");
    await ready();
    assert(
      await evaluate(
        `(async()=>{const p=await ${savedPreferences};return document.querySelector('.front').src.endsWith('fen-1.png')&&p?.option==='fen'&&p.bravadoBeta&&p.devilSatan&&p.gregalopeCE})()`,
      ),
      "Image choice and all expansion settings survive reload in IndexedDB",
    );
    assert(
      await evaluate("!document.querySelector('link[rel=prefetch][as=image]')"),
      "Saved alternate artwork removes the default card-back prefetch hint",
    );
    await settings();
    assert(
      await evaluate(
        'document.querySelector(\'select[id$="-option"]\').value===\'fen\'&&[...document.querySelectorAll(\'input[id$="-devil-satan"],input[id$="-bravado-beta"],input[id$="-gregalope-ce"]\')].every(e=>e.checked)',
      ),
      "Saved hunt settings hydrate the controls after reload",
    );
    await closeMenu();
    assert(await evaluate("window.huntLocalStorageCalls.length===0"), "Hunt settings never read or write localStorage after reload");
    await physicalClick(".card");
    await ready();
    await send("Network.enable");
    await send("Network.setBlockedURLs", { urls: ["*kekasi-1.jpg", "*kekasi-79.jpg"] });
    await settings();
    await evaluate(
      `(()=>{const e=document.querySelector('select[id$="-option"]');e.value='kekasi';e.dispatchEvent(new Event('change',{bubbles:true}))})()`,
    );
    await closeMenu();
    await waitFor("document.body.innerText.includes('Could not load this hunt card')");
    await evaluate("document.querySelector('.selection').focus();document.querySelector('.selection').click()");
    await click("tens 7");
    await click("ones 9");
    await physicalClick("dialog:has(.dice) .close");
    // The previous event's error remains visible until selection debouncing requests the new image.
    await waitFor("document.querySelector('main>div[hidden] img[src$=\"kekasi-79.jpg\"]') && document.querySelector('.retry')");
    assert(true, "Missing artwork exposes a recoverable error");
    assert(
      await evaluate("document.querySelector('.random').textContent.trim()==='Random'&&!document.querySelector('.random').disabled"),
      "Missing artwork leaves Random correctly labeled and available",
    );
    await send("Network.setBlockedURLs", { urls: [] });
    await evaluate("document.querySelector('.retry').focus()");
    await waitFor("document.activeElement.matches('.retry')");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await ready();
    assert(
      await evaluate("!document.body.innerText.includes('Could not load this hunt card')"),
      "Retry reloads failed artwork successfully",
    );
    assert(await evaluate("document.activeElement.matches('.card')"), "A keyboard retry restores focus to the loaded card");
    assert(
      await evaluate(
        `${card}.getAttribute('aria-label').includes('card back') && new DOMMatrix(getComputedStyle(${card}).transform).m11>0.99`,
      ),
      "Selecting after an artwork load failure conceals the new event",
    );
    await send("Network.setBlockedURLs", { urls: ["*kekasi-80.jpg"] });
    await evaluate("document.querySelector('.selection').click()");
    await click("tens 8");
    await click("ones 0");
    await physicalClick("dialog:has(.dice) .close");
    await waitFor("document.body.innerText.includes('Could not load this hunt card')");
    await send("Network.setBlockedURLs", { urls: [] });
    await evaluate(
      "document.querySelector('.retry').focus();document.querySelector('.retry').click();document.querySelector('.selection').focus()",
    );
    await ready();
    assert(await evaluate("document.activeElement.matches('.selection')"), "Retry completion preserves focus moved to another control");
    await send("Network.setBlockedURLs", { urls: ["*kekasi-81.jpg"] });
    await evaluate("document.querySelector('.selection').click()");
    await click("ones 1");
    await physicalClick("dialog:has(.dice) .close");
    await waitFor("document.body.innerText.includes('Could not load this hunt card')");
    await evaluate("window.originalRandom=Math.random;Math.random=()=>0.99999;document.querySelector('.random').click()");
    await ready();
    await evaluate("Math.random=window.originalRandom");
    assert(
      await evaluate(`${card}.getAttribute('aria-label').includes('event 99,')`),
      "Drawing with no visible card completes without waiting for an outro",
    );
    await send("Network.setBlockedURLs", { urls: [] });
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await select(85);
    await physicalClick(".card");
    await ready();
    await clickCardSides("touch");
    await swipeCard(-100);
    assert(
      await evaluate(`!${card}.getAttribute('aria-label').endsWith('showing front')`),
      "Touch swipe left flips once without a duplicate tap",
    );
    await swipeCard(-100);
    assert(
      await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')`),
      "A second touch swipe left keeps turning left to the front",
    );
    await swipeCard(100);
    assert(
      await evaluate(`!${card}.getAttribute('aria-label').endsWith('showing front')`),
      "Touch swipe right reverses direction to the back",
    );
    await swipeCard(100);
    assert(await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')`), "Touch swipe right flips the card back");
    await swipeCard(20);
    assert(await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')`), "A short touch drag does not flip the card");
    await swipeCard(0, 100);
    assert(
      await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')`),
      "A vertical touch gesture does not flip the card",
    );
    await swipeCard(-100, 0, "touch", true);
    assert(await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')`), "A canceled touch swipe does not flip the card");
    await saveScreenshot("temp/browser-verification/hunt-mobile-front.png");
    assert(
      await evaluate("document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight+2"),
      "Hunt card and controls fit mobile without overflow",
    );
    await verifyLayout("Mobile");
    await verifyFlipOverflow("Mobile");
    await evaluate("document.querySelector('.selection').focus();document.querySelector('.selection').click()");
    await waitFor(`${picker}?.open`);
    await evaluate(`Promise.all(${picker}.getAnimations().map(a=>a.finished))`);
    assert(
      await evaluate(
        `(()=>{const d=${picker}.querySelector('.sheet'),header=d.querySelector('header');
          const heading=header.querySelector('h2').getBoundingClientRect(),close=d.querySelector('.close').getBoundingClientRect();
          const dice=d.querySelector('.dice'),style=getComputedStyle(dice),columns=[...dice.querySelectorAll('fieldset')];
          const diceWidth=columns.reduce((sum,c)=>sum+c.getBoundingClientRect().width,0)+parseFloat(getComputedStyle(dice).columnGap);
          const needed=Math.max(diceWidth,heading.width)+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight);
          const center=d.getBoundingClientRect().x+d.getBoundingClientRect().width/2;
          return Math.abs(d.clientWidth-needed)<2&&d.getBoundingClientRect().width<innerWidth&&close.top>=dice.getBoundingClientRect().bottom
            &&Math.abs(close.width-dice.getBoundingClientRect().width+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight))<1
            &&Math.abs(heading.x+heading.width/2-center)<1})()`,
      ),
      "Dice dialog fits its content with a centered title and full-width Close button below the dice",
    );
    await saveScreenshot("temp/browser-verification/hunt-mobile-picker.png");
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await waitFor(`!${picker}.open`);
    assert(await evaluate("document.activeElement.matches('.selection')"), "Escape closes selection and restores focus");
    await settings();
    await evaluate("document.querySelector('section:has(select[id$=\"-option\"])').scrollIntoView({block:'end'})");
    await saveScreenshot("temp/browser-verification/hunt-mobile-settings.png");
    await closeMenu();
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await ready();
    await select(11);
    await physicalClick(".card");
    await ready();
    assert(
      await evaluate("getComputedStyle(document.querySelector('.card')).transitionDuration==='0s'"),
      "Reduced motion disables card animation",
    );
    await swipeCard(-100);
    assert(
      await evaluate(`${card}.getAttribute('aria-label').includes('reverse')`),
      "Swiping reaches the event-specific reverse with reduced motion",
    );
    await swipeCard(100);
    assert(
      await evaluate(`${card}.getAttribute('aria-label').endsWith('showing front')`),
      "Swiping back from the reverse restores the front",
    );
    await evaluate("window.originalRandom=Math.random;Math.random=()=>0.11;document.querySelector('.random').click()");
    await ready();
    await evaluate("Math.random=window.originalRandom");
    assert(
      await evaluate(`${card}.getAttribute('aria-label').includes('event 11, showing card back')`),
      "Reduced-motion drawing completes without a timer or visible animation",
    );
    await send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
    await saveScreenshot("temp/browser-verification/hunt-landscape.png");
    assert(
      await evaluate(
        "(()=>{const r=document.querySelector('.card').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()",
      ),
      "Card fits a short landscape viewport",
    );
    await verifyLayout("Landscape");
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await verifyFlipOverflow("Landscape");
    await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 667, deviceScaleFactor: 1, mobile: true });
    await verifyLayout("Small phone");
    await evaluate("document.querySelector('.random').click()");
    await verifyLayout("Small phone while drawing");
    await ready();
    await saveScreenshot("temp/browser-verification/hunt-small-phone.png");
    await send("Page.navigate", { url: new URL("/credits/", base).href });
    await waitFor("document.querySelector('#hunt-event-cards') !== null");
    assert(
      await evaluate("document.querySelectorAll('section[aria-labelledby=\"hunt-event-cards\"] a').length===4"),
      "Credits contain all four hunt contributors",
    );
    await saveScreenshot("temp/browser-verification/hunt-credits.png");
    assert(errors.length === 0, `No browser runtime errors: ${JSON.stringify(errors)}`);
    await writeFile("temp/browser-verification/hunt-report.json", JSON.stringify({ report, errors }, null, 2));
  },
);
