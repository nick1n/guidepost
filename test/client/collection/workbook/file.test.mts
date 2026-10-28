import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import ExcelJS from "exceljs";
import type { Document, Element } from "@xmldom/xmldom";
import { it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { vi } from "vitest";
import { FetchHttpClient } from "effect/http";
import catalogJson from "#catalog/data.json";
import { collectionKey, type Catalog, type Edition } from "#lib/types/index.ts";
import { Collection } from "#lib/kdm/collection/state/collection.svelte.ts";
import { previewWorkbookRows, TransferError } from "#lib/kdm/collection/state/collection-transfer.ts";
import { mapping, readWorkbook, writeWorkbook, resolveDrafts } from "#lib/kdm/collection/workbook/file.ts";
import { makeStore } from "../test-store.ts";
import { reviewEntries, reviewEditions } from "#lib/catalog-view.ts";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { columnIndex, elements, parseXml, serializeXml, setCell } from "#lib/kdm/collection/workbook/xml.ts";
import { templateBytes } from "#lib/kdm/collection/workbook/template.ts";
import { releasePairs, workbookProducts } from "#lib/kdm/collection/workbook/products.ts";
import { metadataColumn, templateMarker, sheets, releaseColumns, type WorkbookSheet, type TemplateEntry } from "#lib/types/workbook.ts";

const data = catalogJson as Catalog;
const products = workbookProducts(reviewEntries(data), mapping);
const first = mapping.rows[0];
const key = collectionKey(first.primary.contentId, first.primary.editionId);

it("pairs painter and remaster releases within their sculpt families and classifies their scale", () => {
  const editions: Edition[] = [
    { id: "first", label: "Painters: First Run", format: "physical" },
    { id: "encore", label: "Painters: Encore", format: "physical" },
    { id: "remaster-first", label: "Remaster: First Run", format: "physical" },
    { id: "remaster-encore", label: "Remaster: Encore", format: "physical" },
  ];
  assert.deepEqual(
    releasePairs(editions).map((pair) => pair.map((edition) => edition.id)),
    [
      ["first", "encore"],
      ["remaster-first", "remaster-encore"],
    ],
  );
  assert.equal(
    products.classifications([{ contentId: "woe-white-speaker", editionId: "first-run", label: "", material: "", state: {} }]).S,
    true,
  );
  for (const [contentId, editionId, expected] of [
    ["sci-fi-lucy", "painters", true],
    ["sci-fi-lucy", "first-run", false],
    ["death-high-intimacy-couple", "remaster-encore", false],
    ["necromancer-boss", "remaster-first-run", false],
    ["level-2-butcher-prototype", "first-run", false],
    ["sun-claws-esther", "first-run", false],
  ] as const)
    assert.equal(products.classifications([{ contentId, editionId, label: "", material: "", state: {} }]).S, expected, contentId);
});

it.effect("exports boolean cells as checkbox controls instead of overflowing TRUE/FALSE text", () =>
  Effect.gen(function* () {
    const archive = unzipSync(yield* writeWorkbook([], reviewEntries(data)));
    assert.ok(archive["xl/featurePropertyBag/featurePropertyBag.xml"], "Missing checkbox control definitions");
    const namespace = "http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag";
    const properties = parseXml(strFromU8(archive["xl/featurePropertyBag/featurePropertyBag.xml"]));
    const bags = Array.from(properties.getElementsByTagNameNS(namespace, "bag"));
    assert.deepEqual(
      bags.map((bag) => bag.getAttribute("type")),
      ["Checkbox", "XFControls", "XFComplement", "XFComplements"],
    );
    assert.equal(bags[1].textContent, "0");
    assert.equal(bags[2].textContent, "1");
    assert.equal(bags[3].textContent, "2");
    assert.match(strFromU8(archive["xl/_rels/workbook.xml.rels"]), /Target="featurePropertyBag\/featurePropertyBag.xml"/u);
    assert.match(strFromU8(archive["[Content_Types].xml"]), /ContentType="application\/vnd.ms-excel.featurepropertybag\+xml"/u);
    const styles = elements(parseXml(strFromU8(archive["xl/styles.xml"])), "cellXfs")[0];
    const formats = elements(styles, "xf");
    for (let sheet = 1; sheet <= 3; sheet++) {
      const document = parseXml(strFromU8(archive[`xl/worksheets/sheet${sheet}.xml`]));
      for (const cell of elements(document, "c").filter((cell) => cell.getAttribute("t") === "b")) {
        const style = formats[Number(cell.getAttribute("s"))];
        assert.ok(
          style?.getElementsByTagNameNS(namespace, "xfComplement").length,
          `Missing checkbox formatting on sheet ${sheet}, ${cell.getAttribute("r")}`,
        );
      }
    }
  }),
);

it.effect("excludes homebrew rows and saved homebrew state from the official collection workbook", () =>
  Effect.gen(function* () {
    const item = reviewEntries(data).find((item) => item.category === "homebrew")!;
    const bytes = yield* writeWorkbook(
      [{ sheet: "Guidepost collection", row: 2, name: item.name, contentId: item.id, editionId: reviewEditions(item)[0].id, owned: true }],
      reviewEntries(data),
    );
    const archive = unzipSync(bytes);
    for (let sheet = 1; sheet <= 3; sheet++) {
      const document = parseXml(strFromU8(archive[`xl/worksheets/sheet${sheet}.xml`]));
      for (const cell of elements(document, "c").filter((cell) => cell.getAttribute("r")?.startsWith(metadataColumn))) {
        const raw = elements(cell, "t")
          .map((node) => node.textContent)
          .join("");
        if (!raw.startsWith("{")) continue;
        for (const entry of JSON.parse(raw).entries)
          assert.notEqual(reviewEntries(data).find((item) => item.id === entry.contentId)?.category, "homebrew");
      }
    }
    assert.deepEqual(yield* readWorkbook(file(bytes)), []);
  }),
);

it.effect("integrates new miniature entries into the original newest-first release date order", () =>
  Effect.gen(function* () {
    const bytes = yield* writeWorkbook([], reviewEntries(data));
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.load(bytes.buffer));
    let previous = Infinity;
    workbook.getWorksheet("KDM Miniatures")!.eachRow((row, number) => {
      if (number === 1 || !row.getCell(metadataColumn).value) return;
      const value = row.getCell("F").value;
      const date = value instanceof Date ? value.getTime() : typeof value === "number" ? value : -Infinity;
      assert.ok(date <= previous, `Release date order breaks at row ${number}: ${row.getCell("B").text}`);
      previous = date;
    });
  }),
);

