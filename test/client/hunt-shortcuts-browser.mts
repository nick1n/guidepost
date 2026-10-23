import { runBrowser } from "./browser-harness.mts";

await runBrowser(
  "hunt-shortcuts",
  "JSON.stringify({text:document.body.innerText,active:document.activeElement?.outerHTML,random:Math.random(),dialogs:[...document.querySelectorAll('dialog')].map(d=>({open:d.open,display:getComputedStyle(d).display}))})",
  async ({ base, send, evaluate, waitFor, assert, errors }) => {
    const picker = "document.querySelector('dialog:has(.dice)')";
    const menu = "document.querySelector('dialog[data-swipe-ignore]')";
    const key = async (key: string, code: string, windowsVirtualKeyCode: number) => {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
    };
    const ready = () => waitFor("document.querySelector('.card') && !document.querySelector('.stage .load-status')");
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await send("Page.navigate", { url: new URL("/kdm/hunt/", base).href });
    await ready();
    for (const [name, code, value] of [
      ["/", "Slash", 191],
      ["ArrowUp", "ArrowUp", 38],
      ["ArrowDown", "ArrowDown", 40],
    ] as const) {
      await key(name, code, value);
      await waitFor(`${picker}.open`);
      assert(true, `${name} opens the event picker`);
      await key("ArrowDown", "ArrowDown", 40);
      await waitFor("document.querySelector('.selection').getAttribute('aria-label').endsWith('event 11')");
      await evaluate("Math.random=()=>0.42");
      await key("r", "KeyR", 82);
      assert(
        await evaluate("document.querySelector('.selection').getAttribute('aria-label').endsWith('event 11')"),
        "Random is inactive in the picker",
      );
      await key("ArrowUp", "ArrowUp", 38);
      await key("Escape", "Escape", 27);
      await waitFor(`getComputedStyle(${picker}).display==='none'`);
      assert(await evaluate(`!${menu}.open`), "Escape closes the picker without opening the menu");
      await ready();
    }
    await key("ArrowLeft", "ArrowLeft", 37);
    await waitFor("document.querySelector('.card').getAttribute('aria-label').endsWith('showing front')");
    await key("ArrowRight", "ArrowRight", 39);
    await waitFor("document.querySelector('.card').getAttribute('aria-label').endsWith('showing card back')");
    assert(true, "Left and Right flip the card in either direction");
    await evaluate(`(()=>{
    const input=document.createElement('input');document.body.append(input);input.focus();
    for(const key of ['r','/','ArrowDown','ArrowLeft'])input.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
    input.remove();
    for(const flags of [{repeat:true},{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true}])
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'r',...flags}));
  })()`);
    assert(
      await evaluate(
        `!${picker}.open && document.querySelector('.card').getAttribute('aria-label').includes('event 1, showing card back')`,
      ),
      "Typing, modifiers, composition, and held keys do not trigger hunt actions",
    );
    await key("Escape", "Escape", 27);
    await waitFor(`${menu}.open`);
    await key("r", "KeyR", 82);
    await key("/", "Slash", 191);
    await key("ArrowLeft", "ArrowLeft", 37);
    assert(
      await evaluate(
        `!${picker}.open && document.querySelector('.card').getAttribute('aria-label').includes('event 1, showing card back')`,
      ),
      "Open menu blocks hunt shortcuts",
    );
    await key("Escape", "Escape", 27);
    await waitFor(`!${menu}.open`);
    await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    await key("r", "KeyR", 82);
    await ready();
    await waitFor("document.querySelector('.card').getAttribute('aria-label').includes('event 43,')");
    assert(true, "R draws a random event");
    assert(errors.length === 0, `No browser runtime errors: ${JSON.stringify(errors)}`);
  },
);
