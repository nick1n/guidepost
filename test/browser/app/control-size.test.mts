import { runBrowser } from "../support/harness.mts";

await runBrowser(
  { name: "control-size", diagnostics: "document.body.innerText" },
  async ({ base, send, evaluate, waitFor, activate, assert, saveScreenshot, viewport, settle, activateMenuButton }) => {
    const cancel = async () => {
      await evaluate("[...document.querySelectorAll('dialog:modal button')].find(b=>b.textContent.trim()==='Cancel').click()");
      await waitFor("!document.querySelector('dialog:modal')");
    };

    for (const width of [320, 1280]) {
      await viewport(width, 800, false);
      for (const [label, size] of [
        ["Comfortable", 56],
        ["Compact", 32],
        ["Default", 44],
      ] as const) {
        await send("Page.navigate", { url: "about:blank" });
        await waitFor("location.href==='about:blank'");
        await send("Page.navigate", { url: base.href });
        await waitFor("document.querySelector('.landing.is-ready')");
        await activate("Open menu");
        await activateMenuButton("Settings");
        await waitFor("document.querySelector('.reset-settings button')");
        await evaluate(
          `[...document.querySelectorAll('dialog[data-swipe-ignore] button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`,
        );
        await evaluate("document.querySelector('.reset-settings button').click()");
        await waitFor("document.querySelector('dialog:modal')");
        await settle("dialog:modal");
        assert(
          await evaluate(`getComputedStyle(document.querySelector('dialog:modal .action')).minBlockSize==='${size}px'`),
          `${width}px ${label}: Settings confirmation uses ${size}px controls`,
        );
        await cancel();
        await evaluate("if(document.querySelector('dialog[data-swipe-ignore]').open)document.querySelector('[data-menu-trigger]').click()");
        await waitFor("!document.querySelector('dialog[data-swipe-ignore]').open");
        await evaluate("document.querySelector('a[href*=\"/kdm/start\"]').click()");
        await waitFor("document.querySelector('dialog:modal')");
        await settle("dialog:modal");
        assert(
          await evaluate(
            `['button[aria-pressed]','.actions button'].every(s=>{const buttons=[...document.querySelectorAll('dialog:modal '+s)];return buttons.length>0&&buttons.every(b=>getComputedStyle(b).minBlockSize==='${size}px'&&getComputedStyle(b).minInlineSize==='${size}px')})`,
          ),
          `${width}px ${label}: home actions and version buttons follow the setting`,
        );
        await saveScreenshot(`controls-${width}-${label.toLowerCase()}.png`);
        await cancel();
        await evaluate("document.querySelector('a[href*=\"/kdm/hunt\"]').click()");
        await waitFor(
          "document.querySelector('button.card') && !document.querySelector('.random').disabled && document.querySelector('.selection').getAttribute('aria-disabled')!=='true'",
        );
        assert(
          await evaluate(`['.random','.selection'].every(s=>getComputedStyle(document.querySelector(s)).minBlockSize==='${size}px')`),
          `${width}px ${label}: hunt controls follow the setting after navigation`,
        );
        await evaluate("document.querySelector('.selection').click()");
        await waitFor("document.querySelector('dialog:modal')");
        await settle("dialog:modal");
        await saveScreenshot(`controls-hunt-${width}-${label.toLowerCase()}.png`);
        assert(
          await evaluate(
            `(()=>{const d=document.querySelector('dialog:modal'),r=d.getBoundingClientRect(),body=d.querySelector('.body');return getComputedStyle(d.querySelector('.die')).width==='${size}px'&&r.x>=0&&r.right<=innerWidth&&body.scrollWidth<=body.clientWidth})()`,
          ),
          `${width}px ${label}: hunt picker fits without horizontal scrolling`,
        );
      }
    }
  },
);