it.effect("combines First Run and Encore on one product row with independent release checkboxes and state", () =>
  Effect.gen(function* () {
    const id = "level-2-butcher-prototype";
    const firstRun = collectionKey(id, "first-run");
    const encore = collectionKey(id, "encore");
    const snapshot = { [firstRun]: { owned: true, missing: true, copyNumber: 17 }, [encore]: { wished: true } };
    const collection = new Collection(data);
    yield* collection.setStore(makeStore(snapshot));
    const bytes = yield* writeWorkbook(yield* collection.exportWorkbook(), reviewEntries(data));
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.load(bytes.buffer));
    const matches = productRows(workbook, id);
    assert.equal(matches.length, 1, "First Run and Encore must share one visible row");
    const row = matches[0];
    assert.equal(row.getCell("B").value, data.content[id].name);
    assert.equal(row.getCell("M").value, true);
    assert.equal(row.getCell("N").value, false);
    assert.equal(row.getCell("L").value, 17);
    const entries = JSON.parse(String(row.getCell(metadataColumn).value)).entries;
    assert.deepEqual(
      entries.map((entry: { editionId: string; column: string }) => [entry.editionId, entry.column]),
      [
        ["first-run", "M"],
        ["encore", "N"],
      ],
    );
    const unchanged = new Collection(data);
    const unchangedStore = makeStore();
    yield* unchanged.setStore(unchangedStore);
    yield* unchanged.importWorkbook(resolveDrafts(yield* readWorkbook(file(bytes))));
    assert.deepEqual(unchangedStore.state, snapshot);

    const edited = editWorkbook(bytes, (worksheet) => {
      const [row] = xmlProductRows(worksheet("KDM Miniatures"), id, "first-run");
      assert.ok(row);
      setCell(row, "M", false);
      setCell(row, "N", true);
      setCell(row, "L", 23);
    });
    const target = new Collection(data);
    const store = makeStore();
    yield* target.setStore(store);
    yield* target.importWorkbook(resolveDrafts(yield* readWorkbook(file(edited))));
    assert.deepEqual(store.state, { [firstRun]: { copyNumber: 23 }, [encore]: { owned: true } });
  }),
);

it("adds a missing Encore to the existing First Run row without creating another product line", () => {
  const id = "golden-bat";
  const item = reviewEntries(data).find((item) => item.id === id)!;
  const source = mapping.rows.find((row) => row.primary.contentId === id)!;
  const products = workbookProducts([item], { ...mapping, rows: [source] });
  const [plan] = products.planRows([], [{ name: source.sheet, rows: [{ row: source.row, name: source.name, material: "Resin" }] }]);
  assert.equal(plan.rows.size, 1);
  assert.equal(plan.additions.length, 0);
  assert.equal(plan.rows.get(source.row)?.name, source.name);
  assert.deepEqual(
    plan.rows.get(source.row)?.entries.map(({ editionId, column, state }) => ({ editionId, column, state })),
    [
      { editionId: "first-run", column: "M", state: {} },
      { editionId: "encore", column: "N", state: {} },
    ],
  );
});

it("plans separate product rows for different materials while preserving independent edition fields", () => {
  const id = "model";
  const editions: Edition[] = [
    { id: "first", label: "First Run", format: "physical", materials: ["Resin"] },
    { id: "encore", label: "Encore", format: "physical", materials: ["Photoresin"] },
  ];
  const products = workbookProducts([{ id, name: "Model", category: "content", kind: "model", tags: [], editions }], {
    ...mapping,
    rows: [],
  });
  const [plan] = products.planRows(
    [
      { sheet: "Guidepost collection", row: 3, name: "Model", contentId: id, editionId: "first", owned: true, copyNumber: 12 },
      { sheet: "Guidepost collection", row: 4, name: "Model", contentId: id, editionId: "encore", wished: true },
    ],
    [{ name: "KDM Miniatures", rows: [] }],
  );
  assert.deepEqual(
    plan.additions.map((row) => row.entries.map(({ editionId, material, column, state }) => ({ editionId, material, column, state }))),
    [
      [{ editionId: "first", material: "Resin", column: "M", state: { owned: true, copyNumber: 12 } }],
      [{ editionId: "encore", material: "Photoresin", column: "N", state: { wished: true } }],
    ],
  );
});

it.effect("uses the First Run date for grouped releases and keeps different material releases on separate lines", () =>
  Effect.gen(function* () {
    const id = "level-2-butcher-prototype";
    const catalog = structuredClone(data);
    const editions = catalog.content[id].editions!;
    editions.find((edition) => edition.id === "first-run")!.releaseDate = "2025-01-15";
    const encore = editions.find((edition) => edition.id === "encore")!;
    encore.releaseDate = "2026-08-31";
    const grouped = new ExcelJS.Workbook();
    const bytes = yield* writeWorkbook([], reviewEntries(catalog));
    yield* Effect.promise(() => grouped.xlsx.load(bytes.buffer));
    const rows = productRows(grouped, id);
    assert.equal(rows.length, 1);
    assert.equal((rows[0].getCell("F").value as Date).toISOString().slice(0, 10), "2025-01-15");
    const variants = productRows(grouped, "black-friday-ninja-variant").filter((row) => {
      const entries = JSON.parse(String(row.getCell(metadataColumn).value)).entries as { editionId: string }[];
      return entries.some((entry) => ["first-run", "encore"].includes(entry.editionId));
    });
    assert.equal(variants.length, 2);

    encore.materials = ["Resin"];
    const separate = new ExcelJS.Workbook();
    const distinct = yield* writeWorkbook([], reviewEntries(catalog));
    yield* Effect.promise(() => separate.xlsx.load(distinct.buffer));
    assert.equal(productRows(separate, id).length, 2);
  }),
);

function productRows(workbook: ExcelJS.Workbook, contentId: string) {
  const rows: ExcelJS.Row[] = [];
  const sheet = workbook.getWorksheet("KDM Miniatures");
  assert.ok(sheet);
  sheet.eachRow((row) => {
    const raw = row.getCell(metadataColumn).value;
    if (
      typeof raw === "string" &&
      raw.startsWith("{") &&
      JSON.parse(raw).entries.some((entry: { contentId: string }) => entry.contentId === contentId)
    )
      rows.push(row);
  });
  return rows;
}

function editWorkbook(bytes: Uint8Array<ArrayBuffer>, edit: (worksheet: (name: WorkbookSheet) => Document) => void) {
  const archive = unzipSync(bytes);
  const documents = new Map<string, Document>();
  edit((name) => {
    const path = `xl/worksheets/sheet${sheets.indexOf(name) + 1}.xml`;
    let document = documents.get(path);
    if (!document) {
      document = parseXml(strFromU8(archive[path]));
      documents.set(path, document);
    }
    return document;
  });
  for (const [path, document] of documents) archive[path] = strToU8(serializeXml(document));
  return zipSync(archive);
}

function xmlProductRows(document: Document, contentId: string, editionId?: string) {
  return elements(document, "row").filter((row) => {
    const metadata = elements(row, "c").find((cell) => cell.getAttribute("r") === `${metadataColumn}${row.getAttribute("r")}`);
    const raw = metadata?.textContent;
    if (!raw?.startsWith("{")) return false;
    const entries: TemplateEntry[] = JSON.parse(raw).entries;
    return entries.some((entry) => entry.contentId === contentId && (editionId === undefined || entry.editionId === editionId));
  });
}

