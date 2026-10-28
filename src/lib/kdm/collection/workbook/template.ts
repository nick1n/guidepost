import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Element } from "@xmldom/xmldom";
import templateUrl from "./template.xlsx?url&inline";
import {
  sheets,
  releaseColumns,
  metadataColumn,
  templateMarker,
  type WorkbookMap,
  type CollectionWorkbookRow,
  type TemplateEntry,
  type Metadata,
} from "#lib/types/workbook.ts";
import { reviewEditions, reviewPrice, type CatalogEntry } from "#lib/catalog-view.ts";
import { editionGameplay } from "#lib/kdm-data.ts";
import { cloneRow, columnIndex, elements, parseXml, renumberRow, serializeXml, setCell, spreadsheetNamespace } from "./xml.ts";
import { addCheckboxes } from "./checkboxes.ts";
import { workbookProducts } from "./products.ts";

export function templateBytes() {
  const base64 = templateUrl.slice(templateUrl.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

function cellValue(row: Element, column: string, shared: string[]) {
  const cell = elements(row, "c").find((cell) => cell.getAttribute("r") === `${column}${row.getAttribute("r")}`);
  if (!cell) return null;
  const value = elements(cell, "v")[0]?.textContent ?? "";
  if (cell.getAttribute("t") === "s") return shared[Number(value)] ?? "";
  if (cell.getAttribute("t") === "inlineStr")
    return elements(cell, "t")
      .map((node) => node.textContent)
      .join("");
  if (cell.getAttribute("t") === "b") return value === "1";
  return value === "" ? null : Number(value);
}

export function writeTemplate(input: readonly CollectionWorkbookRow[], mapping: WorkbookMap, items: readonly CatalogEntry[]) {
  const archive = unzipSync(templateBytes());
  const shared = elements(parseXml(strFromU8(archive["xl/sharedStrings.xml"])), "si").map((node) =>
    elements(node, "t")
      .map((text) => text.textContent)
      .join(""),
  );
  const byId = new Map(items.map((item) => [item.id, item]));
  const products = workbookProducts(items, mapping);
  const documents = sheets.map((name, index) => {
    const path = `xl/worksheets/sheet${index + 1}.xml`;
    const document = parseXml(strFromU8(archive[path]));
    const data = elements(document, "sheetData")[0];
    const rows = new Map(elements(document, "row").map((row) => [Number(row.getAttribute("r")), row]));
    return { name, path, document, data, rows };
  });
  const plans = products.planRows(
    input,
    documents.map(({ name, rows }) => ({
      name,
      rows: [...rows].map(([number, row]) => ({
        row: number,
        name: normalizeName(String(cellValue(row, name === "KDM Miniatures" ? "B" : "C", shared) ?? "")),
        material: cellValue(row, "H", shared),
      })),
    })),
  );
  const lastRows = new Map<string, number>();
  for (const [index, { name, path, document, data, rows }] of documents.entries()) {
    const plan = plans[index];
    const miniature = name === "KDM Miniatures";
    const first = rows.get(miniature ? 2 : 3);
    if (!first) throw new Error(`The ${name} template has no styled product row.`);
    const helpers = new Map<number, Element[]>();
    const removed = plan.removed;
    if (miniature)
      for (const [number, row] of rows) {
        if (number === 1) continue;
        const cells = elements(row, "c").filter((cell) => {
          const column = (cell.getAttribute("r") ?? "").replace(/\d+/gu, "");
          return columnIndex(column) > 34 && column !== metadataColumn;
        });
        helpers.set(number, cells);
        for (const cell of cells) row.removeChild(cell);
      }
    const finish = (row: Element, entries: TemplateEntry[]) => {
      const name = normalizeName(String(cellValue(row, miniature ? "B" : "C", shared) ?? ""));
      const baseline: Record<string, string | number | boolean | null> = {};
      const put = (column: string, value: string | number | boolean | null) => {
        setCell(row, column, value);
        baseline[column] = value;
      };
      put(
        miniature ? "A" : "B",
        entries.some((entry) => entry.state.owned),
      );
      if (miniature) {
        baseline.H = normalizeName(String(cellValue(row, "H", shared) ?? "")) || null;
        for (const [column, checked] of Object.entries(products.classifications(entries))) setCell(row, column, checked ? true : null);
        put(
          "I",
          [...new Set(entries.filter((entry) => entry.state.owned).map((entry) => entry.material || entry.label))].join(", ") || null,
        );
        put(
          "J",
          [...new Set(entries.filter((entry) => entry.state.wished).map((entry) => entry.material || entry.label))].join(", ") || null,
        );
        const numbered = entries.find((entry) => entry.column === "M") ?? entries[0];
        const item = numbered && byId.get(numbered.contentId);
        const edition = item && reviewEditions(item).find((edition) => edition.id === numbered.editionId);
        const previous = cellValue(row, "L", shared);
        const unknown = previous === null || previous === "" || (typeof previous === "string" && /^of\s+\?$/iu.test(previous));
        const serial = numbered?.state.copyNumber ?? (unknown && edition?.runSize ? `of ${edition.runSize}` : previous);
        put("L", serial);
        for (const column of releaseColumns) {
          const existing = elements(row, "c").find((cell) => cell.getAttribute("r") === `${column}${row.getAttribute("r")}`);
          if (existing?.getAttribute("t") === "b" || entries.some((entry) => entry.column === column))
            put(
              column,
              entries.some((entry) => entry.column === column && entry.state.owned),
            );
        }
      }
      setCell(row, metadataColumn, JSON.stringify({ name, entries, baseline } satisfies Metadata));
    };
    for (const number of removed) data.removeChild(rows.get(number)!);
    for (const [number, product] of plan.rows) {
      const row = rows.get(number)!;
      if (miniature) setCell(row, "B", product.name);
      finish(row, product.entries);
    }
    if (miniature)
      for (const [number, row] of rows) {
        if (number <= 1 || removed.has(number) || plan.rows.has(number)) continue;
        for (const [column, checked] of Object.entries(products.classifications([]))) setCell(row, column, checked ? true : null);
      }
    let last = Math.max(...rows.keys());
    for (const addition of plan.additions) {
      const row = cloneRow(first, ++last);
      setCell(row, miniature ? "B" : "C", addition.name);
      if (miniature) {
        const item = addition.item;
        const edition = reviewEditions(item).find((edition) => edition.id === addition.entries[0].editionId);
        if (edition) {
          setCell(row, "H", edition.materials?.join(", ") ?? "");
          const date = edition.releaseDate ?? item.releaseDate;
          if (date) {
            const serial = Date.parse(`${date}T00:00:00Z`) / 86400000 + 25569;
            setCell(row, "F", serial);
            setCell(row, "G", serial);
          }
          setCell(row, "AB", item.kind ?? null);
          setCell(row, "AC", editionGameplay(item, edition) ? "Gameplay" : null);
          const price = reviewPrice(item, edition);
          setCell(row, "AE", price === undefined ? null : price / 100);
          if (edition.numbered && edition.runSize) setCell(row, "L", `of ${edition.runSize}`);
        }
      }
      if (miniature) for (const column of releaseColumns) setCell(row, column, null);
      finish(row, addition.entries);
      data.appendChild(row);
    }
    if (miniature) {
      const products = elements(data, "row").filter((row) => Number(row.getAttribute("r")) > 1);
      // The hidden dropdown source lists stay at their original addresses while the visible table moves.
      const release = (row: Element) => {
        const date = cellValue(row, "F", shared);
        return typeof date === "number" ? date : -Infinity;
      };
      products.sort((a, b) => {
        const first = release(a);
        const second = release(b);
        return first === second ? 0 : first > second ? -1 : 1;
      });
      const moved = new Map<number, number>();
      for (const [index, row] of products.entries()) {
        const number = index + 2;
        moved.set(Number(row.getAttribute("r")), number);
        data.removeChild(row);
        renumberRow(row, number);
        const metadata = elements(row, "c").find((cell) => cell.getAttribute("r") === `${metadataColumn}${number}`);
        for (const cell of helpers.get(number) ?? []) row.insertBefore(cell, metadata ?? null);
        data.appendChild(row);
      }
      // Product notes follow their cells when the inserted releases shift the original rows.
      const comments = parseXml(strFromU8(archive["xl/comments1.xml"]));
      for (const comment of elements(comments, "comment")) {
        const reference = comment.getAttribute("ref") ?? "";
        if (removed.has(Number(reference.replace(/\D/gu, "")))) {
          comment.parentNode?.removeChild(comment);
          continue;
        }
        comment.setAttribute(
          "ref",
          reference.replace(/\d+$/u, (row) => String(moved.get(Number(row)) ?? row)),
        );
      }
      archive["xl/comments1.xml"] = strToU8(serializeXml(comments));
      const notes = parseXml(strFromU8(archive["xl/drawings/vmlDrawing1.vml"]));
      const namespace = "urn:schemas-microsoft-com:office:excel";
      for (const note of Array.from(notes.getElementsByTagNameNS(namespace, "ClientData"))) {
        const row = note.getElementsByTagNameNS(namespace, "Row")[0];
        if (!row) continue;
        const original = Number(row.textContent) + 1;
        if (removed.has(original)) {
          const shape = note.parentNode;
          shape?.parentNode?.removeChild(shape);
          continue;
        }
        const delta = (moved.get(original) ?? original) - original;
        row.textContent = String(original + delta - 1);
        const anchor = note.getElementsByTagNameNS(namespace, "Anchor")[0];
        if (anchor) {
          const values = (anchor.textContent ?? "").split(",").map(Number);
          values[2] += delta;
          values[6] += delta;
          anchor.textContent = values.join(", ");
        }
      }
      archive["xl/drawings/vmlDrawing1.vml"] = strToU8(serializeXml(notes));
      last = products.length + 1;
    }
    const header = rows.get(1);
    if (header) setCell(header, metadataColumn, templateMarker);
    const cols = elements(document, "cols")[0];
    if (cols) {
      const column = document.createElementNS(spreadsheetNamespace, "col");
      const lastColumn = Math.max(...elements(cols, "col").map((column) => Number(column.getAttribute("max"))));
      for (const [key, value] of Object.entries({ min: String(lastColumn + 1), max: "52", hidden: "1", width: "0", customWidth: "1" }))
        column.setAttribute(key, value);
      cols.appendChild(column);
    }
    for (const dimension of elements(document, "dimension")) dimension.setAttribute("ref", `A1:AZ${last}`);
    for (const filter of elements(document, "autoFilter")) filter.setAttribute("ref", `A1:AH${last}`);
    for (const sort of elements(document, "sortState")) sort.setAttribute("ref", `A1:AH${last}`);
    for (const condition of elements(document, "sortCondition")) {
      const range = condition.getAttribute("ref");
      if (range) condition.setAttribute("ref", range.replace(/\d+$/u, String(last)));
    }
    for (const validation of elements(document, "dataValidation")) {
      const range = validation.getAttribute("sqref");
      if (range?.match(/^[IJ]2:[IJ]\d+$/u)) validation.setAttribute("sqref", `${range[0]}2:${range[0]}${last}`);
    }
    archive[path] = strToU8(serializeXml(document));
    lastRows.set(name, last);
  }
  const workbook = parseXml(strFromU8(archive["xl/workbook.xml"]));
  for (const name of elements(workbook, "definedName")) {
    if (name.getAttribute("name") === "_xlnm._FilterDatabase")
      name.textContent = `'KDM Miniatures'!$A$1:$AH$${lastRows.get("KDM Miniatures")}`;
  }
  archive["xl/workbook.xml"] = strToU8(serializeXml(workbook));
  addCheckboxes(archive);
  return zipSync(archive, { level: 6 });
}
