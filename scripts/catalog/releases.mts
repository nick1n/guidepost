import { Parser } from "htmlparser2";
import { editionByLabel, editionId } from "./identity.mts";
import { catalogListing, productUrl } from "./shop.mts";
import type { Edition, Item, Mapping, Product, Variant } from "./types.mts";

function contents(html: string) {
  const rows: string[] = [];
  let current: string[] | undefined;
  new Parser({
    onopentag(tag) {
      if (tag === "li") current = [];
    },
    ontext(text) {
      current?.push(text);
    },
    onclosetag(tag) {
      if (tag === "li" && current) {
        rows.push(current.join("").replace(/\s+/g, " ").trim());
        current = undefined;
      }
    },
  }).end(html);
  return rows.filter(Boolean);
}

function variantLabel(variant: Variant, fallback: string): string {
  if (!variant.requires_shipping) return "Sim";
  if (/^original cover$/i.test(variant.title)) return "Pawel Zdanowski";
  const cover = variant.title.match(/^(Ein Lee|Lokman Lam|Wenjuinn Png) variant cover$/i);
  if (cover) return ["Ein Lee", "Lokman Lam", "Wenjuinn Png"].find((name) => name.toLowerCase() === cover[1]!.toLowerCase())!;
  const format = fallback.match(/^(Painters|Bust|Remaster|Resculpt)(?:: (.+))?$/);
  if (format) return format[2] ? `${format[1]}: ${variantLabel(variant, format[2])}` : format[1]!;
  if (/first run/i.test(variant.title)) return "First Run";
  if (/second run collectors edition/i.test(variant.title)) return "Second Run";
  if (/encore/i.test(variant.title)) return "Encore";
  if (/deathgrey.*m2/i.test(variant.title)) return "Deathgrey M2";
  if (/deathgrey|death grey edition/i.test(variant.title)) return "Deathgrey";
  if (/deathpink|death pink edition/i.test(variant.title)) return "Deathpink";
  if (/general/i.test(variant.title)) return "General";
  return fallback;
}

function observedPrices(variants: Variant[], previous: number[] = []) {
  const observed = variants.flatMap((variant) => [
    variant.price,
    ...(variant.compare_at_price !== null && variant.compare_at_price > 0 ? [variant.compare_at_price] : []),
  ]);
  return [...new Set([...previous, ...observed])].sort((a, b) => a - b);
}

function inferMaterials(rows: string[], label: string) {
  if (label === "Sim") return undefined;
  const release = label.split(": ").at(-1)!;
  if (/^Deathgrey/.test(release)) return ["Deathgrey"];
  if (release === "Deathpink") return ["Deathpink"];
  if (rows.some((row) => /photoresin.*miniature|miniature.*photoresin/i.test(row))) return ["Photoresin"];
  if (rows.some((row) => /(?:hard )?plastic.*miniature|miniature.*(?:hard )?plastic/i.test(row))) return ["Plastic"];
  if (rows.some((row) => /resin.*miniature|miniature.*resin/i.test(row))) return ["Resin"];
  return undefined;
}

const runLabels = ["First Run", "Second Run", "Deathgrey", "Deathgrey M2", "Deathpink", "Encore", "General"];