it.effect("exports painter First Run and Encore releases together with the correct release and scale checkboxes", () =>
  Effect.gen(function* () {
    const bytes = yield* writeWorkbook([], reviewEntries(data));
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.load(bytes.buffer));
    for (const id of ["death-high-life-model-simone", "death-high-portraitist-snow", "grand-manner-portrait-simon"]) {
      const rows = productRows(workbook, id);
      assert.equal(rows.length, 1, id);
      const row = rows[0];
      assert.equal(row.getCell("B").text, `${data.content[id].name} (Painter's Scale)`);
      assert.equal(row.getCell("H").text, "Photoresin");
      for (const column of ["M", "N"]) assert.equal(row.getCell(column).value, false);
      assert.equal(row.getCell("S").value, true);
      assert.equal(row.getCell("T").value, null);
      const entries = JSON.parse(String(row.getCell(metadataColumn).value)).entries;
      assert.deepEqual(
        entries.map((entry: { editionId: string; column: string }) => [entry.editionId, entry.column]),
        [
          ["painters-first-run", "M"],
          ["painters-encore", "N"],
        ],
      );
    }
  }),
);

it.effect("keeps material variants in Materials Released without repeating the material in Model", () =>
  Effect.gen(function* () {
    const bytes = yield* writeWorkbook([], reviewEntries(data));
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.load(bytes.buffer));
    const rows = productRows(workbook, "questing-aya");
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.getCell("B").text),
      ["Questing Aya", "Questing Aya"],
    );
    assert.deepEqual(
      rows.map((row) => row.getCell("H").text),
      ["Photoresin", "Deathgrey"],
    );
    const titles: string[] = [];
    workbook.getWorksheet("KDM Miniatures")!.eachRow((row) => titles.push(row.getCell("B").text));
    assert.ok(
      titles.every((title) => !/\(Box\)/iu.test(title)),
      "Box belongs in the edition, not the worksheet model title",
    );
    assert.ok(titles.some((title) => /\(M2\)$/u.test(title)));
    assert.ok(titles.every((title) => !/Deathgrey M2 Edition/iu.test(title)));
    assert.ok(titles.includes("Experiment of Death (Wet Nurse & Pinup Twilight Knight)"));
    assert.ok(titles.every((title) => !/\(PVC Wet Nurse/iu.test(title)));
    for (const [id, editionId, expected] of [
      ["sci-fi-dwelling-keeper", "painters", "Photoresin"],
      ["philosophies-of-death-gatherism", "box", "Plastic"],
    ]) {
      const row = productRows(workbook, id).find((row) =>
        JSON.parse(String(row.getCell(metadataColumn).value)).entries.some((entry: { editionId: string }) => entry.editionId === editionId),
      );
      assert.ok(row);
      assert.equal(row.getCell("H").text, expected, `${id}/${editionId}`);
    }
  }),
);

it.effect("uses First Run checkboxes for Deathgrey releases while preserving Encore and ownership round trips", () =>
  Effect.gen(function* () {
    const snapshot = {
      [collectionKey("questing-aya", "first-run")]: { owned: true, copyNumber: 12 },
      [collectionKey("questing-aya", "encore")]: { wished: true },
      [collectionKey("questing-aya", "deathgrey")]: { owned: true, copyNumber: 7 },
      [collectionKey("sci-fi-erza", "deathgrey-m2")]: { owned: true, copyNumber: 13 },
      [collectionKey("sun-claws-esther", "encore")]: { owned: true },
    };
    const collection = new Collection(data);
    yield* collection.setStore(makeStore(snapshot));
    const bytes = yield* writeWorkbook(yield* collection.exportWorkbook(), reviewEntries(data));
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.load(bytes.buffer));
    workbook.getWorksheet("KDM Miniatures")!.eachRow((row) => {
      const raw = row.getCell(metadataColumn).value;
      if (typeof raw !== "string" || !raw.startsWith("{")) return;
      for (const entry of JSON.parse(raw).entries as TemplateEntry[]) {
        if (!/(?:^|: )Deathgrey(?: M2)?$/u.test(entry.label)) continue;
        assert.equal(entry.column, "M", `${entry.contentId}/${entry.editionId}`);
        assert.equal(typeof row.getCell("M").value, "boolean");
        assert.equal(row.getCell("M").value, entry.state.owned === true);
      }
    });
    const aya = productRows(workbook, "questing-aya");
    assert.equal(aya.length, 2, "Photoresin First Run and Encore stay paired separately from Deathgrey");
    const grey = aya.find((row) => row.getCell("H").text === "Deathgrey")!;
    assert.equal(grey.getCell("O").value, null, "Deathgrey has no unused General checkbox");
    assert.ok(productRows(workbook, "sci-fi-erza").some((row) => /\(M2\)$/u.test(row.getCell("B").text)));
    const encore = productRows(workbook, "sun-claws-esther").find((row) =>
      JSON.parse(String(row.getCell(metadataColumn).value)).entries.some((entry: TemplateEntry) => entry.editionId === "encore"),
    )!;
    assert.equal(encore.getCell("N").value, true, "Deathgrey material does not turn an Encore into First Run");

    const target = new Collection(data);
    const store = makeStore();
    yield* target.setStore(store);
    yield* target.importWorkbook(resolveDrafts(yield* readWorkbook(file(bytes))));
    assert.deepEqual(store.state, snapshot);
    const edited = editWorkbook(bytes, (worksheet) => {
      for (const row of xmlProductRows(worksheet("KDM Miniatures"), "questing-aya", "deathgrey")) setCell(row, "M", false);
    });
    yield* target.importWorkbook(resolveDrafts(yield* readWorkbook(file(edited))));
    assert.deepEqual(store.state[collectionKey("questing-aya", "deathgrey")], { copyNumber: 7 });
    assert.deepEqual(store.state[collectionKey("questing-aya", "first-run")], snapshot[collectionKey("questing-aya", "first-run")]);
  }),
);

it.effect("reattaches identical model titles by material after Excel sorts only the visible table", () =>
  Effect.gen(function* () {
    const id = "questing-aya";
    const snapshot = {
      [collectionKey(id, "first-run")]: { owned: true, copyNumber: 12 },
      [collectionKey(id, "encore")]: { wished: true },
      [collectionKey(id, "deathgrey")]: { owned: true, missing: true, copyNumber: 7 },
    };
    const collection = new Collection(data);
    yield* collection.setStore(makeStore(snapshot));
    const bytes = yield* writeWorkbook(yield* collection.exportWorkbook(), reviewEntries(data));
    const edited = editWorkbook(bytes, (worksheet) => {
      const document = worksheet("KDM Miniatures");
      const rows = xmlProductRows(document, id);
      assert.equal(rows.length, 2);
      const visible = rows.map((row) =>
        elements(row, "c").filter((cell) => columnIndex((cell.getAttribute("r") ?? "").replace(/\d+/gu, "")) <= 34),
      );
      for (const [index, row] of rows.entries()) {
        for (const cell of visible[index]) row.removeChild(cell);
        const following = elements(row, "c")[0] ?? null;
        for (const cell of visible[1 - index]) row.insertBefore(cell.cloneNode(true), following);
        for (const cell of elements(row, "c")) {
          const column = (cell.getAttribute("r") ?? "").replace(/\d+/gu, "");
          cell.setAttribute("r", `${column}${row.getAttribute("r")}`);
        }
      }
    });
    const drafts = resolveDrafts(yield* readWorkbook(file(edited)));
    assert.ok(drafts);
    const target = new Collection(data);
    const store = makeStore();
    yield* target.setStore(store);
    yield* target.importWorkbook(drafts);
    assert.deepEqual(store.state, snapshot);
  }),
);

