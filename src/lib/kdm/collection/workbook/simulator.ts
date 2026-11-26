import { normalizeWhitespace } from "#lib/helpers.ts";
import { strFromU8, strToU8 } from "fflate";
import type { Document, Element } from "@xmldom/xmldom";
import { reviewPrice } from "#lib/catalog-view.ts";
import { editionGameplay } from "#lib/kdm-data.ts";
import { metadataColumn, sheets, simulatorSheet, templateMarker, type Metadata } from "#lib/types/workbook.ts";
import type { workbookProducts } from "./products.ts";
import { elements, parseXml, serializeXml, setCell, spreadsheetNamespace } from "./xml.ts";

const relationshipNamespace = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const columns = [
  { column: "A", title: "Owned", header: "F", body: "A", width: 10 },
  { column: "B", title: "Product", header: "B", body: "B", width: 58 },
  { column: "C", title: "Wanted", header: "F", body: "A", width: 11 },
  { column: "D", title: "Release date", header: "F", body: "F", width: 16 },
  { column: "E", title: "Type", header: "AB", body: "AB", width: 15 },
  { column: "F", title: "Gameplay", header: "F", body: "AC", width: 13 },
  { column: "G", title: "MSRP", header: "AE", body: "AE", width: 12 },
];

type SimulatorRows = ReturnType<ReturnType<typeof workbookProducts>["planRows"]>["simulator"];
type Value = string | number | boolean | null;

function templateStyle(row: Element, column: string) {
  return (
    elements(row, "c")
      .find((cell) => cell.getAttribute("r") === `${column}${row.getAttribute("r")}`)
      ?.getAttribute("s") ?? "0"
  );
}

export function addSimulatorSheet(
  archive: Record<string, Uint8Array>,
  workbook: Document,
  miniatures: Document,
  header: Element,
  body: Element,
  products: SimulatorRows,
) {
  const filter = `A1:${columns.at(-1)!.column}${products.length + 1}`;
  const document = parseXml(
    `<worksheet xmlns="${spreadsheetNamespace}">
      ${elements(miniatures, "sheetPr")[0]}
      <dimension ref="A1:${metadataColumn}${products.length + 1}"/>
      ${elements(miniatures, "sheetViews")[0]}
      ${elements(miniatures, "sheetFormatPr")[0]}
      <cols>${columns.map(({ width }, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}
        <col min="52" max="52" hidden="1" width="0" customWidth="1"/>
      </cols>
      <sheetData/>
      <autoFilter ref="${filter}"/>
    </worksheet>`,
  );
  const data = elements(document, "sheetData")[0];
  const styles = parseXml(strFromU8(archive["xl/styles.xml"]));
  const formats = elements(styles, "cellXfs")[0];
  const numberStyle = (style: string, format: string) => {
    const formatsList = elements(formats, "xf");
    const formatted = formatsList[Number(style)].cloneNode(true) as Element;
    formatted.setAttribute("numFmtId", format);
    formats.appendChild(formatted);
    formats.setAttribute("count", String(formatsList.length + 1));
    return String(formatsList.length);
  };
  const headerStyles = columns.map(({ header: column }) => templateStyle(header, column));
  const bodyStyles = columns.map(({ column, body: source }) => {
    const style = templateStyle(body, source);
    if (column === "D") return numberStyle(style, "14");
    if (column === "G") return numberStyle(style, "4");
    return style;
  });
  archive["xl/styles.xml"] = strToU8(serializeXml(styles));

  const appendRow = (number: number, source: Element, styles: string[], values: Value[], metadata: string) => {
    const row = document.createElementNS(spreadsheetNamespace, "row");
    row.setAttribute("r", String(number));
    row.setAttribute("ht", source.getAttribute("ht") ?? "15.75");
    row.setAttribute("customHeight", "1");
    for (const [index, { column }] of columns.entries()) setCell(row, column, values[index]).setAttribute("s", styles[index]);
    setCell(row, metadataColumn, metadata);
    data.appendChild(row);
  };
  appendRow(
    1,
    header,
    headerStyles,
    columns.map(({ title }) => title),
    templateMarker,
  );
  const ordered = products.toSorted(
    (a, b) =>
      (b.edition.releaseDate ?? b.edition.releaseWindow ?? "").localeCompare(a.edition.releaseDate ?? a.edition.releaseWindow ?? "") ||
      a.name.localeCompare(b.name, "en"),
  );
  for (const [index, { item, edition, name, entry }] of ordered.entries()) {
    const owned = entry.state.owned === true;
    const wanted = entry.state.wished === true;
    const date = edition.releaseDate ? Date.parse(`${edition.releaseDate}T00:00:00Z`) / 86400000 + 25569 : (edition.releaseWindow ?? null);
    const kind = item.kind ?? "bundle";
    const type = kind === "simulator" ? "Access key" : (kind[0].toUpperCase() + kind.slice(1)).replaceAll("-", " ");
    const price = reviewPrice(item, edition);
    const values = [
      owned,
      name,
      wanted,
      date,
      type,
      editionGameplay(item, edition) ? "Gameplay" : null,
      price === undefined ? null : price / 100,
    ];
    const metadata = { name: normalizeWhitespace(name), entries: [entry], baseline: { A: owned, C: wanted } } satisfies Metadata;
    appendRow(index + 2, body, bodyStyles, values, JSON.stringify(metadata));
  }

  const number = sheets.length + 1;
  const target = `worksheets/sheet${number}.xml`;
  const relationshipId = "guidepostSimulator";
  const sheet = workbook.createElementNS(spreadsheetNamespace, "sheet");
  sheet.setAttribute("name", simulatorSheet);
  sheet.setAttribute("sheetId", String(number));
  sheet.setAttributeNS(relationshipNamespace, "r:id", relationshipId);
  elements(workbook, "sheets")[0].appendChild(sheet);

  const relationshipPath = "xl/_rels/workbook.xml.rels";
  const relationships = parseXml(strFromU8(archive[relationshipPath]));
  const relationshipRoot = relationships.documentElement!;
  const relationship = relationships.createElementNS(relationshipRoot.namespaceURI, "Relationship");
  relationship.setAttribute("Id", relationshipId);
  relationship.setAttribute("Type", `${relationshipNamespace}/worksheet`);
  relationship.setAttribute("Target", target);
  relationshipRoot.appendChild(relationship);
  archive[relationshipPath] = strToU8(serializeXml(relationships));

  const typesPath = "[Content_Types].xml";
  const types = parseXml(strFromU8(archive[typesPath]));
  const typeRoot = types.documentElement!;
  const override = types.createElementNS(typeRoot.namespaceURI, "Override");
  override.setAttribute("PartName", `/xl/${target}`);
  override.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml");
  typeRoot.appendChild(override);
  archive[typesPath] = strToU8(serializeXml(types));

  const path = `xl/${target}`;
  archive[path] = strToU8(serializeXml(document));
  return path;
}
