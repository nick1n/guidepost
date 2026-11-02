import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
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

test("a busy profile during cleanup does not hide the browser startup error", async (context) => {
  const previous = process.env.CHROME_PATH;
  process.env.CHROME_PATH = process.execPath;
  const remove = fs.rm;
  let profile: Parameters<typeof fs.rm>[0] | undefined;
  const cleanup = context.mock.method(fs, "rm", async (path: Parameters<typeof fs.rm>[0]) => {
    profile = path;
    throw Object.assign(new Error("Profile is still busy"), { code: "ENOTEMPTY" });
  });
  syncBuiltinESMExports();
  const log = context.mock.method(console, "error", () => {});
  try {
    await assert.rejects(
      runBrowser("cleanup-failure", "document.title", async () => assert.fail("Browser cannot start")),
      (error: Error) => /bad option|unknown option/.test(error.message),
    );
    assert.equal(log.mock.callCount(), 1);
  } finally {
    cleanup.mock.restore();
    syncBuiltinESMExports();
    if (previous === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = previous;
    if (profile) await remove(profile, { recursive: true, force: true });
  }
});