it.effect("limits the miniatures tab to physical models and model-containing products, retaining shirts and dice", () =>
  Effect.gen(function* () {
    const bytes = yield* writeWorkbook([], reviewEntries(data));
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.load(bytes.buffer));
    for (const id of [
      "dung-beetle-knight-gameplay",
      "slenderman-gameplay",
      "core-gameplay",
      "core-upgrade",
      "kingdom-death-monster-rulebook",
      "legendary-card-pack",
      "kingdom-death-simulator",
      "black-knight-citadel-board-travel-edition",
      "adversaries-and-allies-bundle",
      "expansion-of-death-vol-1-6",
      "naked-forbidden-bundle",
      "pinups-of-death-collection",
      "satan-pledge",
      "starting-survivor-set",
      "starting-survivor-set-kingdom-death-monster-1-6-and-gamblers-chest",
      "ultimate-starting-survivor-set-finale-edition",
      "vignette-of-death-collection",
    ])
      assert.equal(productRows(workbook, id).length, 0, id);
    for (const id of [
      "core",
      "expansion-gamblers-chest",
      "philosophies-of-death-gatherism",
      "questing-aya",
      "naked-future-bundle",
      "naked-future-2023",
      "naked-future-2024",
      "halloween-trick-or-treat-bag",
      "black-friday-black-grab-bag-of-death",
    ])
      assert.ok(productRows(workbook, id).length, id);
    const native = workbook.getWorksheet("KDM Miniatures")!;
    const byId = new Map(reviewEntries(data).map((item) => [item.id, item]));
    native.eachRow((row) => {
      const raw = row.getCell(metadataColumn).value;
      if (typeof raw !== "string" || !raw.startsWith("{")) return;
      for (const entry of JSON.parse(raw).entries) {
        const item = byId.get(entry.contentId)!;
        const edition = reviewEditions(item).find((edition) => edition.id === entry.editionId)!;
        assert.equal(edition.format, "physical", `${item.id}/${edition.id}`);
      }
    });
    for (const name of ["Shirt Catalog", "Dice Catalog"]) assert.ok(workbook.getWorksheet(name)!.rowCount > 10);
  }),
);

it.effect("shows checked model classifications using catalog data and leaves nonmatching classifications blank", () =>
  Effect.gen(function* () {
    const bytes = yield* writeWorkbook([], reviewEntries(data));
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.load(bytes.buffer));
    const cases = [
      { id: "pinup-lioness", edition: "resin", checked: ["P", "Q"], unchecked: ["S", "T"] },
      { id: "thief-variant", edition: "painters", checked: ["Q", "R", "S"], unchecked: ["T"] },
      { id: "pinup-lioness", edition: "bust-first-run", checked: ["P", "T"], unchecked: ["S"] },
      { id: "hell-dorado-twilight-knight", edition: "metal", checked: ["U"], unchecked: [] },
      { id: "butcher", edition: "plastic", checked: ["W"], unchecked: [] },
      { id: "summer-aya", edition: "first-run", checked: ["V", "X"], unchecked: [] },
      { id: "allison-the-twilight-knight", edition: "box", checked: ["Y"], unchecked: [] },
      { id: "philosophies-of-death-gatherism", edition: "box", checked: ["Y"], unchecked: [] },
      { id: "the-gambler", edition: "plastic", checked: ["Z"], unchecked: [] },
    ];
    for (const sample of cases) {
      const row = productRows(workbook, sample.id).find((row) =>
        JSON.parse(String(row.getCell(metadataColumn).value)).entries.some(
          (entry: { editionId: string }) => entry.editionId === sample.edition,
        ),
      );
      assert.ok(row, `${sample.id}/${sample.edition}`);
      for (const column of sample.checked) assert.equal(row.getCell(column).value, true, `${sample.id}: ${column}`);
      for (const column of sample.unchecked) assert.equal(row.getCell(column).value, null, `${sample.id}: ${column}`);
      for (const column of ["P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"])
        assert.ok(row.getCell(column).value === true || row.getCell(column).value === null, `${sample.id}: ${column}`);
    }
    workbook.getWorksheet("KDM Miniatures")!.eachRow((row) => {
      if (row.number <= 1 || !row.getCell("B").text) return;
      for (const column of ["P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"])
        assert.ok(row.getCell(column).value === true || row.getCell(column).value === null, `${row.number}: ${column}`);
    });
  }),
);

it.effect("fills missing workbook run counts from catalog facts while preserving saved copy numbers", () =>
  Effect.gen(function* () {
    const snapshot = { [collectionKey("grimmory", "first-run")]: { owned: true, copyNumber: 42 } };
    const collection = new Collection(data);
    yield* collection.setStore(makeStore(snapshot));
    const bytes = yield* writeWorkbook(yield* collection.exportWorkbook(), reviewEntries(data));
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.load(bytes.buffer));
    const samples = [
      ["sci-fi-lucy", "painters", "of 300"],
      ["grimmory", "first-run", "42"],
      ["grimmory", "deathgrey", "of 150"],
      ["pinup-screaming-god-armor", "first-run", "of 900"],
      ["pinup-savior-variant", "first-run", "of 100"],
    ];
    for (const [id, editionId, expected] of samples) {
      const row = productRows(workbook, id).find((row) =>
        JSON.parse(String(row.getCell(metadataColumn).value)).entries.some((entry: { editionId: string }) => entry.editionId === editionId),
      );
      assert.ok(row, `${id}/${editionId}`);
      assert.equal(row.getCell("L").text, expected, `${id}/${editionId}`);
    }
    const target = new Collection(data);
    const store = makeStore();
    yield* target.setStore(store);
    yield* target.importWorkbook(resolveDrafts(yield* readWorkbook(file(bytes))));
    assert.deepEqual(store.state, snapshot);
  }),
);

function file(bytes: Uint8Array<ArrayBuffer>) {
  return new File([bytes], "collection.xlsx");
}

function legacy() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("KDM Miniatures");
  sheet.getCell("B1").value = "Model";
  for (const source of mapping.rows.filter((source) => source.sheet === sheet.name)) {
    sheet.getCell(`B${source.row}`).value = source.name;
    sheet.getCell(`A${source.row}`).value = false;
  }
  return { workbook, sheet };
}

const legacyFile = (workbook: ExcelJS.Workbook) =>
  Effect.promise(() => workbook.xlsx.writeBuffer()).pipe(Effect.map((bytes) => file(new Uint8Array(bytes))));

it.effect("exports XLSX bytes and imports the collection in one local save without HTTP", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const store = makeStore({ [key]: { owned: true, copyNumber: 42 } });
    yield* collection.setStore(store);
    const rows = yield* collection.exportWorkbook();
    const bytes = yield* writeWorkbook(rows, reviewEntries(data));
    assert.deepEqual([...bytes.slice(0, 2)], [0x50, 0x4b]);
    const drafts = yield* readWorkbook(file(bytes));
    assert.equal(drafts[0].row.editionId, first.primary.editionId);
    assert.deepEqual(drafts[0].options, []);
    const next = new Collection(data);
    const target = makeStore();
    yield* next.setStore(target);
    const imported = drafts.map((draft) => draft.row);
    yield* next.previewWorkbook(imported, mapping);
    assert.equal(target.writes, 0);
    yield* next.importWorkbook(imported, mapping);
    assert.equal(target.writes, 1);
    assert.deepEqual(target.state, store.state);
  }).pipe(
    Effect.provideService(FetchHttpClient.Fetch, () => {
      throw new Error("Workbook transfers must not fetch");
    }),
  ),
);