function variantsFor(edition: Edition, product: Product, candidates: Edition[]) {
  if (["Pawel Zdanowski", "Ein Lee", "Lokman Lam", "Wenjuinn Png"].includes(edition.label))
    return product.variants.filter((variant) => variantLabel(variant, "") === edition.label);
  if (["Dwelling Key", "Illusionist Key", "Master Dwelling Key"].includes(edition.label)) {
    const physical = product.variants.filter((variant) => variant.requires_shipping);
    const matches = (title: string) =>
      edition.label === "Master Dwelling Key"
        ? /master/i.test(title)
        : edition.label === "Illusionist Key"
          ? /illusionist/i.test(title)
          : /dwelling/i.test(title) && !/master/i.test(title);
    const named = physical.filter((variant) => matches(variant.title));
    if (named.length) return named;
    // A dedicated key listing can use warehouse-only variant labels.
    return candidates.length === 1 && !physical.some((variant) => /master|illusionist|dwelling/i.test(variant.title)) ? physical : [];
  }
  const label = edition.label
    .split(": ")
    .at(-1)!
    .replace(/ \(\d{4}\)$/, "");
  const named = (variant: Product["variants"][number]) => variantLabel({ ...variant, requires_shipping: true }, "");
  if (runLabels.includes(label)) {
    if (candidates.length === 1 && product.variants.every((variant) => !named(variant))) return product.variants;
    return product.variants.filter((variant) => named(variant) === label);
  }
  if (edition.label === "Sim") return product.variants.filter((variant) => !variant.requires_shipping);
  if (candidates.length === 1) return product.variants;
  // Warehouse-only options describe the whole listing. Use them only when one
  // edition is compatible; a shared URL alone cannot distinguish two materials.
  const generic = candidates.filter(
    (candidate) =>
      !runLabels.includes(
        candidate.label
          .split(": ")
          .at(-1)!
          .replace(/ \(\d{4}\)$/, ""),
      ),
  );
  if (generic.length === 1) return product.variants.filter((variant) => !named(variant));
  if (edition.label === "Plastic" && product.product_type === "whitebox") return product.variants.filter((variant) => !named(variant));
  return [];
}

type ReleaseOptions = {
  policy: "update" | "retrieve";
  mapping?: Mapping;
};

export function mappingIssue(item: Item, product: Product, mapping: Mapping | undefined) {
  if (!mapping) return;
  if ("edition" in mapping || "variantEditions" in mapping)
    return "Outdated shop mapping; use editionId and variantEditionIds for existing editions";
  if (mapping.editionId && mapping.editionLabel) return "Use either editionId for an existing edition or editionLabel for a new release";
  const editions = (item.editions ?? []).filter((edition) => !edition.includedOnly);
  for (const id of [mapping.editionId, ...Object.values(mapping.variantEditionIds ?? {})])
    if (id !== undefined && !editions.some((edition) => edition.id === id))
      return `Mapping refers to missing or included-only edition ID ${id}`;
  if (mapping.variantEditionIds && !mapping.editionId) {
    const missing = product.variants.find(
      (variant) => (!mapping.variantIds || mapping.variantIds.includes(variant.id)) && !mapping.variantEditionIds![String(variant.id)],
    );
    if (missing) return `Variant ${missing.id} (${missing.title}) has no edition ID mapping; review the new variant`;
  }
}

