import { mkdir, writeFile } from "node:fs/promises";
import { runBrowser } from "./browser-harness.mts";

await mkdir("temp/browser-verification", { recursive: true });
await runBrowser(
  "hunt-artwork",
  "document.body.innerText",
  async ({ base, send, evaluate, waitFor, assert, report, errors, saveScreenshot }) => {
    const card = "[...document.querySelectorAll('.card')].find(card=>!card.closest('[inert]'))";
    const option = "document.querySelector('select[id$=\"-option\"]')";
    const ready = () =>
      waitFor(
        `${card} && !document.querySelector('.random').disabled && ![...${card}.getAnimations(),...${card}.parentElement.getAnimations()].some(animation=>animation.playState==='running')`,
      );
    const settings = async () => {
      await evaluate("document.querySelector('[data-menu-trigger]').click()");
      await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
      await evaluate(
        "[...document.querySelectorAll('dialog[data-swipe-ignore] button')].find(button=>button.textContent.trim().startsWith('Settings')).click()",
      );
      await waitFor(option);
    };
    const brightness = async () => {
      const point = await evaluate<{ x: number; y: number }>(
        `(()=>{const bounds=${card}.getBoundingClientRect();return {x:bounds.x+bounds.width/2-20,y:bounds.y+bounds.height/2-20}})()`,
      );
      const shot = await send("Page.captureScreenshot", { format: "png", clip: { ...point, width: 40, height: 40, scale: 1 } });
      // Read rendered pixels: rotation state alone cannot detect flattened 3D faces.
      return evaluate<number>(`(async()=>{
        const image=new Image();image.src=${JSON.stringify(`data:image/png;base64,${shot.data}`)};await image.decode();
        const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;
        const context=canvas.getContext('2d');context.drawImage(image,0,0);
        const pixels=context.getImageData(0,0,40,40).data;
        let sum=0;for(let index=0;index<pixels.length;index+=4)sum+=(pixels[index]+pixels[index+1]+pixels[index+2])/3;
        return sum/1600;
      })()`);
    };

    for (const width of [390, 1280]) {
      for (const motion of ["no-preference", "reduce"]) {
        await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
        await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: motion }] });
        const url = new URL(`/kdm/hunt/?artwork-test=${width}-${motion}`, base);
        await send("Page.navigate", { url: url.href });
        await waitFor(`location.search===${JSON.stringify(url.search)} && ${card} && document.documentElement.hasAttribute('data-glass')`);
        await evaluate("document.fonts.ready");
        await ready();
        await settings();
        await evaluate(`(()=>{const select=${option};select.value='kekasi';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
        await evaluate("history.back()");
        await waitFor("!document.querySelector('dialog[data-swipe-ignore]').open");
        await ready();
        await evaluate(`${card}.click()`);
        await ready();
        const frontBrightness = await brightness();
        assert(frontBrightness > 100, `${width}px, ${motion}: reference card shows its light event front`);
        await saveScreenshot(`temp/browser-verification/hunt-artwork-${width}-${motion}-before.png`);
        await settings();

        const samples = await evaluate<{ front: boolean; loaded: boolean; overlap: boolean }[]>(`new Promise(resolve=>{
          const samples=[],start=performance.now();
          function sample(time){
            const card=${card};
            if(card?.querySelector('.front').src.includes('fen-1.png')){
              const style=getComputedStyle(card);
              if(Number(style.opacity)*Number(getComputedStyle(card.parentElement).opacity)>0.05){
                samples.push({front:new DOMMatrix(style.transform).m11 < -0.99,loaded:[...card.querySelectorAll('img')].every(image=>image.complete&&image.naturalWidth>0),overlap:document.querySelectorAll('.card').length>1});
              }
            }
            if(time-start>1500)resolve(samples);else requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
          const select=${option};select.value='fen';select.dispatchEvent(new Event('change',{bubbles:true}));
        })`);
        assert(
          samples.length > 0 && samples.every((sample) => sample.front && sample.loaded && !sample.overlap),
          `${width}px, ${motion}: new artwork enters on the front after loading and the previous card's exit`,
        );

        await evaluate(
          `(()=>{window.retiringArtwork=${card};const select=${option};select.value='kekasi';select.dispatchEvent(new Event('change',{bubbles:true}))})()`,
        );
        if (motion === "no-preference") {
          await waitFor(
            "[window.retiringArtwork,window.retiringArtwork.parentElement].flatMap(element=>element.getAnimations()).some(animation=>Number(animation.effect.getTiming().duration)>0&&animation.effect.getKeyframes().some(frame=>frame.translate))",
          );
          await evaluate(
            "window.artworkExit=[window.retiringArtwork,window.retiringArtwork.parentElement].flatMap(element=>element.getAnimations()).find(animation=>Number(animation.effect.getTiming().duration)>0&&animation.effect.getKeyframes().some(frame=>frame.translate));window.artworkExit.pause()",
          );
          await evaluate("new Promise(resolve=>setTimeout(resolve,650))");
          assert(
            await evaluate("window.retiringArtwork.isConnected && document.querySelectorAll('.card').length===1"),
            `${width}px: artwork replacement waits for the actual outgoing animation, even when paused beyond 500ms`,
          );
          for (const value of ["ccg", "kekasi"]) {
            await evaluate(
              `(()=>{const select=${option};select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`,
            );
            await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
          }
          assert(
            await evaluate(
              "document.querySelectorAll('.card').length===1 && window.retiringArtwork.querySelector('.front').src.includes('fen-1.png')",
            ),
            `${width}px: rapid artwork changes preserve the outgoing image and wait for its exit`,
          );
          await evaluate("window.artworkExit.finish()");
        }
        await waitFor(`${card}?.querySelector('.front').src.includes('kekasi-1.jpg')`);
        if (motion === "no-preference") {
          await waitFor(
            `[${card},${card}.parentElement].flatMap(element=>element.getAnimations()).some(animation=>Number(animation.effect.getTiming().duration)>0&&animation.effect.getKeyframes().some(frame=>frame.translate))`,
          );
          await evaluate(
            `(()=>{const animation=[${card},${card}.parentElement].flatMap(element=>element.getAnimations()).find(animation=>Number(animation.effect.getTiming().duration)>0&&animation.effect.getKeyframes().some(frame=>frame.translate));animation.pause();animation.currentTime=Number(animation.effect.getTiming().duration)*0.25})()`,
          );
        }
        await evaluate("history.back()");
        await waitFor("!document.querySelector('dialog[data-swipe-ignore]').open");
        await evaluate("new Promise(resolve=>setTimeout(resolve,600))");
        await saveScreenshot(`temp/browser-verification/hunt-artwork-${width}-${motion}-cached.png`);
        assert(
          (await brightness()) > frontBrightness * 0.7,
          `${width}px, ${motion}: cached artwork displays its front during entry without a back-to-front snap`,
        );
      }
    }
    assert(errors.length === 0, "No browser errors during artwork changes");
    await writeFile("temp/browser-verification/hunt-artwork-report.json", JSON.stringify(report, null, 2));
  },
);