it.effect("legacy import ignores unchecked cells, blank cells, and run-size placeholders", () =>
  Effect.gen(function* () {
    const { workbook, sheet } = legacy();
    sheet.getCell(`L${first.row}`).value = "of 500";
    assert.deepEqual(yield* readWorkbook(yield* legacyFile(workbook)), []);
  }),
);

it.effect("accepts material names in material fields while rejecting them in checkbox fields", () =>
  Effect.gen(function* () {
    const { workbook, sheet } = legacy();
    sheet.getCell(`I${first.row}`).value = "Resin";
    const drafts = yield* readWorkbook(yield* legacyFile(workbook));
    assert.equal(drafts[0].row.owned, true);
    sheet.getCell(`I${first.row}`).value = null;
    sheet.getCell(`A${first.row}`).value = "Resin";
    const error = yield* Effect.flip(readWorkbook(yield* legacyFile(workbook)));
    assert.match(error.message, /Invalid checkbox/u);
  }),
);

it.effect("imports copy numbers stored as numbers or text and ignores run-size placeholders", () =>
  Effect.gen(function* () {
    for (const [value, expected] of [
      [0, 0],
      ["0", 0],
      [9999, 9999],
      [731, 731],
      ["731", 731],
      ["of 500", 17],
      ["of ?", 17],
    ] as const) {
      const { workbook, sheet } = legacy();
      sheet.getCell(`A${first.row}`).value = true;
      sheet.getCell(`L${first.row}`).value = value;
      const collection = new Collection(data);
      const store = makeStore({ [key]: { copyNumber: 17 } });
      yield* collection.setStore(store);
      const rows = resolveDrafts(yield* readWorkbook(yield* legacyFile(workbook)));
      yield* collection.importWorkbook(rows, mapping);
      assert.deepEqual(store.state[key], { owned: true, copyNumber: expected });
    }
  }),
);

it.effect("blanking an exported copy-number cell preserves the saved copy number on reimport", () =>
  Effect.gen(function* () {
    const snapshot = { [key]: { owned: true, copyNumber: 731 } };
    const collection = new Collection(data);
    const store = makeStore(snapshot);
    yield* collection.setStore(store);
    const bytes = yield* writeWorkbook(yield* collection.exportWorkbook(), reviewEntries(data));
    const edited = editWorkbook(bytes, (worksheet) => {
      const [row] = xmlProductRows(worksheet("KDM Miniatures"), first.primary.contentId, first.primary.editionId);
      assert.ok(row);
      setCell(row, "L", null);
    });
    const rows = resolveDrafts(yield* readWorkbook(file(edited)));
    yield* collection.importWorkbook(rows);
    assert.deepEqual(store.state, snapshot);
  }),
);

it.effect("legacy ownership, wishes, copy numbers, shirts, and dice use the reviewed row mappings", () =>
  Effect.gen(function* () {
    const { workbook, sheet } = legacy();
    sheet.getCell(`O${first.row}`).value = true;
    const wished = mapping.rows.find((source) => source.sheet === "KDM Miniatures" && source.row !== first.row && !source.releaseEditions)!;
    sheet.getCell(`J${wished.row}`).value = "Resin";
    const numbered = mapping.rows.find((source) => source.releaseEditions?.M?.length === 1)!;
    sheet.getCell(`M${numbered.row}`).value = true;
    sheet.getCell(`L${numbered.row}`).value = "42";
    for (const name of ["Shirt Catalog", "Dice Catalog"] as const) {
      const accessory = workbook.addWorksheet(name);
      accessory.getCell("C2").value = name === "Shirt Catalog" ? "Shirts" : "Death Dice";
      const source = mapping.rows.find((source) => source.sheet === name)!;
      accessory.getCell(`C${source.row}`).value = ` ${source.name} `;
      accessory.getCell(`B${source.row}`).value = true;
    }
    const drafts = yield* readWorkbook(yield* legacyFile(workbook));
    const resolved = drafts.map((draft) => draft.row);
    const patch = yield* previewWorkbookRows(resolved, data, mapping);
    assert.equal(patch[key].owned, true);
    assert.equal(patch[collectionKey(wished.primary.contentId, wished.primary.editionId)].wished, true);
    const target = numbered.releaseEditions!.M![0];
    assert.equal(patch[collectionKey(target.contentId, target.editionId)].copyNumber, 42);
    assert.ok(drafts.some((draft) => draft.row.sheet === "Shirt Catalog"));
    assert.ok(drafts.some((draft) => draft.row.sheet === "Dice Catalog"));
  }),
);

it.effect("ambiguous releases require an explicit edition selection", () =>
  Effect.gen(function* () {
    const { workbook, sheet } = legacy();
    const source = mapping.rows.find((source) => Object.values(source.releaseEditions ?? {}).some((targets) => targets.length > 1))!;
    const column = releaseColumns.find((column) => (source.releaseEditions?.[column]?.length ?? 0) > 1)!;
    sheet.getCell(`${column}${source.row}`).value = true;
    const [draft] = yield* readWorkbook(yield* legacyFile(workbook));
    assert.ok(draft.options.length > 1);
    assert.equal(draft.row.editionId, undefined);
    assert.equal((yield* Effect.flip(previewWorkbookRows([{ ...draft.row, releaseColumn: column }], data, mapping))).reason, "ambiguous");
    const entries = yield* previewWorkbookRows([{ ...draft.row, ...draft.options[0] }], data, mapping);
    assert.ok(Object.values(entries).some((entry) => entry.owned));
  }),
);

it.effect("rejects changed row names, unknown active rows, malformed flags, and invalid numbers before saving", () =>
  Effect.gen(function* () {
    for (const change of [
      (sheet: ExcelJS.Worksheet) => {
        sheet.getCell(`B${first.row}`).value = "Moved product";
        sheet.getCell(`A${first.row}`).value = true;
      },
      (sheet: ExcelJS.Worksheet) => {
        sheet.getCell("A900").value = true;
        sheet.getCell("B900").value = "Unknown";
      },
      (sheet: ExcelJS.Worksheet) => {
        sheet.getCell(`A${first.row}`).value = "maybe";
      },
      (sheet: ExcelJS.Worksheet) => {
        sheet.getCell(`L${first.row}`).value = "3.5";
      },
    ]) {
      const { workbook, sheet } = legacy();
      change(sheet);
      const error = yield* Effect.flip(readWorkbook(yield* legacyFile(workbook)));
      assert.ok(error instanceof TransferError);
      assert.equal(error.reason, "invalid-data");
    }
  }),
);

it.effect("reads cached formula results without evaluating workbook formulas", () =>
  Effect.gen(function* () {
    const { workbook, sheet } = legacy();
    sheet.getCell(`O${first.row}`).value = { formula: "1=1", result: true };
    const [draft] = yield* readWorkbook(yield* legacyFile(workbook));
    assert.equal(draft.row.owned, true);
  }),
);

