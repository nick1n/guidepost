import { runBrowser } from "../support/harness.mts";

await runBrowser(
  { name: "notifications", diagnostics: "document.body.innerText.slice(0, 2000)" },
  async ({ base, send, evaluate, waitFor, assert, saveScreenshot, viewport, frames, activate, activateMenuButton, settle }) => {
    await viewport(1280, 900);
    await send("Page.navigate", { url: new URL("/kdm/collection/#/content?q=kingdom%20death%20monster", base).href });
    const input = "document.querySelector('article input[type=checkbox]:not(:disabled)')";
    const persistent = "document.querySelector('[data-menu-trigger] .persistent')";
    const activity = "document.querySelector('[data-menu-trigger] .transient')";
    const badge = "document.querySelector('dialog[data-swipe-ignore] .count')";
    // Animated colors can serialize as OKLab while static colors serialize as OKLCH.
    const color = (expression: string) =>
      evaluate<string>(`(() => {
        const context = document.createElement('canvas').getContext('2d');
        context.fillStyle = ${expression};
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data).join(',');
      })()`);
    const open = async () => {
      await activate("Open menu");
      await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
      await settle("dialog[data-swipe-ignore] .sheet", false);
    };
    const close = async () => {
      await activate("Close menu");
      await waitFor("!document.querySelector('dialog[data-swipe-ignore]').open");
    };
    await waitFor(`${input} !== null`);
    await open();
    await evaluate("document.documentElement.requestFullscreen = () => Promise.reject(new Error('Simulated fullscreen failure'))");
    await activateMenuButton("Fullscreen");
    await waitFor(`${persistent} !== null`);
    await evaluate(`Promise.all(${persistent}.getAnimations().map(animation => animation.finished))`);
    await close();
    await saveScreenshot("initial-error.png");
    const errorColor = await color(`getComputedStyle(${persistent}).backgroundColor`);
    await evaluate(`window.previousDot = ${persistent}`);

    await evaluate(`${input}.click()`);
    await waitFor(`${badge}.textContent.trim() === '2'`);
    assert(await evaluate(`${persistent} !== window.previousDot`), "A new successful save retriggers the unread error dot");
    assert(
      await evaluate(
        `!${activity} && ${persistent}.getAnimations().some(animation => animation.playState === 'running' && animation.effect.getTiming().iterations === 1)`,
      ),
      "The new notification pops once while an error remains unread",
    );
    await evaluate(`${persistent}.getAnimations().forEach(animation => {
      animation.pause();
      animation.currentTime = animation.effect.getTiming().duration * 0.4;
    })`);
    await frames();
    const successPopColor = await color(`getComputedStyle(${persistent}).backgroundColor`);
    assert(
      successPopColor !== errorColor &&
        (await evaluate(
          `${persistent}.dataset.kind === 'success' && getComputedStyle(${persistent}).opacity === '1' && getComputedStyle(${persistent}).getPropertyValue('--dot-color').trim() === getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim()`,
        )),
      "A successful notification pops green even while an error remains unread",
    );
    await saveScreenshot("success-over-error.png");
    await evaluate(`${persistent}.getAnimations().forEach(animation => animation.finish())`);
    await frames();
    assert(
      (await evaluate(`getComputedStyle(${persistent}).opacity === '1'`)) &&
        (await color(`getComputedStyle(${persistent}).backgroundColor`)) === errorColor,
      "The dot returns to static red after the success pop when errors remain unread",
    );
    await open();
    assert(await evaluate(`${badge}.closest('.row').dataset.kind === 'error'`), "Unread errors retain priority in the drawer");
    await saveScreenshot("error-after-success.png");
    await activateMenuButton("Notification log");
    assert(
      await evaluate(
        "document.querySelector('.notice[data-kind=\"error\"] .notice-icon').classList.contains('i-material-symbols:warning-outline')",
      ),
      "Errors use the triangle exclamation icon",
    );
    assert(
      (await color("getComputedStyle(document.querySelector('.notice[data-kind=\"error\"] .notice-icon')).color")) === errorColor,
      "Error log icons exactly match the error dot color",
    );
    assert(
      (await color("getComputedStyle(document.querySelector('.notice[data-kind=\"success\"] .notice-icon')).color")) === successPopColor,
      "The temporary success pop exactly matches the green log icon",
    );
    await saveScreenshot("log.png");
    await activate("Back to menu");
    assert(await evaluate(`!${persistent} && !${activity}`), "Reading the log clears the indicator without replaying older activity");
    assert(
      await evaluate(`${badge}.closest('.row').dataset.kind === undefined && !document.querySelector('.log-dot')`),
      "Reading the log restores the neutral badge and clears the bell dot",
    );
    await saveScreenshot("read-drawer.png");

    await close();
    await evaluate(`${input}.click()`);
    await waitFor(`${activity} !== null`);
    const successColor = await color(`getComputedStyle(${activity}).backgroundColor`);
    assert(
      await evaluate(
        `!${persistent} && ${activity}.dataset.kind === 'success' && getComputedStyle(${activity}).getPropertyValue('--dot-color').trim() === getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim()`,
      ),
      "Successful activity is green once errors have been acknowledged",
    );
    await evaluate(`Promise.all(${activity}.getAnimations().map(animation => animation.finished))`);
    assert(await evaluate(`getComputedStyle(${activity}).opacity === '0'`), "The non-error dot fades away");
    await viewport(390, 844);
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await open();
    assert(
      await evaluate(
        `${badge}.closest('.row').dataset.kind === 'success' && getComputedStyle(document.querySelector('.log-dot')).backgroundColor === getComputedStyle(${badge}).backgroundColor`,
      ),
      "Success badges and bell dots share the green accent",
    );
    await saveScreenshot("success-drawer.png");
    await activateMenuButton("Notification log");
    assert(
      (await color("getComputedStyle(document.querySelector('.notice[data-kind=\"success\"] .notice-icon')).color")) === successColor,
      "Success log icons exactly match the success dot color",
    );
    await saveScreenshot("success-log.png");
    await activate("Back to menu");
    await activateMenuButton("Fullscreen");
    await waitFor(`${persistent} !== null`);
    assert(
      await evaluate(`getComputedStyle(${persistent}).animationName === 'none' && !${activity}`),
      "Reduced motion leaves a static red dot",
    );
    await saveScreenshot("reduced-motion.png");
  },
);
