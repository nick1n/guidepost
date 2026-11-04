import { strict as assert } from "node:assert";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { runBrowser } from "../support/harness.mts";
import { setTimeout } from "node:timers/promises";
import type { WorkbookMap, WorkbookTarget } from "#lib/types/workbook.ts";

type Identity = Pick<WorkbookTarget, "contentId" | "editionId">;
const identity = ({ contentId, editionId }: Identity) => JSON.stringify([contentId, editionId]);

const directory = resolve("temp/browser-verification/workbook");
await mkdir(directory, { recursive: true });
await rm(resolve(directory, "Guidepost collection.xlsx"), { force: true });
const mapping: WorkbookMap = JSON.parse(await readFile("static/kdm/catalog/workbook-map.json", "utf8"));
const fixtures = [
  { contentId: "indomitable-survivor-dashing-reaper-paleun", editionId: "box" },
  { contentId: "pinup-easter-twilight-knight", editionId: "resin" },
].map((selected) => {
  const rows = mapping.rows.filter((row) => row.sheet === "KDM Miniatures" && row.primary.contentId === selected.contentId);
  assert.equal(rows.length, 1, `Fixture needs one reviewed row for ${selected.contentId}`);
  const row = rows[0];
  const releases = row.releaseEditions?.O ?? [];
  const target = releases.find((target) => identity(target) === identity(selected));
  assert.ok(target, `Fixture needs a reviewed O release for ${identity(selected)}`);
  return { row, target, alternatives: releases.length };
});
assert.equal(fixtures[0].alternatives, 1, "The first fixture must import without an edition choice");
assert.ok(fixtures[1].alternatives > 1, "The second fixture must require an edition choice");
const expectedImports = new Map<string, Identity>();
for (const { row, target } of fixtures) {
  for (const entry of [target, ...(row.ownershipScope === "source-row" ? (row.related ?? []) : [])]) {
    expectedImports.set(identity(entry), entry);
  }
}
const core = { contentId: "core", editionId: "1-6" };
const expectedSaved = new Map([...expectedImports, [identity(core), core]]);
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("KDM Miniatures");
sheet.getCell("B1").value = "Model";
for (const { row } of fixtures) {
  sheet.getCell(`B${row.row}`).value = row.name;
  sheet.getCell(`O${row.row}`).value = true;
}
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
  { name: "workbook", diagnostics: "document.querySelector('dialog[data-swipe-ignore]')?.innerText" },
  async ({ base, send, evaluate, waitFor, activate, assert, saveScreenshot, viewport, menuButton: button, activateMenuButton }) => {
    await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: directory });
    await viewport(1280);
    await send("Page.setInterceptFileChooserDialog", { enabled: true });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await send("Page.navigate", { url: new URL("/kdm/collection/", base).href });
    await waitFor("document.querySelector('article input[type=checkbox]:not(:disabled)')");
    await activate("Have Kingdom Death: Monster, 1.6");
    await waitFor("document.querySelector('[aria-label=\"Remove ownership of Kingdom Death: Monster, 1.6\"]')?.checked");
    await activate("Open menu");
    await waitFor(`${button("Import workbook")} && !${button("Import workbook")}.disabled`);
    await saveScreenshot("desktop.png");
    const upload = async (path: string) => {
      await activateMenuButton("Import workbook");
      const document = await send("DOM.getDocument");
      const input = await send("DOM.querySelector", {
        nodeId: document.root.nodeId,
        selector: "dialog[data-swipe-ignore] input[type=file]",
      });
      await send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [path] });
    };
    await upload(source);
    await waitFor("document.querySelector('section[aria-label=\"Review workbook import\"] select')");
    assert(
      await evaluate(`${button("Import selected editions")}.disabled`),
      "Ambiguous releases cannot be imported before choosing an edition",
    );
    await evaluate(
      `(()=>{
        const select=document.querySelector('section[aria-label="Review workbook import"] select');
        select.value=[...select.options].find(option=>option.value && JSON.parse(option.value).editionId===${JSON.stringify(fixtures[1].target.editionId)}).value;
        select.dispatchEvent(new Event('change',{bubbles:true}));
      })()`,
    );
    await waitFor(`${button(`Import ${expectedImports.size} editions`)} && !${button(`Import ${expectedImports.size} editions`)}.disabled`);
    await saveScreenshot("preview.png");
    await activateMenuButton(`Import ${expectedImports.size} editions`);
    await waitFor(`document.querySelector('dialog[data-swipe-ignore]').textContent.includes('Imported ${expectedImports.size} editions.')`);
    const saved = await evaluate<Array<Identity & { state: { owned?: boolean } }>>(
      `new Promise((resolve,reject)=>{const request=indexedDB.open('guidepost');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,transaction=db.transaction('entries'),rows=transaction.objectStore('entries').getAll();rows.onsuccess=()=>resolve(rows.result);rows.onerror=()=>reject(rows.error);transaction.oncomplete=()=>db.close()}})`,
    );
    assert(
      saved.length === expectedSaved.size && saved.every((entry) => expectedSaved.has(identity(entry)) && entry.state.owned),
      "Import preserves core 1.6 and persists exactly the selected editions and reviewed shared-row ownership",
    );
    await activateMenuButton("Export workbook");
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').textContent.includes('Workbook downloaded.')");
    const exported = new ExcelJS.Workbook();
    await exported.xlsx.load(new Uint8Array(await downloadedFile(`${directory}/Guidepost collection.xlsx`)).buffer);
    const identities = new Map<string, { owned?: boolean }>();
    for (const sheet of exported.worksheets)
      sheet.eachRow((row, number) => {
        const raw = row.getCell("AZ").value;
        if (number < 2 || typeof raw !== "string") return;
        for (const entry of JSON.parse(raw).entries) identities.set(identity(entry), entry.state);
      });
    assert(identities.get(identity(core))?.owned, "The downloaded workbook retains core ownership using its stable IDs");
    await send("Network.enable");
    await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await upload(`${directory}/Guidepost collection.xlsx`);
    await waitFor(`${button(`Import ${expectedSaved.size} editions`)} && !${button(`Import ${expectedSaved.size} editions`)}.disabled`);
    assert(
      await evaluate("!document.querySelector('section[aria-label=\"Review workbook import\"] select')"),
      "Guidepost exports reimport offline without ambiguous edition choices",
    );
    await activateMenuButton(`Import ${expectedSaved.size} editions`);
    await waitFor(`document.querySelector('dialog[data-swipe-ignore]').textContent.includes('Imported ${expectedSaved.size} editions.')`);
    await activateMenuButton("Export workbook");
    await waitFor("document.querySelector('dialog[data-swipe-ignore]').textContent.includes('Workbook downloaded.')");
    assert(true, "Import and export both complete while the browser is offline");
  },
);
