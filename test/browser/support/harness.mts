import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openBrowser, type Send } from "./connection.mts";

type Context = {
  base: URL;
  send: Send;
  evaluate: <T = unknown>(expression: string) => Promise<T>;
  waitFor: (condition: string | (() => Promise<unknown>), timeout?: number) => Promise<void>;
  frames: () => Promise<void>;
  viewport: (width: number, height?: number, mobile?: boolean) => Promise<void>;
  key: (key: string, code?: string, windowsVirtualKeyCode?: number) => Promise<void>;
  settle: (selector: string, subtree?: boolean) => Promise<void>;
  menuButton: (text: string) => string;
  activateMenuButton: (text: string) => Promise<void>;
  details: Record<string, unknown>;
  activate: (label: string) => Promise<void>;
  assert: (condition: unknown, message: string) => void;
  saveScreenshot: (path: string) => Promise<void>;
};

type Options = { name: string; diagnostics: string; base?: string; output?: string };

export async function runBrowser(
  {
    name,
    diagnostics,
    base: server = process.env.BROWSER_TEST_URL ?? "http://127.0.0.1:5173",
    output = `temp/browser-verification/${name}`,
  }: Options,
  run: (context: Context) => Promise<void>,
) {
  const base = new URL(server);
  if (!["http:", "https:"].includes(base.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
    throw new Error("Use a local HTTP test server.");
  }
  await mkdir(output, { recursive: true });
  await rm(resolve(output, "failure.png"), { force: true });
  let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
  let failed = false;
  let failure: unknown;
  let page: unknown;
  let inspect: Context["evaluate"] | undefined;
  let screenshot: Context["saveScreenshot"] | undefined;
  const errors: unknown[] = [];
  const report: string[] = [];
  const details: Record<string, unknown> = {};
  try {
    browser = await openBrowser({
      name,
      onEvent: ({ method, params }) => {
        if (method === "Runtime.exceptionThrown") errors.push(params?.exceptionDetails);
        if (method === "Runtime.consoleAPICalled" && params?.type === "error") errors.push(params);
      },
    });
    const { send } = browser;
    const evaluate = async <T = unknown,>(expression: string): Promise<T> => {
      const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result?.value as T;
    };
    inspect = evaluate;
    const waitFor: Context["waitFor"] = async (condition, timeout = 10000) => {
      const deadline = performance.now() + timeout;
      while (performance.now() < deadline) {
        if (typeof condition === "string" ? await evaluate(condition) : await condition()) return;
        const remaining = deadline - performance.now();
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(100, remaining)));
      }
      throw new Error(`Timed out: ${String(condition)}`);
    };
    const frames = () => evaluate<void>("new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))");
    const viewport: Context["viewport"] = async (width, height = 900, mobile = width < 600) => {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    };
    const key: Context["key"] = async (
      key,
      code = key,
      windowsVirtualKeyCode = key === "Escape" ? 27 : key === "Enter" ? 13 : key.charCodeAt(0),
    ) => {
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code,
        windowsVirtualKeyCode,
        ...(key === "Enter" ? { text: "\r" } : {}),
      });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
      await frames();
    };
    const settle: Context["settle"] = async (selector, subtree = true) => {
      // Intros can start on the frame after insertion; ignore intentionally repeating decoration.
      await frames();
      await waitFor(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        return element && !element.getAnimations({subtree:${subtree}}).some(animation =>
          animation.effect.getComputedTiming().endTime !== Infinity && animation.playState !== 'finished' && animation.playState !== 'idle');
      })()`);
    };
    const menuButton = (text: string) =>
      `[...document.querySelectorAll('dialog[data-swipe-ignore] button')].find(button => button.textContent.trim().startsWith(${JSON.stringify(text)}))`;
    const activateElement = async (expression: string) => {
      await waitFor(`${expression} && !${expression}.disabled`);
      await evaluate(`${expression}.click()`);
      await frames();
    };
    const activate = (label: string) =>
      activateElement(
        `[...document.querySelectorAll('[aria-label]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(label)})`,
      );
    const activateMenuButton = (text: string) => activateElement(menuButton(text));
    const assert: Context["assert"] = (condition, message) => {
      if (!condition) throw new Error(message);
      report.push(message);
      console.log("PASS:", message);
    };
    const saveScreenshot = async (path: string) => {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      if (!shot.data) throw new Error("Screenshot data missing");
      await writeFile(resolve(output, path), Buffer.from(shot.data, "base64"));
    };
    screenshot = saveScreenshot;
    await send("Runtime.enable");
    await send("Page.enable");
    // /json/new can leave this target in the background, where document.hasFocus() is false.
    await send("Page.bringToFront");
    // Runtime.exceptionThrown omits errors handled by the browser's window error dispatch, including ResizeObserver loop errors.
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source:
        "window.addEventListener('error', event => console.error('window.error', event.message, event.error)); window.addEventListener('unhandledrejection', event => console.error('unhandledrejection', event.reason));",
    });
    await run({
      base,
      send,
      evaluate,
      waitFor,
      frames,
      viewport,
      key,
      settle,
      menuButton,
      activateMenuButton,
      details,
      activate,
      assert,
      saveScreenshot,
    });
    assert(errors.length === 0, `No browser runtime errors: ${JSON.stringify(errors)}`);
  } catch (error) {
    failed = true;
    failure = error instanceof Error ? error.stack : error;
    if (browser?.connected && inspect) {
      try {
        page = await inspect(diagnostics);
      } catch (diagnosticError) {
        page = String(diagnosticError);
      }
    }
    if (browser?.connected && screenshot) {
      try {
        await screenshot("failure.png");
      } catch (screenshotError) {
        console.error("Failure screenshot unavailable:", screenshotError);
      }
    }
    throw error;
  } finally {
    try {
      await browser?.close();
    } catch (error) {
      if (failed) console.error("Browser cleanup also failed:", error);
      else {
        failed = true;
        failure = error instanceof Error ? error.stack : error;
        throw error;
      }
    } finally {
      try {
        await writeFile(
          resolve(output, "report.json"),
          JSON.stringify({ status: failed ? "failed" : "passed", report, errors, details, failure, page }, null, 2),
          "utf8",
        );
      } catch (reportError) {
        if (failed) console.error("Browser report also failed:", reportError);
        else throw reportError;
      }
    }
  }
}
