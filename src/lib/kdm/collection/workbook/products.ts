import { reviewEditions, reviewHasModels, reviewIndex, type CatalogEntry } from "#lib/catalog-view.ts";
import { collectionKey, normalizeEntry, type EntryState } from "#lib/types/collection.ts";
import type { Catalog, Edition } from "#lib/types/index.ts";
import {
  releaseColumns,
  type CollectionWorkbookRow,
  type ReleaseColumn,
  type TemplateEntry,
  type WorkbookMap,
  type WorkbookSheet,
} from "#lib/types/workbook.ts";

type SourceSheet = {
  name: WorkbookSheet;
  rows: readonly { row: number; name: string; material: string | number | boolean | null }[];
};
type PlannedRow = { name: string; entries: TemplateEntry[] };
type Addition = PlannedRow & { item: CatalogEntry };

export function releaseColumn(label: string): ReleaseColumn {
  if (/(?:^|: )(?:First Run|Deathgrey(?: M2)?)$/u.test(label)) return "M";
  if (/(?:^|: )Encore$/u.test(label)) return "N";
  return "O";
}

function family(label: string) {
  return /^(Painters|Bust|Remaster|Resculpt)(?::|$)/u.test(label) ? label.replace(/: (?:First Run|Encore)$/u, "") : "";
}

