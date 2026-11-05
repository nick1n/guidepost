import { createServer } from "vite";
import { runBrowser } from "../support/harness.mts";

const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
try {
  await server.listen();
  const origin = server.resolvedUrls?.local[0];
  if (!origin) throw new Error("Error layout server did not start");
  await runBrowser(
    { name: "error-layout", base: origin, diagnostics: "document.body.innerText" },
    async ({ send, evaluate, waitFor, viewport, assert, saveScreenshot }) => {
      for (const width of [320, 390, 1280]) {
        await viewport(width, 900, width === 390);
        await send("Page.navigate", { url: `${origin}missing-page/` });
        await waitFor("document.querySelector('main h1')?.textContent === 'Page not found'");
        const sizes = await evaluate<{ height: number; scroll: number; main: number; clearance: number }>(`(() => ({
        height: innerHeight,
        scroll: document.scrollingElement.scrollHeight,
        main: document.querySelector('main').getBoundingClientRect().height,
        clearance: document.querySelector('.clearance')?.getBoundingClientRect().height ?? 0
      }))()`);
        await saveScreenshot(`error-${width}.png`);
        assert(sizes.scroll <= sizes.height, `Error page fits viewport at ${width}: ${JSON.stringify(sizes)}`);
      }
      await viewport(320, 240, true);
      await send("Page.navigate", { url: `${origin}missing-page/` });
      await waitFor("document.querySelector('main h1')?.textContent === 'Page not found'");
      assert(await evaluate("document.scrollingElement.scrollHeight > innerHeight"), "Short screens retain content scrolling");
      await evaluate("document.querySelector('main .home').scrollIntoView()");
      assert(
        await evaluate("document.querySelector('main .home').getBoundingClientRect().bottom <= innerHeight"),
        "The directory link stays reachable on short screens",
      );
      await send("Page.navigate", { url: `${origin}kdm/collecion/` });
      await waitFor("document.querySelector('main .suggestion a') !== null");
      assert(
        await evaluate(`(() => {
          const link = document.querySelector('main .suggestion a');
          return link.textContent === '/kdm/collection' && ['/kdm/collection', '/kdm/collection/'].includes(new URL(link.href).pathname);
        })()`),
        "Suggestions use the real SvelteKit route manifest and display the destination path",
      );
      for (const [path, destination, hash] of [
        ["kdm/collections/?from=link#/content?q=dragon", "/kdm/collection", "#/content?q=dragon"],
        ["kdm/hunts/?from=link#/1/fen/front", "/kdm/hunt", "#/1/fen/front"],
      ]) {
        await send("Page.navigate", { url: `${origin}${path}` });
        await waitFor(`document.querySelector('main .suggestion a')?.hash === ${JSON.stringify(hash)}`);
        assert(
          await evaluate(`(() => {
            const link = document.querySelector('main .suggestion a');
            return link.pathname === ${JSON.stringify(destination)} && link.search === '?from=link' && link.hash === ${JSON.stringify(hash)};
          })()`),
          `Suggested ${destination} link preserves the query string and hash`,
        );
      }
      for (const width of [390, 1280]) {
        await viewport(width, 900, width === 390);
        for (const path of ["", "kdm/hunt/", "kdm/collection/"]) {
          await send("Page.navigate", { url: `${origin}${path}` });
          await waitFor("document.querySelector('main') !== null && !document.querySelector('main .message')");
          assert(
            await evaluate("document.scrollingElement.scrollWidth <= innerWidth"),
            `Shared layout avoids horizontal overflow for /${path} at ${width}`,
          );
          if (path === "kdm/hunt/") {
            assert(await evaluate("document.scrollingElement.scrollHeight <= innerHeight"), `Hunt still fits viewport at ${width}`);
          }
          await saveScreenshot(`layout-${path.replaceAll("/", "-") || "home"}-${width}.png`);
        }
      }
    },
  );
} finally {
  await server.close();
}
