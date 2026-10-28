import { readFile, writeFile } from "node:fs/promises";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { elements, parseXml, serializeXml, setCell } from "#lib/kdm/collection/workbook/xml.ts";
import { decodeWorkbookMap, sheets } from "#lib/types/workbook.ts";

// A local-only source, never fetched. Keep product information and workbook features, removing personal collection cells.
const source = "local-data/kdm-catalog/imports/KDM Collection Sheets.xlsx";
const destination = "src/lib/kdm/collection/workbook/template.xlsx";
const archive = unzipSync(await readFile(source));
const mapping = decodeWorkbookMap(JSON.parse(await readFile("static/kdm/catalog/workbook-map.json", "utf8")));
const sharedDocument = parseXml(strFromU8(archive["xl/sharedStrings.xml"]));
const shared = elements(sharedDocument, "si");
for (let sheet = 1; sheet <= sheets.length; sheet++) {
  const path = `xl/worksheets/sheet${sheet}.xml`;
  const document = parseXml(strFromU8(archive[path]));
  const name = sheets[sheet - 1];
  const mapped = new Map(mapping.rows.filter((row) => row.sheet === name).map((row) => [row.row, row]));
  for (const row of elements(document, "row")) {
    const number = Number(row.getAttribute("r"));
    if (number <= (sheet === 1 ? 1 : 2)) continue;
    const expected = mapped.get(number);
    if (expected) {
      const model = elements(row, "c").find((cell) => cell.getAttribute("r") === `${sheet === 1 ? "B" : "C"}${number}`);
      const index = Number(model && elements(model, "v")[0]?.textContent);
      const actual = shared[index]?.textContent?.trim().replace(/\s+/gu, " ");
      if (actual !== expected.name)
        throw new Error(`Workbook identity changed at ${name}, ${number}. Review the mapping before generating a template.`);
    }
    if (sheet === 1) {
      for (const column of ["I", "J", "AG"]) setCell(row, column, null);
      if (expected) setCell(row, "A", false);
      const serial = elements(row, "c").find((cell) => cell.getAttribute("r") === `L${number}`);
      if (serial && serial.getAttribute("t") !== "s") setCell(row, "L", null);
      for (const cell of elements(row, "c")) {
        if (cell.getAttribute("t") === "b") setCell(row, (cell.getAttribute("r") ?? "").replace(/\d+/gu, ""), false);
      }
    } else {
      const owned = elements(row, "c").find((cell) => cell.getAttribute("r") === `B${number}`);
      if (expected || owned?.getAttribute("t") === "b") setCell(row, "B", false);
      if (sheet === 2) setCell(row, "D", null);
    }
  }
  archive[path] = strToU8(serializeXml(document));
}
// Remove orphaned shared strings too: clearing a cell must not retain its personal value elsewhere in the package.
const documents = sheets.map((_name, index) => parseXml(strFromU8(archive[`xl/worksheets/sheet${index + 1}.xml`])));
const references = documents.flatMap((document) => elements(document, "c").filter((cell) => cell.getAttribute("t") === "s"));
const indices = [...new Set(references.map((cell) => Number(elements(cell, "v")[0]?.textContent)))].sort((a, b) => a - b);
const renumbered = new Map(indices.map((old, index) => [old, index]));
for (const node of shared) node.parentNode?.removeChild(node);
for (const index of indices) sharedDocument.documentElement?.appendChild(shared[index]);
for (const cell of references) {
  const value = elements(cell, "v")[0];
  value.textContent = String(renumbered.get(Number(value.textContent)));
}
sharedDocument.documentElement?.setAttribute("count", String(references.length));
sharedDocument.documentElement?.setAttribute("uniqueCount", String(indices.length));
archive["xl/sharedStrings.xml"] = strToU8(serializeXml(sharedDocument));
for (const [index, document] of documents.entries()) archive[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(serializeXml(document));
// Source annotations are product notes. Remove contributor identities while retaining their text and appearance.
for (const [path, bytes] of Object.entries(archive)) {
  if (!/comments\d+\.xml$/u.test(path)) continue;
  const document = parseXml(strFromU8(bytes));
  for (const author of elements(document, "author")) author.textContent = "Workbook contributor";
  archive[path] = strToU8(serializeXml(document));
}
if (archive["xl/persons/person.xml"]) {
  const document = parseXml(strFromU8(archive["xl/persons/person.xml"]));
  for (const person of Array.from(document.getElementsByTagName("person"))) {
    for (const attribute of ["displayName", "userId", "providerId"])
      if (person.hasAttribute(attribute)) person.setAttribute(attribute, "Workbook contributor");
  }
  archive["xl/persons/person.xml"] = strToU8(serializeXml(document));
}
await writeFile(destination, zipSync(archive, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") }));
console.log(`Wrote sanitized workbook template to ${destination}.`);
