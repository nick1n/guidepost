import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";

type Replies = {
  "DOM.getDocument": { root: { nodeId: number } };
  "DOM.querySelector": { nodeId: number };
  "Runtime.evaluate": { result: { value?: unknown }; exceptionDetails?: unknown };
  "Page.captureScreenshot": { data: string };
};
type Reply<Method extends string> = Method extends keyof Replies ? Replies[Method] : Record<string, unknown>;
export type Send = <Method extends string>(method: Method, params?: object) => Promise<Reply<Method>>;
type Event = { method: string; params?: Record<string, unknown> };
type Message = Partial<Event> & { id?: number; result?: unknown; error?: { message: string } };
type Task = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
type Options = { name: string; onEvent?: (event: Event) => void; startupTimeout?: number };

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

export async function openBrowser({ name, onEvent, startupTimeout = 10000 }: Options) {
  const executable = findBrowser();
  const directory = resolve(tmpdir());
  const profile = await mkdtemp(join(directory, `guidepost-${name}-`));
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
  let closed = false;
  const exited = new Promise<void>((done) =>
    chrome.once("close", () => {
      closed = true;
      done();
    }),
  );
  let socket: WebSocket | undefined;
  let sequence = 0;
  let disconnected: Error | undefined;
  const pending = new Map<number, Task>();
  const disconnect = (error: Error) => {
    disconnected ??= error;
    for (const task of pending.values()) {
      clearTimeout(task.timer);
      task.reject(disconnected);
    }
    pending.clear();
  };
  chrome.once("exit", () => disconnect(new Error("Chrome exited; debugger disconnected")));
  const send: Send = <Method extends string>(method: Method, params = {}) => {
    const connection = socket;
    if (disconnected || !connection || connection.readyState !== WebSocket.OPEN) {
      return Promise.reject(disconnected ?? new Error("Chrome debugger is not connected"));
    }
    // JSON protocol payloads are untyped at the wire; keep the assertion here, away from callers.
    return new Promise<unknown>((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      try {
        connection.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        disconnect(error instanceof Error ? error : new Error(String(error)));
      }
    }) as Promise<Reply<Method>>;
  };
  const waitForExit = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        exited.then(() => true),
        new Promise<false>((done) => {
          timer = setTimeout(() => done(false), 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      disconnect(new Error("Chrome debugger connection closed"));
      try {
        if (chrome.pid && !closed) {
          if (socket?.readyState === WebSocket.OPEN) {
            try {
              socket.send(JSON.stringify({ id: ++sequence, method: "Browser.close" }));
            } catch {
              chrome.kill();
            }
          } else chrome.kill();
          if (!(await waitForExit())) {
            chrome.kill("SIGKILL");
            if (!(await waitForExit())) throw new Error(`Chrome did not exit; keeping its profile at ${profile}`);
          }
        }
        // Chrome subprocesses can briefly retain profile files after the browser process exits.
        if (dirname(profile) !== directory) throw new Error(`Browser profile is outside the temporary directory: ${profile}`);
        await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      } finally {
        socket?.close();
      }
    })());

  try {
    const deadline = Date.now() + startupTimeout;
    let debuggerUrl: string | undefined;
    let lastError: unknown;
    while (Date.now() < deadline) {
      if (launchError || chrome.exitCode !== null || chrome.signalCode !== null)
        throw launchError ?? new Error("Chrome exited during startup");
      try {
        const port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
        const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
          method: "PUT",
          signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
        });
        if (!response.ok) throw new Error(`Debugger target request returned ${response.status}`);
        const target = await response.json();
        if (typeof target.webSocketDebuggerUrl !== "string") throw new Error("Debugger target has no WebSocket URL");
        debuggerUrl = target.webSocketDebuggerUrl;
        break;
      } catch (error) {
        lastError = error;
      }
      await delay(Math.max(0, Math.min(250, deadline - Date.now())));
    }
    if (!debuggerUrl) throw new Error("Chrome debugger startup timed out", { cause: lastError });
    const connection = new WebSocket(debuggerUrl);
    socket = connection;
    let rejectOpening: ((error: Error) => void) | undefined;
    connection.onclose = () => {
      const error = new Error("Chrome debugger disconnected");
      disconnect(error);
      rejectOpening?.(error);
    };
    connection.onerror = () => {
      const error = new Error("Chrome debugger disconnected: WebSocket error");
      disconnect(error);
      rejectOpening?.(error);
    };
    connection.onmessage = ({ data }) => {
      const message: Message = JSON.parse(String(data));
      if (message.method) onEvent?.({ method: message.method, params: message.params });
      if (message.id === undefined) return;
      const task = pending.get(message.id);
      if (task) {
        pending.delete(message.id);
        clearTimeout(task.timer);
        message.error ? task.reject(new Error(`CDP error: ${message.error.message}`)) : task.resolve(message.result);
      }
    };
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => rejectOpening?.(new Error("Chrome debugger WebSocket connection timed out")),
        Math.max(1, deadline - Date.now()),
      );
      rejectOpening = (error) => {
        clearTimeout(timer);
        reject(error);
      };
      connection.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    rejectOpening = undefined;
    return {
      send,
      close,
      get connected() {
        return !disconnected && connection.readyState === WebSocket.OPEN;
      },
    };
  } catch (cause) {
    const error = new Error(
      `Chrome debugger did not start: ${executable} (exit ${chrome.exitCode}, signal ${chrome.signalCode})\n${stderr}\n${String(cause)}`,
      { cause },
    );
    try {
      await close();
    } catch (cleanupError) {
      console.error("Browser cleanup also failed:", cleanupError);
    }
    throw error;
  }
}
