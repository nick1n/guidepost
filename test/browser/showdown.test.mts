import { runBrowser } from "./support/harness.mts";

await runBrowser(
  { name: "showdown", diagnostics: "document.querySelector('footer')?.innerText" },
  async ({ base, send, viewport, evaluate, frames, waitFor, assert }) => {
    const tap = async (selector: string) => {
      const point = await evaluate<{ x: number; y: number }>(`(() => {
        const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`);
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await frames();
    };
    await viewport(390, 844);
    await send("Page.navigate", { url: new URL("/kdm/showdown4/", base).href });
    await waitFor("document.querySelector('.advance') && document.documentElement.hasAttribute('data-glass')");
    const survivor = ".roster-button:nth-child(2)";
    await tap(survivor);
    await tap(survivor);
    assert(await evaluate("!document.querySelector('.turn-action').disabled"), "Reselecting a survivor preserves Dodge");
    await tap(".roster-button:first-child");
    await tap(".advance");
    await waitFor(`document.querySelector('${survivor}').hasAttribute('aria-current')`);
    assert(
      await evaluate("document.elementFromPoint(innerWidth/2, 40)?.closest('.panel') === document.querySelectorAll('.panel')[1]"),
      "Starting the survivor phase brings the ready survivor into view",
    );

    await tap(".advance");
    await viewport(1440, 844);
    await frames();
    await evaluate("document.querySelector('.workspace').scrollBy({ left: innerWidth, behavior: 'instant' })");
    await waitFor(`document.querySelector('${survivor}').hasAttribute('aria-current')`);
    await tap(".sections-button");
    assert(
      await evaluate("document.querySelectorAll('.panel')[1].querySelector('.section .toggle').getAttribute('aria-expanded') === 'true'"),
      "After scrolling White Lion offscreen, expand acts on the visible survivor",
    );
  },
);
