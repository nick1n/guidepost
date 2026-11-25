import { runBrowser } from "../support/harness.mts";

await runBrowser(
  { name: "collection-viewport", diagnostics: "({ height: innerHeight, scrollHeight: document.documentElement.scrollHeight })" },
  async ({ base, send, viewport, waitFor, evaluate, assert, saveScreenshot }) => {
    for (const [width, height] of [
      [519, 1100],
      [1280, 800],
    ]) {
      await viewport(width, height, false);
      await send("Page.navigate", { url: new URL("/kdm/collection/#/content?q=simu", base).href });
      await waitFor("document.querySelector('article input[type=checkbox]:not(:disabled)')");
      await evaluate("document.fonts.ready");
      assert(
        await evaluate("document.documentElement.scrollHeight <= innerHeight"),
        "Short filtered collection has no vertical overflow at " + width + "px",
      );
      await saveScreenshot("filtered-" + width + ".png");
      await evaluate("location.hash = ''");
      await waitFor("document.querySelectorAll('article').length > 10");
      assert(await evaluate("document.documentElement.scrollHeight > innerHeight"), "Full catalog still scrolls at " + width + "px");
    }
  },
);