it.effect("empty exports remain valid importable XLSX files", () =>
  Effect.gen(function* () {
    assert.deepEqual(yield* readWorkbook(file(yield* writeWorkbook([], reviewEntries(data)))), []);
  }),
);

it.effect("preserves the original tabs, styles, drawings, columns, views, and retained model rows", () =>
  Effect.gen(function* () {
    const bytes = yield* writeWorkbook([], reviewEntries(data));
    yield* Effect.promise(async () => {
      await mkdir("temp/browser-verification/workbook", { recursive: true });
      await writeFile("temp/browser-verification/workbook/template-export.xlsx", bytes);
    });
    const original = unzipSync(templateBytes());
    const exported = unzipSync(bytes);
    const modified = new Set([
      "xl/workbook.xml",
      "xl/styles.xml",
      "xl/_rels/workbook.xml.rels",
      "[Content_Types].xml",
      "xl/comments1.xml",
      "xl/drawings/vmlDrawing1.vml",
    ]);
    for (const [name, content] of Object.entries(original)) {
      if (modified.has(name) || /^xl\/worksheets\/sheet\d+\.xml$/u.test(name)) continue;
      assert.deepEqual(exported[name], content, name);
    }
    const originalFormats = elements(elements(parseXml(strFromU8(original["xl/styles.xml"])), "cellXfs")[0], "xf");
    const exportedFormats = elements(elements(parseXml(strFromU8(exported["xl/styles.xml"])), "cellXfs")[0], "xf");
    for (const [index, format] of originalFormats.entries()) assert.equal(exportedFormats[index].toString(), format.toString());
    const originalWorkbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => originalWorkbook.xlsx.load(templateBytes().buffer));
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.load(bytes.buffer));
    assert.deepEqual(
      workbook.worksheets.map((sheet) => sheet.name),
      ["KDM Miniatures", "Shirt Catalog", "Dice Catalog"],
    );
    for (let sheet = 1; sheet <= 3; sheet++) {
      const path = `xl/worksheets/sheet${sheet}.xml`;
      const source = parseXml(strFromU8(original[path]));
      const result = parseXml(strFromU8(exported[path]));
      for (const tag of ["sheetPr", "sheetViews", "sheetFormatPr", "drawing", "conditionalFormatting", "mergeCells"])
        assert.deepEqual(
          elements(result, tag).map((node) => node.toString()),
          elements(source, tag).map((node) => node.toString()),
          tag,
        );
      const sourceColumns = elements(source, "col").map((node) => node.toString());
      assert.deepEqual(
        elements(result, "col")
          .filter((node) => node.getAttribute("max") !== "52")
          .map((node) => node.toString()),
        sourceColumns,
      );
      assert.ok(elements(result, "col").some((node) => node.getAttribute("max") === "52" && node.getAttribute("hidden") === "1"));
      const originalRows = elements(source, "row");
      const exportedRows = new Map(elements(result, "row").map((node) => [node.getAttribute("r"), node]));
      const name = workbook.worksheets[sheet - 1].name;
      const nameColumn = sheet === 1 ? "B" : "C";
      const positions = new Map<string, number[]>();
      const identities = new Map<string, number[]>();
      workbook.worksheets[sheet - 1].eachRow((row, number) => {
        const name = row.getCell(nameColumn).text.trim();
        positions.set(name, [...(positions.get(name) ?? []), number]);
        const raw = row.getCell(metadataColumn).value;
        if (typeof raw === "string" && raw.startsWith("{"))
          for (const entry of JSON.parse(raw).entries) {
            const key = collectionKey(entry.contentId, entry.editionId);
            identities.set(key, [...(identities.get(key) ?? []), number]);
          }
      });
      const moved = new Map<number, number>();
      const used = new Set<number>();
      let previous = 0;
      for (const row of originalRows) {
        const number = Number(row.getAttribute("r"));
        const product = originalWorkbook.getWorksheet(name)!.getRow(number).getCell(nameColumn).text.trim();
        for (const cell of elements(row, "c").filter((cell) => columnIndex((cell.getAttribute("r") ?? "").replace(/\d+/gu, "")) > 34)) {
          const current = elements(exportedRows.get(String(number))!, "c").find(
            (current) => current.getAttribute("r") === cell.getAttribute("r"),
          );
          assert.equal(current?.toString(), cell.toString(), "Hidden dropdown source stays in place");
        }
        const source = mapping.rows.find((source) => source.sheet === name && source.row === number);
        let position = product ? positions.get(product)?.shift() : number;
        if (source) {
          const targets = [source.primary, ...Object.values(source.releaseEditions ?? {}).flat()].filter((entry) =>
            products.accepts(entry.contentId, entry.editionId),
          );
          if (!targets.length) continue;
          const candidates = [
            ...new Set(targets.flatMap((entry) => identities.get(collectionKey(entry.contentId, entry.editionId)) ?? [])),
          ];
          const date = elements(row, "c").find((cell) => cell.getAttribute("r") === `F${number}`);
          const value = date && elements(date, "v")[0]?.textContent;
          const material = originalWorkbook.worksheets[sheet - 1].getRow(number).getCell("H").text;
          position = candidates.find((number) => {
            if (used.has(number)) return false;
            const current = exportedRows.get(String(number))!;
            const date = elements(current, "c").find((cell) => cell.getAttribute("r") === `F${number}`);
            return (
              (date && elements(date, "v")[0]?.textContent) === value &&
              workbook.worksheets[sheet - 1].getRow(number).getCell("H").text === material
            );
          });
        }
        assert.ok(position, `${name}, ${number}: ${product}`);
        used.add(position);
        moved.set(number, position);
        if (product) {
          assert.ok(position > previous, "The original product order is retained");
          previous = position;
        }
        const current = exportedRows.get(String(position));
        assert.ok(current);
        assert.equal(current.getAttribute("ht"), row.getAttribute("ht"));
        for (const originalCell of elements(row, "c")) {
          const column = (originalCell.getAttribute("r") ?? "").replace(/\d+/gu, "");
          if (columnIndex(column) > 34) continue;
          const cellRow: Element = current;
          const cell: Element | undefined = elements(cellRow, "c").find(
            (node) => node.getAttribute("r") === `${column}${cellRow.getAttribute("r")}`,
          );
          assert.ok(cell, `${name}, ${column}${position}`);
          const style = Number(cell.getAttribute("s"));
          const originalStyle = Number(originalCell.getAttribute("s"));
          if (style !== originalStyle) {
            assert.equal(
              cell.getAttribute("t"),
              "b",
              `${name} ${column}${number} -> ${position}, ${product}, styles ${originalStyle}/${style}`,
            );
            const format = parseXml(exportedFormats[style].toString());
            for (const extension of elements(format, "extLst")) extension.parentNode?.removeChild(extension);
            assert.equal(format.documentElement?.toString(), originalFormats[originalStyle].toString());
          }
        }
      }
      if (sheet === 1) {
        const originalComments = elements(parseXml(strFromU8(original["xl/comments1.xml"])), "comment");
        const comments = elements(parseXml(strFromU8(exported["xl/comments1.xml"])), "comment");
        const notes = parseXml(strFromU8(exported["xl/drawings/vmlDrawing1.vml"]));
        const anchors = Array.from(notes.getElementsByTagNameNS("urn:schemas-microsoft-com:office:excel", "Row"));
        for (const comment of originalComments) {
          const oldRow = Number(comment.getAttribute("ref")?.replace(/\D/gu, ""));
          const newRow = moved.get(oldRow);
          const retained = comments.find((current) => current.textContent === comment.textContent);
          if (newRow === undefined) {
            assert.equal(retained, undefined, "Notes for excluded products are removed with their rows");
            continue;
          }
          assert.ok(retained);
          assert.equal(retained.getAttribute("ref"), comment.getAttribute("ref")?.replace(/\d+$/u, String(newRow)));
          assert.equal(Number(anchors[comments.indexOf(retained)].textContent), newRow - 1);
        }
      }
    }
  }),
);