/** Resolve a listing once, keeping curated selectors and existing edition identity together. */
export function resolveReleases(item: Item, product: Product, options: ReleaseOptions) {
  const { policy, mapping } = options;
  const invalid = mappingIssue(item, product, mapping);
  if (invalid) throw new Error(`${product.handle}: ${invalid}`);
  const rows = contents(product.description);
  const text = product.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const retrievedMaterial = /photoresin/i.test(text)
    ? "Photoresin"
    : /\bPVC\b/i.test(text)
      ? "PVC"
      : /hard plastic|plastic miniature/i.test(text)
        ? "Plastic"
        : /\bresin\b/i.test(text)
          ? "Resin"
          : undefined;
  const editions = (item.editions ?? []).filter((edition) => !edition.includedOnly);
  const linked = editions.filter((edition) => {
    const url = catalogListing(item, edition);
    if (!url) return false;
    try {
      return productUrl(url) === productUrl("/products/" + product.handle);
    } catch {
      return false;
    }
  });
  const format = linked[0]?.label.match(/^(Painters|Bust|Remaster|Resculpt)(?::|$)/)?.[1];
  const sameFormat = format && linked.every((edition) => edition.label === format || edition.label.startsWith(format + ": "));
  const fallbackEdition = linked.length === 1 || sameFormat ? linked[0] : undefined;
  let fallback = retrievedMaterial ?? "Box";
  if (policy !== "retrieve") {
    if (mapping?.editionLabel !== undefined) fallback = mapping.editionLabel;
    else if (fallbackEdition) fallback = fallbackEdition.label;
    else {
      fallback = product.variants.every((variant) => !variant.requires_shipping)
        ? "Sim"
        : (inferMaterials(rows, "Plastic")?.[0] ?? (mapping?.category === "accessories" ? "General" : "Box"));
    }
  }
  const groups = new Map<string, { label: string; edition: Edition | undefined; variants: Variant[] }>();
  const selected = mapping?.variantIds ? product.variants.filter((variant) => mapping.variantIds!.includes(variant.id)) : product.variants;
  for (const variant of selected) {
    const id = mapping?.variantEditionIds?.[String(variant.id)] ?? mapping?.editionId;
    const target = id ? editions.find((edition) => edition.id === id) : undefined;
    const release = target?.label ?? variantLabel(variant, fallback);
    // Warehouse names select shipping locations rather than separate releases.
    const label =
      policy === "retrieve" &&
      release === fallback &&
      !/default title|warehouse|united states|united kingdom|australia|canada|\b(?:US|UK|EU|USA|HQ)\b/i.test(variant.title)
        ? variant.title.trim() || fallback
        : release;
    const edition =
      target ??
      (!mapping?.editionLabel && linked.length === 1 && fallbackEdition?.label === label
        ? fallbackEdition
        : editionByLabel(editions, label));
    const key = edition?.id ? `id:${edition.id}` : `label:${label}`;
    const group = groups.get(key) ?? { label, edition, variants: [] };
    group.variants.push(variant);
    groups.set(key, group);
  }
  const releases = [...groups.values()].map(({ label, edition, variants }) => {
    const materials =
      policy === "retrieve"
        ? retrievedMaterial && label !== "Sim" && retrievedMaterial !== label && !/(?:^|: )(?:Deathgrey|Deathpink)/.test(label)
          ? [retrievedMaterial]
          : undefined
        : /(?:^|: )(?:Deathgrey|Deathpink)/.test(label)
          ? inferMaterials(rows, label)
          : (mapping?.materials ?? inferMaterials(rows, label) ?? edition?.materials);
    return {
      label,
      variants,
      edition,
      prices: observedPrices(variants, policy === "retrieve" || edition?.priceEstimated ? [] : edition?.prices),
      materials,
    };
  });
  const candidates = linked.length ? linked : editions;
  const run = (label: string) => runLabels.includes(label.split(": ").at(-1)!);
  // A material-only catalog edition may already represent the shop's named run.
  const uncertain =
    policy === "update" && editions.length && !mapping?.editionLabel
      ? releases.filter(
          ({ edition, label }) =>
            !edition &&
            label !== "Sim" &&
            (!run(label) || candidates.some((candidate) => candidate.label !== "Sim" && !candidate.simulator && !run(candidate.label))),
        )
      : [];
  const issue = uncertain.length
    ? `Review edition matching for ${uncertain.map(({ label }) => label).join(", ")}; select existing edition IDs or confirm a new release with editionLabel`
    : undefined;
  return { releases, variants: selected, contents: rows, text, issue };
}

/** Match a complete availability snapshot conservatively, rejecting ambiguous shared listings. */
export function availabilityReleases(product: Product, editions: Edition[]) {
  const candidates = editions.filter((edition) => !edition.includedOnly);
  return new Map(editions.map((edition) => [edition, edition.includedOnly ? [] : variantsFor(edition, product, candidates)]));
}

/** Build missing editions, assigning permanent IDs only at creation. */
export function productEditions(item: Item, product: Product) {
  if (!product.variants.length) throw new Error("Product has no variants");
  const result = resolveReleases(item, product, { policy: "retrieve" });
  const editions: Edition[] = [];
  const selectors: Record<string, string> = {};
  for (const release of result.releases) {
    const { label, prices, materials } = release;
    const id = editionId(label, editions);
    const edition: Edition = {
      id,
      label,
      ...(item.releaseDate ? { releaseDate: item.releaseDate } : {}),
      prices,
      ...(materials ? { materials } : {}),
    };
    if (label === "First Run") {
      const run = result.text.match(/first run.{0,160}?(?:limited to|limit(?:ed)?(?: edition)? of)\s*([\d,]+)/i);
      if (run) edition.runSize = Number(run[1]!.replaceAll(",", ""));
    }
    editions.push(edition);
    for (const variant of release.variants) selectors[String(variant.id)] = id;
  }
  return { editions, selectors };
}
