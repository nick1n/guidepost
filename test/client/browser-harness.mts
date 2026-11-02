import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

type Reply = { result?: { value: unknown }; exceptionDetails?: unknown; data?: string };
type Context = {
  base: URL;
  send: (method: string, params?: object) => Promise<Reply>;
  evaluate: <T = unknown>(expression: string) => Promise<T>;
  waitFor: (expression: string) => Promise<void>;
  click: (label: string) => Promise<void>;
  errors: unknown[];
  report: string[];
  assert: (condition: unknown, message: string) => void;
  saveScreenshot: (path: string) => Promise<void>;
};

export function findBrowser(exists = existsSync, preferred = process.env.CHROME_PATH) {
  const executable = [
    preferred,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    // The packaged Chrome has Ubuntu's sandbox profile; runner Chromium is a development snapshot.
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find((path) => path && exists(path));
  if (!executable) throw new Error("Install Chrome/Chromium or set CHROME_PATH. No browser is downloaded automatically.");
  return executable;
}

export async function runBrowser(profilePrefix: string, diagnosticExpression: string, run: (context: Context) => Promise<void>) {
  const base = new URL(process.argv.slice(2).find((arg) => arg !== "--") ?? "http://127.0.0.1:5173");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Use a local test server.");
  const executable = findBrowser();
  const profile = await mkdtemp(join(tmpdir(), `guidepost-${profilePrefix}-`));
  const chrome = spawn(
    executable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--disable-extensions",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
  );
  let stderr = "";
  chrome.stderr.setEncoding("utf8");
  chrome.stderr.on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-4096);
  });
  let launchError: Error | undefined;
  chrome.on("error", (error) => {
    launchError = error;
  });
  const startupError = () =>
    new Error(
      `Chrome debugger did not start: ${executable} (exit ${chrome.exitCode}, signal ${chrome.signalCode})\n${launchError?.message ?? ""}\n${stderr}`,
    );
  let closed = false;
  const exited = new Promise<void>((resolve) => {
    chrome.once("close", () => {
      closed = true;
      resolve();
    });
  });
  const waitForExit = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        exited.then(() => true),
        new Promise<false>((resolve) => {
          timer = setTimeout(() => resolve(false), 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  let socket: WebSocket | undefined;
  let closeBrowser: (() => void) | undefined;
  let failed = false;
  try {
    let target;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (launchError || chrome.exitCode !== null || chrome.signalCode !== null) throw startupError();
      try {
        const port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
        target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!target) throw startupError();
    const connection = new WebSocket(target.webSocketDebuggerUrl);
    socket = connection;
    await new Promise<void>((resolve, reject) => {
      connection.onopen = () => resolve();
      connection.onerror = reject;
    });
    let sequence = 0;
    closeBrowser = () => connection.send(JSON.stringify({ id: ++sequence, method: "Browser.close" }));
    const pending = new Map<
      number,
      { resolve: (reply: Reply) => void; reject: (reason: unknown) => void; timer: ReturnType<typeof setTimeout> }
    >();
    const errors: unknown[] = [];
    connection.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params);
      const task = pending.get(message.id);
      if (task) {
        pending.delete(message.id);
        clearTimeout(task.timer);
        message.error ? task.reject(message.error) : task.resolve(message.result);
      }
    };
    const send = (method: string, params = {}) =>
      new Promise<Reply>((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, 15000);
        pending.set(id, { resolve, reject, timer });
        connection.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async <T = unknown,>(expression: string): Promise<T> => {
      const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result?.value as T;
    };
    const waitFor = async (expression: string) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate(expression)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Timed out: ${expression}\nPage: ${await evaluate(diagnosticExpression)}\nErrors: ${JSON.stringify(errors)}`);
    };
    const click = async (label: string) => {
      const expression = `[...document.querySelectorAll('[aria-label]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(label)})`;
      await waitFor(`${expression} && !${expression}.disabled`);
      await evaluate(`${expression}.click()`);
      await evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
    };
    const report: string[] = [];
    const assert: Context["assert"] = (condition, message) => {
      if (!condition) throw new Error(message);
      report.push(message);
      console.log("PASS:", message);
    };
    const saveScreenshot = async (path: string) => {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      if (!shot.data) throw new Error("Screenshot data missing");
      await writeFile(path, Buffer.from(shot.data, "base64"));
    };
    await send("Runtime.enable");
    await send("Page.enable");
    // /json/new can leave this target in the background, where document.hasFocus() is false.
    await send("Page.bringToFront");
    // Runtime.exceptionThrown omits errors handled by the browser's window error dispatch, including ResizeObserver loop errors.
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source:
        "window.addEventListener('error', event => console.error('window.error', event.message, event.error)); window.addEventListener('unhandledrejection', event => console.error('unhandledrejection', event.reason));",
    });
    await run({ base, send, evaluate, waitFor, click, errors, report, assert, saveScreenshot });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      if (chrome.pid && !closed) {
        if (socket?.readyState === WebSocket.OPEN && closeBrowser) closeBrowser();
        else chrome.kill();
        if (!(await waitForExit())) {
          chrome.kill("SIGKILL");
          if (!(await waitForExit())) throw new Error(`Chrome did not exit; keeping its profile at ${profile}`);
        }
      }
      // Chrome subprocesses can briefly retain profile files after the browser process exits.
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch (error) {
      if (failed) console.error("Browser cleanup also failed:", error);
      else throw error;
    } finally {
      socket?.close();
    }
  }
}
