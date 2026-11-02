import { strict as assert } from "node:assert";
import { test } from "node:test";
import { findBrowser, runBrowser } from "../../client/browser-harness.mts";

test("Ubuntu runners prefer packaged Chrome over the Chromium development snapshot", () => {
  const installed = new Set(["/usr/bin/chromium", "/usr/bin/google-chrome"]);
  assert.equal(
    findBrowser((path) => installed.has(String(path)), ""),
    "/usr/bin/google-chrome",
  );
});

test("explicit browser selection and Chromium-only installations still work", () => {
  const installed = new Set(["/custom/chrome", "/usr/bin/chromium", "/usr/bin/google-chrome"]);
  assert.equal(
    findBrowser((path) => installed.has(String(path)), "/custom/chrome"),
    "/custom/chrome",
  );
  assert.equal(
    findBrowser((path) => path === "/usr/bin/chromium", ""),
    "/usr/bin/chromium",
  );
  assert.throws(() => findBrowser(() => false, ""), /Install Chrome/);
});

test("browser startup reports the executable and stderr when the process exits", async () => {
  const previous = process.env.CHROME_PATH;
  process.env.CHROME_PATH = process.execPath;
  try {
    // Node rejects the Chrome flags and exits, providing a real process failure without requiring a browser.
    await assert.rejects(
      runBrowser("failed-launch", "document.title", async () => assert.fail("An exited browser cannot run tests")),
      (error: Error) => error.message.includes(process.execPath) && /bad option|unknown option/.test(error.message),
    );
  } finally {
    if (previous === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = previous;
  }
});