export function releasePairs(editions: readonly Edition[]) {
  const pairs: Edition[][] = [];
  for (const prefix of new Set(editions.map((edition) => family(edition.label)))) {
    // Deathgrey uses the First Run column on its own material row, not the Photoresin First Run/Encore pair.
    const first = editions.filter((edition) => family(edition.label) === prefix && /(?:^|: )First Run$/u.test(edition.label));
    const encore = editions.filter((edition) => family(edition.label) === prefix && releaseColumn(edition.label) === "N");
    if (first.length !== 1 || encore.length !== 1) continue;
    const materials = (edition: Edition) => [...(edition.materials ?? [])].sort().join(",");
    if (first[0].format === encore[0].format && materials(first[0]) === materials(encore[0])) pairs.push([first[0], encore[0]]);
  }
  return pairs;
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function workbookProducts(items: readonly CatalogEntry[], mapping: WorkbookMap) {
  const catalog: Catalog = { content: {}, "included-only": {}, accessories: {}, bundles: {}, homebrew: {} };
  for (const item of items) catalog[item.category][item.id] = item;
  const index = reviewIndex(catalog);
  const bundles = new Set(
    mapping.rows
      .filter((row) => row.primary.category === "bundles")
      .flatMap((row) => [row.primary, ...Object.values(row.releaseEditions ?? {}).flat()])
      .map((target) => collectionKey(target.contentId, target.editionId)),
  );
  const editions = (item: CatalogEntry) =>
    reviewEditions(item).filter((edition) => {
      if (item.category === "homebrew" || edition.format !== "physical" || edition.simulator) return false;
      if (item.category === "bundles" && !bundles.has(collectionKey(item.id, edition.id))) return false;
      return ["shirt", "dice"].includes(item.accessoryType ?? "") || reviewHasModels(item, edition, index.byId);
    });
  const allowed = new Set(items.flatMap((item) => editions(item).map((edition) => collectionKey(item.id, edition.id))));
  const accepts = (contentId: string, editionId: string) => allowed.has(collectionKey(contentId, editionId));
  const membership = (id: string, editionId: string) =>
    new Set([
      collectionKey(id, editionId),
      ...index.includedEditions(id, editionId).map(({ item, edition }) => collectionKey(item.id, edition.id)),
    ]);
  const core = membership("core", "1-5");
  const chest = membership("expansion-gamblers-chest", "box");
  const materials = [...new Set(items.flatMap((item) => reviewEditions(item).flatMap((edition) => edition.materials ?? [])))].sort(
    (a, b) => b.length - a.length,
  );
  const materialPattern = materials.map(escapePattern).join("|");
  const cleanQualifier = (value: string) =>
    value
      .replace(new RegExp(`(^|[\\s,:&()/])(?:${materialPattern})(?=$|[\\s,:&()/])`, "giu"), "$1")
      .replace(/^[\s,:&()/]+|[\s,:&()/]+$/gu, "")
      .trim()
      .replace(/^Box$/iu, "");
  const cleanName = (value: string, material = "") => {
    let name = value.trim().replace(new RegExp(`\\b(?:${materialPattern})\\s+(edition|version)\\b`, "giu"), "$1");
    const released = material
      .split(/\s*[,&]\s*/u)
      .filter(Boolean)
      .map(escapePattern);
    if (released.length) name = name.replace(new RegExp(`(\\(\\s*)(?:${released.join("|")})\\s+`, "giu"), "$1");
    const suffix = name.match(/\s*\(([^()]+)\)$/u);
    if (suffix && !cleanQualifier(suffix[1])) name = name.slice(0, suffix.index).trim();
    const trailing = new RegExp(`(?:\\s+[-,]?\\s*|\\s*\\()(?:${materialPattern})(?:\\s+(M\\d+))?(?:\\s+(?:version|edition))?\\)?$`, "iu");
    let match;
    while ((match = name.match(trailing))) {
      name = name
        .replace(trailing, "")
        .replace(/[\s,&:-]+$/u, "")
        .trim();
      if (match[1]) {
        name += ` (${match[1]})`;
        break;
      }
    }
    return name || value;
  };
  const name = (item: CatalogEntry, group: readonly Edition[]) => {
    const edition = group[0];
    const root = cleanName(item.name, edition.materials?.join(", "));
    let qualifier =
      group.length > 1 || /(?:^|: )(?:First Run|Encore)$/u.test(edition.label) ? family(edition.label) : cleanQualifier(edition.label);
    if (["Item", "Bundle"].includes(qualifier)) qualifier = "";
    if (edition.name) qualifier = edition.name;
    if (/painters?['’]?s?\s+scale/iu.test(root)) qualifier = qualifier.replace(/^Painters(?::\s*)?/u, "");
    else qualifier = qualifier.replace(/^Painters/u, "Painter's Scale");
    if (/\bbust\b/iu.test(root)) qualifier = qualifier.replace(/^Bust(?::\s*)?/u, "");
    if (edition.includedOnly && item.category !== "included-only" && !qualifier) qualifier = "Included model";
    return qualifier ? `${root} (${qualifier})` : root;
  };
  const classifications = (entries: readonly TemplateEntry[]) => {
    const selections = entries.flatMap((entry) => {
      const item = index.byId.get(entry.contentId);
      const edition = item && reviewEditions(item).find((edition) => edition.id === entry.editionId);
      return item && edition ? [{ item, edition }] : [];
    });
    const tagged = (...tags: string[]) => selections.some(({ item }) => tags.some((tag) => item.tags.includes(tag)));
    const shape = (kind: "Painters" | "Bust", tag: string) =>
      selections.some(({ item, edition }) => {
        const explicit = family(edition.label).split(": ")[0];
        if (["Painters", "Bust"].includes(explicit)) return explicit === kind;
        return item.tags.includes(tag) && !item.editions?.some((edition) => family(edition.label).split(": ")[0] === kind);
      });
    return {
      P: tagged("pinup"),
      Q: tagged("generic"),
      R: tagged("variant") || selections.some(({ edition }) => /variant|cheeky/iu.test(edition.label)),
      S: shape("Painters", "painters-scale"),
      T: shape("Bust", "bust"),
      U: tagged("crossover"),
      V: selections.some(({ edition }) => edition.beta === true),
      W: selections.some(({ item, edition }) => core.has(collectionKey(item.id, edition.id))),
      X: tagged("seasonal", "spring", "summer", "winter", "halloween", "easter", "valentine", "deathmas"),
      Y: tagged("white-box") || selections.some(({ edition }) => edition.label === "Box"),
      Z: tagged("gamblers-chest") || selections.some(({ item, edition }) => chest.has(collectionKey(item.id, edition.id))),
    };
  };
  // Product planning uses only catalog data and source row values; the writer owns XML, styles, and row positions.
  const planRows = (input: readonly CollectionWorkbookRow[], sheets: readonly SourceSheet[]) => {
    const states = new Map<string, EntryState>();
    for (const row of input) {
      const key = collectionKey(row.contentId, row.editionId);
      if (states.has(key)) throw new Error(`Duplicate collection edition ${key}.`);
      const item = index.byId.get(row.contentId);
      if (!item) throw new Error(`Unknown catalog item ${row.contentId}.`);
      if (!reviewEditions(item).some((edition) => edition.id === row.editionId)) throw new Error(`Unknown catalog edition ${key}.`);
      if (accepts(row.contentId, row.editionId)) states.set(key, normalizeEntry(row));
    }
    const descriptor = (contentId: string, editionId: string, column?: ReleaseColumn): TemplateEntry => {
      const item = index.byId.get(contentId);
      const edition = item && reviewEditions(item).find((edition) => edition.id === editionId);
      return {
        contentId,
        editionId,
        label: edition?.label ?? editionId,
        material: edition?.materials?.join(", ") ?? "",
        ...(column ? { column } : {}),
        state: states.get(collectionKey(contentId, editionId)) ?? {},
      };
    };
    const represented = new Set<string>();
    const plans = sheets.map((sheet) => {
      const miniature = sheet.name === "KDM Miniatures";
      const sourceRows = new Map(sheet.rows.map((row) => [row.row, row]));
      const rows = new Map<number, PlannedRow>();
      const removed = new Set<number>();
      for (const source of mapping.rows.filter((source) => source.sheet === sheet.name)) {
        const row = sourceRows.get(source.row);
        if (!row) throw new Error(`Template row ${sheet.name}, ${source.row} is missing.`);
        let entries = [descriptor(source.primary.contentId, source.primary.editionId)];
        for (const column of releaseColumns) {
          const alternatives = source.releaseEditions?.[column] ?? [];
          const target =
            alternatives.find((target) => target.contentId === source.primary.contentId && target.editionId === source.primary.editionId) ??
            alternatives[0];
          if (!target) continue;
          const existing = entries.find((entry) => entry.contentId === target.contentId && entry.editionId === target.editionId);
          if (existing) {
            if (!existing.column) entries[entries.indexOf(existing)] = { ...existing, column };
          } else entries.push(descriptor(target.contentId, target.editionId, column));
        }
        entries = entries.filter((entry) => accepts(entry.contentId, entry.editionId));
        const primary = entries[0];
        if (
          miniature &&
          primary &&
          !primary.column &&
          releaseColumn(primary.label) === "M" &&
          !entries.some((entry) => entry.column === "M")
        )
          entries[0] = { ...primary, column: "M" };
        if (!entries.length) {
          removed.add(source.row);
          continue;
        }
        for (const entry of entries) represented.add(collectionKey(entry.contentId, entry.editionId));
        rows.set(source.row, { name: miniature ? cleanName(source.name, String(row.material ?? "")) : row.name, entries });
      }
      const names = new Set(
        sheet.rows.filter((row) => !removed.has(row.row)).map((row) => JSON.stringify([rows.get(row.row)?.name ?? row.name, row.material])),
      );
      const additions: Addition[] = [];
      for (const item of items) {
        if (item.category === "homebrew") continue;
        let target: SourceSheet["name"] = "KDM Miniatures";
        if (item.accessoryType === "shirt") target = "Shirt Catalog";
        else if (item.accessoryType === "dice") target = "Dice Catalog";
        if (target !== sheet.name) continue;
        const releases = editions(item);
        const pairs = miniature ? releasePairs(releases) : [];
        for (const edition of releases) {
          const key = collectionKey(item.id, edition.id);
          if (represented.has(key)) continue;
          let group = [edition];
          const pair = pairs.find((pair) => pair.some((release) => release.id === edition.id)) ?? [];
          const sibling = pair.find((release) => release.id !== edition.id);
          if (sibling && represented.has(collectionKey(item.id, sibling.id))) {
            const column = releaseColumn(edition.label);
            const siblingColumn = releaseColumn(sibling.label);
            const candidates = [...rows.values()].filter(({ entries }) => {
              const retained = entries.find((entry) => entry.contentId === item.id && entry.editionId === sibling.id);
              if (!retained || (retained.column && retained.column !== siblingColumn)) return false;
              return !entries.some((entry) => entry.column === column || (!retained.column && entry.column === siblingColumn));
            });
            if (candidates.length === 1) {
              const row = candidates[0];
              row.entries = row.entries.map((entry) =>
                entry.contentId === item.id && entry.editionId === sibling.id ? { ...entry, column: siblingColumn } : entry,
              );
              row.entries.push(descriptor(item.id, edition.id, column));
              represented.add(key);
              continue;
            }
          } else if (sibling) group = pair;
          let label = miniature ? name(item, group) : item.name;
          const material = edition.materials?.join(", ") ?? "";
          const identity = () => JSON.stringify([label, miniature ? material : null]);
          if (names.has(identity())) label = `${label} (Alternate release)`;
          let alternate = 2;
          const base = label;
          while (names.has(identity())) label = `${base} ${alternate++}`;
          names.add(identity());
          additions.push({
            item,
            entries: group.map((edition) => descriptor(item.id, edition.id, miniature ? releaseColumn(edition.label) : undefined)),
            name: label,
          });
          for (const release of group) represented.add(collectionKey(item.id, release.id));
        }
      }
      return { rows, removed, additions };
    });
    for (const key of states.keys()) if (!represented.has(key)) throw new Error(`Unknown catalog edition ${key}.`);
    return plans;
  };
  return { accepts, editions, classifications, planRows };
}
