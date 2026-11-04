import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runBrowser } from "./support/harness.mts";
import { openBrowser } from "./support/connection.mts";

const fixture = `data:text/html,${encodeURIComponent("<title>Harness fixture</title><input><button aria-label='Confirm' onclick='window.confirmed=true'>Confirm</button>")}`;

test("disconnect rejects pending and subsequent commands without waiting for command timeouts", { timeout: 8000 }, async () => {
  const browser = await openBrowser({ name: "harness-disconnect" });
  try {
    const waiting = browser.send("Runtime.evaluate", { expression: "new Promise(() => {})", awaitPromise: true });
    const rejected = assert.rejects(waiting, /disconnected/);
    await browser.send("Browser.close").catch(() => {});
    await rejected;
    assert.equal(browser.connected, false);
    await assert.rejects(browser.send("Page.enable"), /disconnected/);
  } finally {
    await browser.close();
  }
});

for (const [scenario, expression] of [
  ["console", "console.error('harness regression')"],
  ["exception", "setTimeout(() => { throw new Error('harness regression'); }, 0)"],
] as const) {
  test(`the harness rejects ${scenario} errors and saves failure artifacts`, async () => {
    const output = `temp/browser-verification/harness/${scenario}`;
    await assert.rejects(
      runBrowser({ name: `harness-${scenario}`, diagnostics: "document.title", output }, async ({ send, evaluate, frames }) => {
        await send("Page.navigate", { url: fixture });
        await evaluate(expression);
        await frames();
      }),
      /No browser runtime errors.*harness regression/,
    );
    const report = JSON.parse(await readFile(`${output}/report.json`, "utf8"));
    assert.equal(report.status, "failed");
    assert.equal(report.page, "Harness fixture");
    assert.ok(report.errors.length > 0);
    assert.equal((await readFile(`${output}/failure.png`)).subarray(1, 4).toString(), "PNG");
  });
}

test("failed diagnostics preserve the original assertion and completed checks", async () => {
  const output = "temp/browser-verification/harness/assertion";
  await assert.rejects(
    runBrowser({ name: "harness-assertion", diagnostics: "missingDiagnostic()", output }, async ({ send, assert, details }) => {
      await send("Page.navigate", { url: fixture });
      details.scenario = "assertion";
      assert(true, "Completed check");
      assert(false, "Original failure");
    }),
    /Original failure/,
  );
  const report = JSON.parse(await readFile(`${output}/report.json`, "utf8"));
  assert.equal(report.status, "failed");
  assert.deepEqual(report.report, ["Completed check"]);
  assert.equal(report.details.scenario, "assertion");
  assert.match(report.failure, /Original failure/);
  assert.match(report.page, /missingDiagnostic/);
});

test("timeout diagnostics run once and cannot replace the timed-out condition", async () => {
  const output = "temp/browser-verification/harness/timeout";
  await assert.rejects(
    runBrowser(
      {
        name: "harness-timeout",
        diagnostics:
          "window.diagnosticCalls = (window.diagnosticCalls ?? 0) + 1; throw new Error('Diagnostic failure #' + window.diagnosticCalls)",
        output,
      },
      async ({ send, waitFor }) => {
        await send("Page.navigate", { url: fixture });
        await waitFor("false", 100);
      },
    ),
    /Timed out: false/,
  );
  const report = JSON.parse(await readFile(`${output}/report.json`, "utf8"));
  assert.equal(report.status, "failed");
  assert.match(report.failure, /Timed out: false/);
  assert.match(report.page, /Diagnostic failure #1/);
});

test("waiting includes predicate execution time in its deadline", async () => {
  await runBrowser(
    { name: "harness-deadline", diagnostics: "document.title", output: "temp/browser-verification/harness/deadline" },
    async ({ waitFor }) => {
      let polls = 0;
      await assert.rejects(
        waitFor(async () => {
          polls++;
          await new Promise((done) => setTimeout(done, 100));
          return false;
        }, 25),
        /Timed out:/,
      );
      assert.equal(polls, 1, "An expired deadline does not start another predicate evaluation");
    },
  );
});

test("a successful rerun removes the previous failure screenshot", async () => {
  const options = { name: "harness-rerun", diagnostics: "document.title", output: "temp/browser-verification/harness/rerun" };
  await assert.rejects(
    runBrowser(options, async ({ send, assert }) => {
      await send("Page.navigate", { url: fixture });
      assert(false, "Previous run failed");
    }),
    /Previous run failed/,
  );
  assert.equal((await readFile(`${options.output}/failure.png`)).subarray(1, 4).toString(), "PNG");
  await runBrowser(options, async () => {
    await assert.rejects(readFile(`${options.output}/failure.png`), { code: "ENOENT" });
  });
  const report = JSON.parse(await readFile(`${options.output}/report.json`, "utf8"));
  assert.equal(report.status, "passed");
  await assert.rejects(readFile(`${options.output}/failure.png`), { code: "ENOENT" });
});

test("explicit configuration and browser helpers produce a successful report", async () => {
  const output = "temp/browser-verification/harness/success";
  const argv = [...process.argv];
  await runBrowser(
    { name: "harness-success", base: "http://localhost:1234/", diagnostics: "document.title", output },
    async ({ base, send, evaluate, activate, viewport, key, settle, assert }) => {
      assert(base.href === "http://localhost:1234/", "Explicit server URL is preserved");
      await viewport(800, 600, false);
      await send("Page.navigate", { url: fixture });
      await activate("Confirm");
      assert(await evaluate("window.confirmed && innerWidth === 800"), "DOM activation and viewport helpers work");
      await evaluate("document.querySelector('input').focus();window.onkeydown=event=>window.pressed=event.key");
      await key("Enter");
      assert(await evaluate("window.pressed === 'Enter'"), "Keyboard helper dispatches keys");
      await evaluate(`
        window.finite = document.body.animate({opacity:[0.5,1]}, {duration:120});
        document.querySelector('button').animate({opacity:[0.5,1]}, {duration:100,iterations:Infinity});
      `);
      await settle("body");
      assert(await evaluate("window.finite.playState === 'finished'"), "Settling waits for finite motion and ignores repeating decoration");
    },
  );
  const report = JSON.parse(await readFile(`${output}/report.json`, "utf8"));
  assert.equal(report.status, "passed");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(process.argv, argv);
});
