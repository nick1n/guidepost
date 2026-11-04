import { strict as assert } from "node:assert";
import childProcess from "node:child_process";
import { writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import type { Socket } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import { runBrowser } from "../../browser/support/harness.mts";
import { findBrowser, openBrowser } from "../../browser/support/connection.mts";

for (const phase of ["target request", "WebSocket handshake"]) {
  test(`browser startup bounds a stalled ${phase} and stops its process`, { timeout: 5000 }, async (context) => {
    let reached = false;
    const sockets = new Set<Socket>();
    const server = createServer((_request, response) => {
      if (phase === "target request") reached = true;
      else response.end(JSON.stringify({ webSocketDebuggerUrl: `ws://127.0.0.1:${port}/debugger` }));
    });
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    server.on("upgrade", () => {
      reached = true;
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    const previous = process.env.CHROME_PATH;
    process.env.CHROME_PATH = process.execPath;
    const spawn = childProcess.spawn;
    let child: ReturnType<typeof spawn> | undefined;
    const mock = context.mock.method(childProcess, "spawn", (_executable: string, args: readonly string[]) => {
      const profile = args?.find((arg) => arg.startsWith("--user-data-dir="))?.slice("--user-data-dir=".length);
      assert.ok(profile);
      writeFileSync(join(profile, "DevToolsActivePort"), String(port), "utf8");
      child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
      });
      return child;
    });
    syncBuiltinESMExports();
    try {
      await assert.rejects(openBrowser({ name: "stalled-startup", startupTimeout: 500 }), /timed out/);
      assert.ok(reached, `The ${phase} was reached before its deadline`);
      assert.ok(child && (child.exitCode !== null || child.signalCode !== null), "Startup failure stops the process");
    } finally {
      if (previous === undefined) delete process.env.CHROME_PATH;
      else process.env.CHROME_PATH = previous;
      mock.mock.restore();
      syncBuiltinESMExports();
      child?.kill();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((done) => server.close(() => done()));
    }
  });
}

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
      runBrowser({ name: "failed-launch", diagnostics: "document.title" }, async () => assert.fail("An exited browser cannot run tests")),
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
  const cleanup = context.mock.method(fs, "rm", async (path: Parameters<typeof fs.rm>[0], options: Parameters<typeof fs.rm>[1]) => {
    if (!options?.recursive) return remove(path, options);
    profile = path;
    throw Object.assign(new Error("Profile is still busy"), { code: "ENOTEMPTY" });
  });
  syncBuiltinESMExports();
  const log = context.mock.method(console, "error", () => {});
  try {
    await assert.rejects(
      runBrowser({ name: "cleanup-failure", diagnostics: "document.title" }, async () => assert.fail("Browser cannot start")),
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
