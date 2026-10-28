import { DOMParser, XMLSerializer, type Element, type Document } from "@xmldom/xmldom";

export const spreadsheetNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

export function parseXml(source: string) {
  return new DOMParser({
    onError: (_level, message) => {
      throw new Error(message);
    },
  }).parseFromString(source, "application/xml");
}

export function serializeXml(document: Document) {
  return new XMLSerializer().serializeToString(document);
}

export function elements(parent: Document | Element, name: string) {
  return Array.from(parent.getElementsByTagNameNS(spreadsheetNamespace, name));
}

export function columnIndex(column: string) {
  return [...column].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0);
}

export function renumberRow(row: Element, number: number) {
  row.setAttribute("r", String(number));
  for (const cell of elements(row, "c")) {
    const column = (cell.getAttribute("r") ?? "").replace(/\d+/gu, "");
    cell.setAttribute("r", `${column}${number}`);
  }
}

export function setCell(row: Element, column: string, value: string | number | boolean | null) {
  const document = row.ownerDocument;
  if (!document) throw new Error("Workbook row has no document.");
  const address = `${column}${row.getAttribute("r")}`;
  let cell = elements(row, "c").find((cell) => cell.getAttribute("r") === address);
  if (!cell) {
    cell = document.createElementNS(spreadsheetNamespace, "c");
    cell.setAttribute("r", address);
    const following = elements(row, "c").find(
      (cell) => columnIndex((cell.getAttribute("r") ?? "").replace(/\d+/gu, "")) > columnIndex(column),
    );
    row.insertBefore(cell, following ?? null);
  }
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  cell.removeAttribute("t");
  if (value === null) return cell;
  if (typeof value === "string") {
    cell.setAttribute("t", "inlineStr");
    const inline = document.createElementNS(spreadsheetNamespace, "is");
    const text = document.createElementNS(spreadsheetNamespace, "t");
    if (value !== value.trim()) text.setAttribute("xml:space", "preserve");
    text.appendChild(document.createTextNode(value));
    inline.appendChild(text);
    cell.appendChild(inline);
  } else {
    if (typeof value === "boolean") cell.setAttribute("t", "b");
    const content = document.createElementNS(spreadsheetNamespace, "v");
    content.appendChild(document.createTextNode(typeof value === "boolean" ? String(Number(value)) : String(value)));
    cell.appendChild(content);
  }
  return cell;
}

export function cloneRow(source: Element, number: number) {
  const document = source.ownerDocument;
  if (!document) throw new Error("Workbook row has no document.");
  const row = document.createElementNS(spreadsheetNamespace, "row");
  for (const attribute of Array.from(source.attributes)) row.setAttribute(attribute.name, attribute.value);
  for (const cell of elements(source, "c")) row.appendChild(cell.cloneNode(true));
  renumberRow(row, number);
  for (const cell of elements(row, "c")) {
    const column = (cell.getAttribute("r") ?? "").replace(/\d+/gu, "");
    setCell(row, column, null);
  }
  return row;
}
