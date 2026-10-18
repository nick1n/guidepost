import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const base = new URL(process.argv.slice(2).find((arg) => arg !== "--") ?? "http://127.0.0.1:5173");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Use a local test server.");
const executable = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].find((path) => path && existsSync(path));
if (!executable) throw new Error("Install Chrome/Chromium or set CHROME_PATH. No browser is downloaded automatically.");
const profile = await mkdtemp(join(tmpdir(), "guidepost-browser-"));
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
  { windowsHide: true, stdio: "ignore" },
);
type Reply = { result?: { value: unknown }; exceptionDetails?: unknown; data?: string };
let socket: WebSocket | undefined;
try {
  let target;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
      target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!target) throw new Error("Chrome debugger did not start");
  const connection = new WebSocket(target.webSocketDebuggerUrl);
  socket = connection;
  await new Promise<void>((ok, fail) => {
    connection.onopen = () => ok();
    connection.onerror = fail;
  });
  let sequence = 0;
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
  const evaluate = async (expression: string) => {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result?.value;
  };
  const waitFor = async (expression: string) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(
      `Timed out: ${expression}\nPage: ${await evaluate("document.body.innerText.slice(0,4000)")}\nErrors: ${JSON.stringify(errors)}`,
    );
  };
  const click = async (label: string) => {
    const expression = `[...document.querySelectorAll('[aria-label]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(label)})`;
    await waitFor(`${expression} && !${expression}.disabled`);
    await evaluate(`${expression}.click()`);
    await evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
  };
  const rows = async () => {
    const records = await evaluate(
      `(async()=>{await new Promise(r=>setTimeout(r,200));const db=await new Promise((r,j)=>{const q=indexedDB.open('guidepost-collection');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});try{return await new Promise((r,j)=>{const q=db.transaction('entries','readonly').objectStore('entries').getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})}finally{db.close()}})()`,
    );
    if (!Array.isArray(records)) throw new Error("Expected stored collection rows");
    return records;
  };
  const navigate = async (url: string) => {
    await send("Page.navigate", { url });
    await waitFor("document.querySelector('article input[type=checkbox]:not(:disabled)') !== null");
  };
  const report: string[] = [];
  function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
    report.push(message);
    console.log("PASS:", message);
  }
  const coreUrl = new URL("/kdm/collection/?q=kingdom%20death%20monster", base).href;
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate(coreUrl);
  async function progress(label: string, expected: number) {
    const selector = `document.querySelector('input[aria-label="${label}"]').closest('.edition')`;
    await waitFor(`Math.abs(parseFloat(getComputedStyle(${selector}).getPropertyValue('--ownership-progress')) - ${expected}) < 0.1`);
    assert(
      await evaluate(`(()=>{
      const row=${selector};
      const probe=document.createElement('div');
      row.append(probe);
      probe.style.borderImageSource='linear-gradient(to left, var(--grey-7) ${expected}%, var(--grey-8) 0)';
      const expected=getComputedStyle(probe).borderImageSource;
      probe.remove();
      return getComputedStyle(row).borderImageSource===expected && getComputedStyle(row).transitionProperty.includes('--ownership-progress');
    })()`),
      `Grey right-to-left animated progress at ${expected}%`,
    );
  }
  await progress("Have Kingdom Death: Monster, 1.6", 0);
  await click("Have Kingdom Death: Monster, 1.6");
  await evaluate("document.querySelector('.edition-detail:not(.inactive) details.contents summary').click()");
  assert(
    await evaluate("![...document.querySelectorAll('button')].some(e=>e.textContent.includes('Show missing only'))"),
    "Removed missing-only control stays absent",
  );
  await progress("Remove ownership of Kingdom Death: Monster, 1.6", 100);
  await click("View Kingdom Death: Monster, 1.3, includes gameplay");
  assert(
    await evaluate(
      "[...document.querySelectorAll('.edition-detail:not(.inactive) .included-owned')].some(e=>e.textContent.trim().startsWith('Owned:'))",
    ),
    "Other-edition labels use Owned text",
  );
  assert(
    await evaluate("[...document.querySelectorAll('input[type=checkbox]')].every(e=>!e.indeterminate)"),
    "Other-edition ownership does not draw minus indicators",
  );
  const partial = await evaluate(
    "parseFloat(document.querySelector('input[aria-label=\"Have Kingdom Death: Monster, 1.3\"]').closest('.edition').style.getPropertyValue('--ownership-progress'))",
  );
  assert(typeof partial === "number" && partial > 0 && partial < 100, "Other editions count only matching contents toward progress");
  await progress("Have Kingdom Death: Monster, 1.3", partial);
  assert(
    await evaluate("document.querySelector('.edition-detail:not(.inactive) details.contents').open"),
    "Included contents stay open when editions change",
  );
  await mkdir("temp/browser-verification", { recursive: true });
  for (const width of [1280, 390]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 });
    await progress("Have Kingdom Death: Monster, 1.3", partial);
    const screenshot = await send("Page.captureScreenshot", { format: "png" });
    if (!screenshot.data) throw new Error("Screenshot data missing");
    await writeFile(`temp/browser-verification/collection-${width}.png`, Buffer.from(screenshot.data, "base64"));
  }
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert(
    await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--duration-medium').trim()==='0s'"),
    "Reduced motion removes progress animation duration",
  );
  await send("Emulation.setEmulatedMedia", { features: [] });
  await click("View Kingdom Death: Monster, 1.6, includes gameplay");
  await click("Mark Butcher, Plastic missing");
  await waitFor("document.querySelector('.edition-detail:not(.inactive) .contents-count').textContent.includes('19 of 20 owned')");
  assert(
    await evaluate("document.querySelector('input[aria-label=\"Remove ownership of Kingdom Death: Monster, 1.6\"]').checked"),
    "Missing component leaves product owned",
  );
  await click("Remove ownership of Kingdom Death: Monster, 1.6");
  await click("Have Kingdom Death: Monster, 1.6");
  await waitFor("document.querySelector('.edition-detail:not(.inactive) .contents-count').textContent.includes('20 of 20')");
  let saved = await rows();
  assert(
    saved.length === 1 && saved[0].contentId === "core" && saved[0].state.owned,
    "Rechecking restores contents and removes missing record",
  );
  await click("Remove ownership of Kingdom Death: Monster, 1.6");
  await click("Have Butcher, Plastic");
  await click("Have Kingdom Death: Monster, 1.6");
  await click("Remove ownership of Kingdom Death: Monster, 1.6");
  saved = await rows();
  assert(
    saved.length === 1 && saved[0].contentId === "butcher" && saved[0].state.owned,
    "Removing product preserves separately acquired component and removes empty product row",
  );
  await evaluate("window.verificationReloadSentinel = true");
  await send("Page.reload");
  await waitFor(
    "!window.verificationReloadSentinel && document.querySelector('input[aria-label=\"Have Kingdom Death: Monster, 1.6\"]:not(:disabled)') !== null && document.querySelector('.edition-detail:not(.inactive) details.contents summary') !== null",
  );
  await evaluate("document.querySelector('.edition-detail:not(.inactive) details.contents summary').click()");
  await waitFor("document.querySelector('input[aria-label=\"Mark Butcher, Plastic missing\"]')?.checked === true");
  assert(
    (await rows()).some((r) => r.contentId === "butcher" && r.state.owned),
    "Separate component ownership survives reload",
  );
  await click("Mark Butcher, Plastic missing");
  await waitFor("document.querySelector('input[aria-label=\"Have Butcher, Plastic\"]')?.checked === false");
  assert((await rows()).length === 0, "Unchecking a standalone component removes its empty record without a missing override");
  assert(errors.length === 0, "No browser runtime exceptions");
  await mkdir("temp/browser-verification", { recursive: true });
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  if (!screenshot.data) throw new Error("Screenshot data missing");
  await writeFile("temp/browser-verification/ownership.png", Buffer.from(screenshot.data, "base64"));
  await writeFile("temp/browser-verification/report.json", JSON.stringify({ report, errors }, null, 2));
} finally {
  socket?.close();
  chrome.kill();
}