it.effect("adds every model, shirt, and dice edition to the correct tab even when it is not owned", () =>
  Effect.gen(function* () {
    const bytes = yield* writeWorkbook([], reviewEntries(data));
    const workbook = new ExcelJS.Workbook();
    yield* Effect.promise(() => workbook.xlsx.load(bytes.buffer));
    const identities = new Map<string, string>();
    const pairs = new Set<string>();
    for (const sheet of workbook.worksheets) {
      assert.equal(sheet.getCell(`${metadataColumn}1`).value, templateMarker);
      sheet.eachRow((row, number) => {
        const raw = row.getCell(metadataColumn).value;
        if (number < 2 || typeof raw !== "string") return;
        const metadata = JSON.parse(raw);
        for (const entry of metadata.entries) identities.set(collectionKey(entry.contentId, entry.editionId), sheet.name);
        for (const first of metadata.entries.filter((entry: { column?: string }) => entry.column === "M"))
          for (const encore of metadata.entries.filter((entry: { column?: string }) => entry.column === "N"))
            if (first.contentId === encore.contentId) pairs.add(JSON.stringify([first.contentId, first.editionId, encore.editionId]));
      });
    }
    for (const item of reviewEntries(data)) {
      if (item.category === "homebrew") continue;
      let sheet = "KDM Miniatures";
      if (item.accessoryType === "shirt") sheet = "Shirt Catalog";
      else if (item.accessoryType === "dice") sheet = "Dice Catalog";
      for (const edition of reviewEditions(item))
        assert.equal(
          identities.get(collectionKey(item.id, edition.id)),
          products.accepts(item.id, edition.id) ? sheet : undefined,
          `${item.id}/${edition.id}`,
        );
      const first = item.editions?.find((edition) => edition.label === "First Run");
      const encore = item.editions?.find((edition) => edition.label === "Encore");
      if (
        first &&
        encore &&
        products.accepts(item.id, first.id) &&
        first.format === encore.format &&
        JSON.stringify(first.materials) === JSON.stringify(encore.materials)
      ) {
        assert.ok(pairs.has(JSON.stringify([item.id, first.id, encore.id])), `${item.id} has no combined First Run and Encore row`);
      }
    }
    assert.deepEqual(yield* readWorkbook(file(bytes)), []);
  }),
);

it.effect("imports edits to added shirts, dice, and content without losing independent saved edition fields", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const core = collectionKey("core", "1-6");
    yield* collection.setStore(makeStore({ [core]: { owned: true, missing: true, copyNumber: 42 } }));
    const bytes = yield* writeWorkbook(yield* collection.exportWorkbook(), reviewEntries(data));
    const changes = [
      { sheet: "KDM Miniatures", id: "core", edition: "1-6", column: "A", value: false },
      { sheet: "Shirt Catalog", id: "shirt-honeycomb-weaver", edition: "item", column: "B", value: true },
      { sheet: "Dice Catalog", id: "dice-parasite-queen", edition: "item", column: "B", value: true },
    ] as const;
    const edited = editWorkbook(bytes, (worksheet) => {
      for (const change of changes) {
        const [row] = xmlProductRows(worksheet(change.sheet), change.id, change.edition);
        assert.ok(row);
        setCell(row, change.column, change.value);
      }
    });
    const drafts = yield* readWorkbook(file(edited));
    const rows = resolveDrafts(drafts);
    assert.ok(rows);
    const target = new Collection(data);
    const store = makeStore();
    yield* target.setStore(store);
    yield* target.importWorkbook(rows);
    assert.deepEqual(store.state[core], { copyNumber: 42 });
    assert.equal(store.state[collectionKey("shirt-honeycomb-weaver", "item")].owned, true);
    assert.equal(store.state[collectionKey("dice-parasite-queen", "item")].owned, true);
  }),
);

it.effect("keeps stable product identities when Excel sorts the visible table without moving the hidden metadata", () =>
  Effect.gen(function* () {
    const collection = new Collection(data);
    const second = mapping.rows.find(
      (row) =>
        row.sheet === first.sheet &&
        row.primary.contentId !== first.primary.contentId &&
        products.accepts(row.primary.contentId, row.primary.editionId),
    )!;
    const other = collectionKey(second.primary.contentId, second.primary.editionId);
    const snapshot = { [key]: { owned: true }, [other]: { wished: true } };
    yield* collection.setStore(makeStore(snapshot));
    const bytes = yield* writeWorkbook(yield* collection.exportWorkbook(), reviewEntries(data));
    const edited = editWorkbook(bytes, (worksheet) => {
      const document = worksheet("KDM Miniatures");
      const [firstRow] = xmlProductRows(document, first.primary.contentId, first.primary.editionId);
      const [secondRow] = xmlProductRows(document, second.primary.contentId, second.primary.editionId);
      assert.ok(firstRow);
      assert.ok(secondRow);
      const firstCells = elements(firstRow, "c").filter((cell) => !cell.getAttribute("r")?.startsWith(metadataColumn));
      const secondCells = elements(secondRow, "c").filter((cell) => !cell.getAttribute("r")?.startsWith(metadataColumn));
      for (const [target, cells] of [
        [firstRow, secondCells],
        [secondRow, firstCells],
      ] as const) {
        for (const cell of elements(target, "c").filter((cell) => !cell.getAttribute("r")?.startsWith(metadataColumn)))
          target.removeChild(cell);
        for (const cell of cells) {
          const clone = cell.cloneNode(true);
          const metadata = elements(target, "c").find((cell) => cell.getAttribute("r")?.startsWith(metadataColumn));
          target.insertBefore(clone, metadata ?? null);
        }
        for (const cell of elements(target, "c")) {
          const column = (cell.getAttribute("r") ?? "").replace(/\d+/gu, "");
          cell.setAttribute("r", `${column}${target.getAttribute("r")}`);
        }
      }
    });
    const drafts = yield* readWorkbook(file(edited));
    const resolved = resolveDrafts(drafts);
    const target = new Collection(data);
    const store = makeStore();
    yield* target.setStore(store);
    yield* target.importWorkbook(resolved);
    assert.deepEqual(store.state, snapshot);
  }),
);

