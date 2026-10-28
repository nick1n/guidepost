import { strFromU8, strToU8 } from "fflate";
import { sheets } from "#lib/types/workbook.ts";
import { elements, parseXml, serializeXml, spreadsheetNamespace } from "./xml.ts";

const namespace = "http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag";

// Excel's in-cell controls require both a style extension and the linked feature-property part.
// Boolean cell values alone render as TRUE/FALSE in the template's narrow checkbox columns.
export function addCheckboxes(archive: Record<string, Uint8Array>) {
  const styles = parseXml(strFromU8(archive["xl/styles.xml"]));
  const formats = elements(styles, "cellXfs")[0];
  const original = elements(formats, "xf");
  const controls = new Map<number, number>();
  for (let sheet = 1; sheet <= sheets.length; sheet++) {
    const path = `xl/worksheets/sheet${sheet}.xml`;
    const document = parseXml(strFromU8(archive[path]));
    for (const cell of elements(document, "c").filter((cell) => cell.getAttribute("t") === "b")) {
      const index = Number(cell.getAttribute("s"));
      let checkbox = controls.get(index);
      if (checkbox === undefined) {
        const source = original[index];
        if (!source) throw new Error(`Missing checkbox cell style ${index}.`);
        const format = styles.createElementNS(spreadsheetNamespace, "xf");
        for (const attribute of Array.from(source.attributes)) format.setAttribute(attribute.name, attribute.value);
        for (const node of Array.from(source.childNodes)) format.appendChild(node.cloneNode(true));
        const extensions = styles.createElementNS(spreadsheetNamespace, "extLst");
        const extension = styles.createElementNS(spreadsheetNamespace, "ext");
        extension.setAttribute("uri", "{C7286773-470A-42A8-94C5-96B5CB345126}");
        const complement = styles.createElementNS(namespace, "xfpb:xfComplement");
        complement.setAttribute("i", "0");
        extension.appendChild(complement);
        extensions.appendChild(extension);
        format.appendChild(extensions);
        checkbox = original.length + controls.size;
        formats.appendChild(format);
        controls.set(index, checkbox);
      }
      cell.setAttribute("s", String(checkbox));
    }
    archive[path] = strToU8(serializeXml(document));
  }
  formats.setAttribute("count", String(original.length + controls.size));
  archive["xl/styles.xml"] = strToU8(serializeXml(styles));
  archive["xl/featurePropertyBag/featurePropertyBag.xml"] = strToU8(
    `<FeaturePropertyBags xmlns="${namespace}"><bag type="Checkbox"/><bag type="XFControls"><bagId k="CellControl">0</bagId></bag><bag type="XFComplement"><bagId k="XFControls">1</bagId></bag><bag type="XFComplements" extRef="XFComplementsMapperExtRef"><a k="MappedFeaturePropertyBags"><bagId>2</bagId></a></bag></FeaturePropertyBags>`,
  );
  const relationships = parseXml(strFromU8(archive["xl/_rels/workbook.xml.rels"]));
  const relationshipRoot = relationships.documentElement;
  if (!relationshipRoot) throw new Error("Workbook relationships are missing.");
  const relationship = relationships.createElementNS(relationshipRoot.namespaceURI, "Relationship");
  relationship.setAttribute("Id", "guidepostCheckboxes");
  relationship.setAttribute("Type", "http://schemas.microsoft.com/office/2022/11/relationships/FeaturePropertyBag");
  relationship.setAttribute("Target", "featurePropertyBag/featurePropertyBag.xml");
  relationshipRoot.appendChild(relationship);
  archive["xl/_rels/workbook.xml.rels"] = strToU8(serializeXml(relationships));
  const types = parseXml(strFromU8(archive["[Content_Types].xml"]));
  const typeRoot = types.documentElement;
  if (!typeRoot) throw new Error("Workbook content types are missing.");
  const override = types.createElementNS(typeRoot.namespaceURI, "Override");
  override.setAttribute("PartName", "/xl/featurePropertyBag/featurePropertyBag.xml");
  override.setAttribute("ContentType", "application/vnd.ms-excel.featurepropertybag+xml");
  typeRoot.appendChild(override);
  archive["[Content_Types].xml"] = strToU8(serializeXml(types));
}
