import { recordStock, type StockState } from "./stock.mts";
import { sortCatalogTags } from "./tags.mts";
import { catalogListing, productUrl } from "./shop.mts";
import { availabilityReleases } from "./releases.mts";
import { categories, type Catalog, type Edition, type Item, type Product } from "./types.mts";

function handle(url: string) {
  try {
    return productUrl(url).split("/").at(-1);
  } catch {
    return undefined;
  }
}

export function availabilityFromUrls(catalog: Catalog, products: Product[], shopUpdated = new Date().toISOString().slice(0, 10)) {
  const listings = new Map(products.map((product) => [product.handle, product]));
  const unmatched: { category: string; itemId: string; edition: string; url?: string; reason: string }[] = [];
  let shopChanged = 0;
  function observe(target: Item | Edition, url?: string, state: StockState = "missing", availability: "preserve" | "replace" = "preserve") {
    const result = recordStock(target, url ? state : undefined, availability);
    if (result.shopChanged) shopChanged++;
    if (result.availableChanged) changed++;
  }
  const stock = (variants: Product["variants"]) =>
    variants.length && variants.every((variant) => typeof variant.available === "boolean")
      ? variants.some((variant) => variant.available === true)
        ? "in-stock"
        : "out-of-stock"
      : "missing";
  let checked = 0;
  let available = 0;
  let changed = 0;
  for (const category of categories) {
    for (const [itemId, item] of Object.entries(catalog[category])) {
      if (category === "homebrew") continue;
      if (!item.editions?.length) {
        const url = catalogListing(item);
        const key = url ? handle(url) : undefined;
        const product = key ? listings.get(key) : undefined;
        observe(item, url, product ? stock(product.variants) : "missing");
        continue;
      }
      observe(item);
      const groups = new Map<string, Edition[]>();
      for (const edition of item.editions ?? []) {
        if (edition.includedOnly) continue;
        const url = catalogListing(item, edition);
        const key = url ? handle(url) : undefined;
        if (key) groups.set(key, [...(groups.get(key) ?? []), edition]);
      }
      const resolved = new Map(
        [...groups].flatMap(([key, editions]) => {
          const product = listings.get(key);
          return product ? [...availabilityReleases(product, editions)] : [];
        }),
      );
      for (const edition of item.editions ?? []) {
        if (edition.includedOnly) {
          observe(edition, undefined, "missing", "replace");
          continue;
        }
        const url = catalogListing(item, edition);
        const key = url ? handle(url) : undefined;
        const product = key ? listings.get(key) : undefined;
        let state: "in-stock" | "out-of-stock" | "missing" = "missing";
        // Promotional prize fulfillment is not a purchasable listing, despite Shopify stock availability.
        if (key === "kings-coin-prize") {
          checked++;
          state = "out-of-stock";
        } else if (!product) {
          unmatched.push({
            category,
            itemId,
            edition: edition.label,
            ...(url ? { url } : {}),
            reason: url ? "No matching product handle" : "No URL",
          });
        } else {
          const variants = resolved.get(edition) ?? [];
          state = stock(variants);
          if (state === "missing") {
            unmatched.push({ category, itemId, edition: edition.label, url, reason: "No unambiguous matching variants" });
          } else {
            checked++;
            if (state === "in-stock") {
              available++;
            }
          }
        }
        observe(edition, url, state, "replace");
      }
    }
  }
  const tagsChanged = sortCatalogTags(catalog);
  catalog.shopUpdated = shopUpdated.slice(0, 10);
  return { checked, available, changed, shopChanged, tagsChanged, unmatched };
}
