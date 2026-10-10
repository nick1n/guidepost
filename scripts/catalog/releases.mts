import { Parser } from "htmlparser2";
import { editionId } from "./identity.mts";
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
  const format = fallback.match(/^(Painters|Bust)(?:: (.+))?$/);
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
  // Only a prior multi-price array establishes sale amounts. A lone old MSRP is
  // retained in the review diff, rather than recast as a sale after a price rise.
  const maximum = Math.max(
    ...variants.flatMap((v) => [v.price, ...(v.compare_at_price && v.compare_at_price > v.price ? [v.compare_at_price] : [])]),
  );
  const sales = previous.length > 1 ? previous.filter((value) => value < Math.max(...previous) && value < maximum) : [];
  return [...new Set([...sales, ...variants.map((v) => v.price), maximum])].sort((a, b) => a - b);
}

function inferMaterials(rows: string[], label: string) {
  if (label === "Sim") return undefined;
  if (/^Deathgrey/.test(label)) return ["Deathgrey"];
  if (label === "Deathpink") return ["Deathpink"];
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
  policy: "update" | "observe" | "retrieve";
  mapping?: Mapping;
};

/** Resolve a listing once, keeping curated selectors and existing edition identity together. */
export function resolveReleases(item: Item, product: Product, options: ReleaseOptions) {
  const { policy, mapping } = options;
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
  const standard = (item.editions ?? []).filter((edition) => !edition.simulator && !/^(Painters|Bust)(?::|$)/.test(edition.label));
  let fallback = retrievedMaterial ?? "Box";
  if (policy !== "retrieve") {
    if (mapping?.edition !== undefined) fallback = mapping.edition;
    else if (policy === "observe") {
      fallback =
        (standard.length === 1 ? standard[0]!.label : undefined) ??
        (product.product_type === "whitebox" && standard.some((edition) => edition.label === "Plastic") ? "Plastic" : undefined) ??
        inferMaterials(rows, "Plastic")?.[0] ??
        "Box";
    } else {
      fallback = product.variants.every((variant) => !variant.requires_shipping)
        ? "Sim"
        : (inferMaterials(rows, "Plastic")?.[0] ?? (mapping?.category === "accessories" ? "General" : "Box"));
    }
  }
  const groups = new Map<string, Variant[]>();
  const selectors: Record<string, string> = {};
  const selected = mapping?.variantIds ? product.variants.filter((variant) => mapping.variantIds!.includes(variant.id)) : product.variants;
  for (const variant of selected) {
    const release = mapping?.variantEditions?.[String(variant.id)] ?? variantLabel(variant, fallback);
    // Warehouse names select shipping locations rather than separate releases.
    const label =
      policy === "retrieve" &&
      release === fallback &&
      !/default title|warehouse|united states|united kingdom|australia|canada|\b(?:US|UK|EU|USA|HQ)\b/i.test(variant.title)
        ? variant.title.trim() || fallback
        : release;
    selectors[String(variant.id)] = label;
    const variants = groups.get(label) ?? [];
    variants.push(variant);
    groups.set(label, variants);
  }
  const releases = [...groups].map(([label, variants]) => {
    const edition = item.editions?.find((edition) => edition.label === label);
    const materials =
      policy === "retrieve"
        ? retrievedMaterial && label !== "Sim" && retrievedMaterial !== label && !/^Deathgrey|^Deathpink/.test(label)
          ? [retrievedMaterial]
          : undefined
        : /^Deathgrey|^Deathpink/.test(label)
          ? inferMaterials(rows, label)
          : (mapping?.materials ?? inferMaterials(rows, label) ?? edition?.materials);
    return { label, variants, edition, prices: observedPrices(variants, policy === "retrieve" ? [] : edition?.prices), materials };
  });
  return { releases, variants: selected, selectors, contents: rows, text };
}

/** Match a complete availability snapshot conservatively, rejecting ambiguous shared listings. */
export function availabilityReleases(product: Product, editions: Edition[]) {
  return new Map(editions.map((edition) => [edition, variantsFor(edition, product, editions)]));
}

/** Build missing editions, assigning permanent IDs only at creation. */
export function productEditions(item: Item, product: Product) {
  if (!product.variants.length) throw new Error("Product has no variants");
  const result = resolveReleases(item, product, { policy: "retrieve" });
  const editions: Edition[] = [];
  for (const release of result.releases) {
    const { label, variants, prices, materials } = release;
    const edition: Edition = {
      id: editionId(label, editions),
      label,
      ...(item.releaseDate ? { releaseDate: item.releaseDate } : {}),
      prices,
      ...(variants.some((variant) => variant.available === true) ? { available: true } : {}),
      ...(materials ? { materials } : {}),
    };
    if (label === "First Run") {
      const run = result.text.match(/first run.{0,160}?(?:limited to|limit(?:ed)?(?: edition)? of)\s*([\d,]+)/i);
      if (run) edition.runSize = Number(run[1]!.replaceAll(",", ""));
    }
    editions.push(edition);
  }
  return { editions, selectors: result.selectors };
}