it.effect("file reads are deferred, report failures, and can be interrupted before parsing", () =>
  Effect.gen(function* () {
    const started = yield* Deferred.make<void>();
    const pending = Promise.withResolvers<ArrayBuffer>();
    const arrayBuffer = vi.fn(() => {
      Effect.runSync(Deferred.succeed(started, undefined));
      return pending.promise;
    });
    const read = readWorkbook({ size: 1, arrayBuffer });
    assert.equal(arrayBuffer.mock.calls.length, 0);
    const active = yield* Effect.forkChild(read);
    yield* Deferred.await(started);
    yield* Fiber.interrupt(active);
    const result = yield* Fiber.await(active);
    assert.ok(Exit.isFailure(result) && Cause.hasInterrupts(result.cause));
    pending.reject(new Error("Read failed after cancellation"));
    const error = yield* Effect.flip(readWorkbook({ size: 1, arrayBuffer: () => Promise.reject(new Error("Read failed")) }));
    assert.match(error.message, /could not be read/u);
    const malformed = yield* Effect.flip(readWorkbook(file(new Uint8Array([1, 2, 3]))));
    assert.match(malformed.message, /could not be opened/u);
  }),
);

for (const fails of [false, true]) {
  it.effect(`a file read completing after an owner switch cannot import or report its ${fails ? "failure" : "success"}`, () =>
    Effect.gen(function* () {
      const collection = new Collection(data);
      collection.setUser("first");
      const firstStore = makeStore();
      yield* collection.setStore(firstStore);
      const started = yield* Deferred.make<void>();
      const pending = Promise.withResolvers<ArrayBuffer>();
      const active = yield* Effect.forkChild(
        collection
          .forSession(
            readWorkbook({
              size: 1,
              arrayBuffer: () => {
                Effect.runSync(Deferred.succeed(started, undefined));
                return pending.promise;
              },
            }),
          )
          .pipe(
            Effect.flatMap((drafts) =>
              collection.importWorkbook(
                drafts.map((draft) => draft.row),
                mapping,
              ),
            ),
            Effect.exit,
          ),
      );
      yield* Deferred.await(started);
      collection.setUser("second");
      const secondStore = makeStore();
      yield* collection.setStore(secondStore);
      if (fails) pending.reject(new Error("Superseded read"));
      else
        pending.resolve(
          (yield* writeWorkbook(
            [
              {
                sheet: "Guidepost collection",
                row: 3,
                name: first.name,
                contentId: first.primary.contentId,
                editionId: first.primary.editionId,
                owned: true,
              },
            ],
            reviewEntries(data),
          )).buffer,
        );
      const result = yield* Fiber.join(active);
      assert.ok(Exit.isFailure(result) && Cause.hasInterrupts(result.cause));
      assert.equal(firstStore.writes, 0);
      assert.equal(secondStore.writes, 0);
    }),
  );
}

it.effect("exports the core 1.6 edition selected in the app without a missing workbook mapping", () =>
  Effect.gen(function* () {
    const core = collectionKey("core", "1-6");
    const collection = new Collection(data);
    yield* collection.setStore(makeStore({ [core]: { owned: true } }));
    const rows = yield* collection.exportWorkbook();
    const bytes = yield* writeWorkbook(rows, reviewEntries(data));
    const drafts = yield* readWorkbook(file(bytes));
    const imported = yield* previewWorkbookRows(
      drafts.map((draft) => draft.row),
      data,
      mapping,
    );
    assert.equal(imported[core].owned, true);
  }),
);

it.effect("model workbook exports round trip selected model and accessory editions without changing excluded local entries", () =>
  Effect.gen(function* () {
    let index = 0;
    const snapshot = Object.fromEntries(
      reviewEntries(data).flatMap((item) =>
        reviewEditions(item).map((edition) => {
          const state = index++ % 3;
          return [
            collectionKey(item.id, edition.id),
            {
              ...(state === 0 ? { owned: true } : {}),
              ...(state === 1 ? { wished: true } : {}),
              ...(state === 2 ? { missing: true } : {}),
              ...(edition.numbered ? { copyNumber: 1 } : {}),
            },
          ];
        }),
      ),
    );
    const collection = new Collection(data);
    yield* collection.setStore(makeStore(snapshot));
    const rows = yield* collection.exportWorkbook();
    const drafts = yield* readWorkbook(file(yield* writeWorkbook(rows, reviewEntries(data))));
    const target = new Collection(data);
    const store = makeStore();
    yield* target.setStore(store);
    yield* target.importWorkbook(drafts.map((draft) => draft.row));
    assert.equal(store.writes, 1);
    const expected = Object.fromEntries(
      reviewEntries(data)
        .filter((item) => item.category !== "homebrew")
        .flatMap((item) =>
          products.editions(item).map((edition) => {
            const key = collectionKey(item.id, edition.id);
            return [key, snapshot[key]];
          }),
        ),
    );
    assert.deepEqual(store.state, expected);
    assert.deepEqual(yield* collection.exportWorkbook(), rows);
  }).pipe(
    Effect.provideService(FetchHttpClient.Fetch, () => {
      throw new Error("Native workbook transfers must not fetch");
    }),
  ),
);

it.effect("native rows reject unknown editions and duplicate identities and retain explicit false flags", () =>
  Effect.gen(function* () {
    const row = {
      sheet: "Guidepost collection",
      row: 3,
      name: "Core",
      contentId: "core",
      editionId: "1-6",
      owned: false,
      wished: false,
      missing: false,
    };
    const patch = yield* previewWorkbookRows([row], data);
    assert.deepEqual(patch[collectionKey("core", "1-6")], { owned: false, wished: false, missing: false });
    const duplicate = yield* Effect.flip(previewWorkbookRows([row, { ...row, row: 4 }], data));
    assert.match(duplicate.message, /repeats collection edition/u);
    const unknown = yield* Effect.flip(previewWorkbookRows([{ ...row, editionId: "unknown-edition" }], data));
    assert.equal(unknown.reason, "unknown-reference");
  }),
);

it.effect("continues reading Guidepost v1 workbooks with the original row identities", () =>
  Effect.gen(function* () {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Guidepost collection");
    sheet.addRow(["Guidepost collection v1"]);
    sheet.addRow(["Sheet", "Row", "Name", "Release column", "Edition ID", "Owned", "Wanted", "Copy number"]);
    sheet.addRow([first.sheet, first.row, first.name, null, first.primary.editionId, true, false, 42]);
    const drafts = yield* readWorkbook(yield* legacyFile(workbook));
    const patch = yield* previewWorkbookRows(
      drafts.map((draft) => draft.row),
      data,
      mapping,
    );
    assert.deepEqual(patch[key], { owned: true, wished: false, copyNumber: 42 });
    sheet.getCell("H3").value = "of 500";
    const error = yield* Effect.flip(readWorkbook(yield* legacyFile(workbook)));
    assert.match(error.message, /Invalid copy number/u);
  }),
);

const example = "local-data/kdm-catalog/imports/KDM Collection Sheets.xlsx";
if (existsSync(example)) {
  it.effect("reads the retained original workbook without treating template placeholders as collection data", () =>
    Effect.gen(function* () {
      const bytes = yield* Effect.promise(() => readFile(example));
      const drafts = yield* readWorkbook(file(new Uint8Array(bytes)));
      yield* previewWorkbookRows(
        drafts.map((draft) => draft.row),
        data,
        mapping,
      );
      assert.ok(drafts.every((draft) => draft.row.copyNumber === undefined || typeof draft.row.copyNumber === "number"));
    }),
  );
}
