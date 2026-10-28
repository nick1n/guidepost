import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { runBrowser } from "./browser-harness.mts";
import { setTimeout } from "node:timers/promises";

const directory = resolve("temp/browser-verification/workbook");
await mkdir(directory, { recursive: true });
await rm(resolve(directory, "Guidepost collection.xlsx"), { force: true });
const mapping = JSON.parse(await readFile("static/kdm/catalog/workbook-map.json", "utf8"));
const first = mapping.rows[0];
const ambiguous = mapping.rows.find((source: { releaseEditions?: { O?: unknown[] } }) => (source.releaseEditions?.O?.length ?? 0) > 1);
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("KDM Miniatures");
sheet.getCell("B1").value = "Model";
sheet.getCell(`B${first.row}`).value = first.name;
sheet.getCell(`O${first.row}`).value = true;
sheet.getCell(`B${ambiguous.row}`).value = ambiguous.name;
sheet.getCell(`O${ambiguous.row}`).value = true;
const source = resolve(directory, "import.xlsx");
await workbook.xlsx.writeFile(source);

async function downloadedFile(path: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const bytes = await readFile(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    if (bytes) return bytes;
    await setTimeout(50);
  }
  throw new Error(`Workbook download did not complete: ${path}`);
}

await runBrowser(
  "workbook",
  "document.querySelector('dialog[data-swipe-ignore]')?.innerText",
  async ({ base, send, evaluate, waitFor, click, assert, saveScreenshot, errors, report }) => {
    const button = (label: string) =>
      `[...document.querySelectorAll('dialog[data-swipe-ignore] button')].find(button => button.textContent.trim().startsWith(${JSON.stringify(label)}))`;
    await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: directory });
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.setInterceptFileChooserDialog", { enabled: true });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await send("Page.navigate", { url: new URL("/kdm/collection/", base).href });
    await waitFor("document.querySelector('article input[type=checkbox]:not(:disabled)')");
    await click("Have Kingdom Death: Monster, 1.6");
    await waitFor("document.querySelector('[aria-label=\"Remove ownership of Kingdom Death: Monster, 1.6\"]')?.checked");
    await click("Open menu");
    await waitFor(`${button("Import workbook")} && !${button("Import workbook")}.disabled`);
    await saveScreenshot(`${directory}/desktop.png`);
    const upload = async (path: string) => {
      await evaluate(`${button("Import workbook")}.click()`);
      const document = (await send("DOM.getDocument")) as unknown as { root: { nodeId: number } };
      const input = (await send("DOM.querySelector", {
        nodeId: document.root.nodeId,
        selector: "dialog[data-swipe-ignore] input[type=file]",
      })) as unknown as { nodeId: number };
      await send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [path] });
      await evaluate(
        "document.querySelector('dialog[data-swipe-ignore] input[type=file]').dispatchEvent(new Event('change',{bubbles:true}))",
      );
    };
    await upload(source);
    await waitFor("document.querySelector('section[aria-label=\"Review workbook import\"] select')");
    assert(
      await evaluate(`${button("Import selected editions")}.disabled`),
      "Ambiguous releases cannot be imported before choosing an edition",
    );
    await evaluate(
      "(()=>{const select=document.querySelector('section[aria-label=\"Review workbook import\"] select');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}))})()",
    );
    await waitFor(`${button("Import 3 editions")} && !${button("Import 3 editions")}.disabled`);
    await saveScreenshot(`${directory}/preview.png`);
    await evaluate(`${button("Import 3 editions")}.click()`);
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').textContent.includes('Imported 3 editions.')");
    const saved = await evaluate<unknown[]>(
      `new Promise((resolve,reject)=>{const request=indexedDB.open('guidepost-collection');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,transaction=db.transaction('entries'),rows=transaction.objectStore('entries').getAll();rows.onsuccess=()=>resolve(rows.result);rows.onerror=()=>reject(rows.error);transaction.oncomplete=()=>db.close()}})`,
    );
    assert(saved.length === 4, "Import preserves core 1.6 and persists selected editions and reviewed shared-row ownership");
    await evaluate(`${button("Export workbook")}.click()`);
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').textContent.includes('Workbook downloaded.')");
    const exported = new ExcelJS.Workbook();
    await exported.xlsx.load(new Uint8Array(await downloadedFile(`${directory}/Guidepost collection.xlsx`)).buffer);
    assert(
      JSON.stringify(exported.worksheets.map((sheet) => sheet.name)) ===
        JSON.stringify(["KDM Miniatures", "Shirt Catalog", "Dice Catalog"]),
      "Export preserves the original three workbook tabs",
    );
    const identities = new Map<string, { sheet: string; state: { owned?: boolean } }>();
    for (const sheet of exported.worksheets)
      sheet.eachRow((row, number) => {
        const raw = row.getCell("AZ").value;
        if (number < 2 || typeof raw !== "string") return;
        for (const entry of JSON.parse(raw).entries)
          identities.set(JSON.stringify([entry.contentId, entry.editionId]), { sheet: sheet.name, state: entry.state });
      });
    assert(identities.get(JSON.stringify(["core", "1-6"]))?.state.owned, "Core 1.6 exports using its stable catalog IDs");
    assert(
      identities.get(JSON.stringify(["shirt-honeycomb-weaver", "item"]))?.sheet === "Shirt Catalog",
      "Missing shirts are added to the shirt tab",
    );
    assert(
      identities.get(JSON.stringify(["dice-parasite-queen", "item"]))?.sheet === "Dice Catalog",
      "Missing dice are added to the dice tab",
    );
    await send("Network.enable");
    await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await upload(`${directory}/Guidepost collection.xlsx`);
    await waitFor(`${button("Import 4 editions")} && !${button("Import 4 editions")}.disabled`);
    assert(
      await evaluate("!document.querySelector('section[aria-label=\"Review workbook import\"] select')"),
      "Guidepost exports reimport offline without ambiguous edition choices",
    );
    await evaluate(`${button("Import 4 editions")}.click()`);
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').textContent.includes('Imported 4 editions.')");
    await evaluate(`${button("Export workbook")}.click()`);
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').textContent.includes('Workbook downloaded.')");
    assert(true, "Import and export both complete while the browser is offline");
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    if (!(await evaluate("document.querySelector('dialog[data-swipe-ignore]').open"))) await click("Open menu");
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
    await evaluate("document.querySelector('dialog[data-swipe-ignore] .body').scrollTop=10000");
    await saveScreenshot(`${directory}/mobile.png`);
    await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
    if (!(await evaluate("document.querySelector('dialog[data-swipe-ignore]').open"))) await click("Open menu");
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').open");
    await evaluate("document.querySelector('dialog[data-swipe-ignore] .body').scrollTop=10000");
    assert(await evaluate("document.documentElement.scrollWidth === innerWidth"), "Workbook controls fit a narrow mobile viewport");
    await saveScreenshot(`${directory}/mobile-narrow.png`);
    assert(errors.length === 0, `No browser runtime errors: ${JSON.stringify(errors)}`);
    await writeFile(`${directory}/report.json`, JSON.stringify({ report, errors }, null, 2));
  },
);
