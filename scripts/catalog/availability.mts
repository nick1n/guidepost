import { productUrl } from "./shop.mts";
import { variantLabel } from "./update.mts";
import { categories, type Catalog, type Edition, type Product } from "./types.mts";

function handle(url: string) {
  try {
    return productUrl(url).split("/").at(-1);
  } catch {
    return undefined;
  }
}

const runLabels = ["First Run", "Second Run", "Deathgrey", "Deathgrey M2", "Deathpink", "Encore", "General"];

function variantsFor(edition: Edition, product: Product, candidates: Edition[]) {
  if (["Dwelling Key", "Illusionist Key", "Master Dwelling Key"].includes(edition.v)) {
    const physical = product.variants.filter((variant) => variant.requires_shipping);
    const matches = (title: string) =>
      edition.v === "Master Dwelling Key"
        ? /master/i.test(title)
        : edition.v === "Illusionist Key"
          ? /illusionist/i.test(title)
          : /dwelling/i.test(title) && !/master/i.test(title);
    const named = physical.filter((variant) => matches(variant.title));
    if (named.length) return named;
    // A dedicated key listing can use warehouse-only variant labels.
    return candidates.length === 1 && !physical.some((variant) => /master|illusionist|dwelling/i.test(variant.title)) ? physical : [];
  }
  const label = edition.v
    .split(": ")
    .at(-1)!
    .replace(/ \(\d{4}\)$/, "");
  const named = (variant: Product["variants"][number]) => variantLabel({ ...variant, requires_shipping: true }, "");
  if (runLabels.includes(label)) {
    if (candidates.length === 1 && product.variants.every((variant) => !named(variant))) return product.variants;
    return product.variants.filter((variant) => named(variant) === label);
  }
  if (edition.v === "Sim") return product.variants.filter((variant) => !variant.requires_shipping);
  if (candidates.length === 1) return product.variants;
  // Warehouse-only options describe the whole listing. Use them only when one
  // edition is compatible; a shared URL alone cannot distinguish two materials.
  const generic = candidates.filter(
    (candidate) =>
      !runLabels.includes(
        candidate.v
          .split(": ")
          .at(-1)!
          .replace(/ \(\d{4}\)$/, ""),
      ),
  );
  if (generic.length === 1) return product.variants.filter((variant) => !named(variant));
  if (edition.v === "Plastic" && product.product_type === "whitebox") return product.variants.filter((variant) => !named(variant));
  return [];
}

export function availabilityFromUrls(catalog: Catalog, products: Product[]) {
  const listings = new Map(products.map((product) => [product.handle, product]));
  const unmatched: { category: string; itemId: string; edition: string; url?: string; reason: string }[] = [];
  let checked = 0;
  let available = 0;
  let changed = 0;
  for (const category of categories) {
    for (const [itemId, item] of Object.entries(catalog[category])) {
      const groups = new Map<string, Edition[]>();
      for (const edition of item.editions ?? []) {
        const url = edition.url ?? item.url;
        const key = url ? handle(url) : undefined;
        if (key) groups.set(key, [...(groups.get(key) ?? []), edition]);
      }
      for (const edition of item.editions ?? []) {
        const previous = edition.available;
        delete edition.available;
        const url = edition.url ?? item.url;
        const key = url ? handle(url) : undefined;
        const product = key ? listings.get(key) : undefined;
        if (!product) {
          unmatched.push({
            category,
            itemId,
            edition: edition.v,
            ...(url ? { url } : {}),
            reason: url ? "No matching product handle" : "No URL",
          });
        } else {
          const variants = variantsFor(edition, product, groups.get(key!)!);
          if (!variants.length) {
            unmatched.push({ category, itemId, edition: edition.v, url, reason: "No unambiguous matching variants" });
          } else {
            checked++;
            if (variants.some((variant) => variant.available === true)) {
              edition.available = true;
              available++;
            }
          }
        }
        if (previous !== edition.available) changed++;
      }
    }
  }
  return { checked, available, changed, unmatched };
}
