import { catalogListing, productUrl } from "./shop.mts";
import { availabilityReleases } from "./releases.mts";
import { categories, type Catalog, type Edition, type Product } from "./types.mts";

function handle(url: string) {
  try {
    return productUrl(url).split("/").at(-1);
  } catch {
    return undefined;
  }
}

export function availabilityFromUrls(catalog: Catalog, products: Product[]) {
  const listings = new Map(products.map((product) => [product.handle, product]));
  const unmatched: { category: string; itemId: string; edition: string; url?: string; reason: string }[] = [];
  let checked = 0;
  let available = 0;
  let changed = 0;
  for (const category of categories) {
    for (const [itemId, item] of Object.entries(catalog[category])) {
      if (category === "homebrew") continue;
      const groups = new Map<string, Edition[]>();
      for (const edition of item.editions ?? []) {
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
        const previous = edition.available;
        delete edition.available;
        const url = catalogListing(item, edition);
        const key = url ? handle(url) : undefined;
        const product = key ? listings.get(key) : undefined;
        // Promotional prize fulfillment is not a purchasable listing, despite Shopify stock availability.
        if (key === "kings-coin-prize") {
          checked++;
        } else if (!product) {
          unmatched.push({
            category,
            itemId,
            edition: edition.label,
            ...(url ? { url } : {}),
            reason: url ? "No matching product handle" : "No URL",
          });
        } else {
          const variants = resolved.get(edition)!;
          if (!variants.length) {
            unmatched.push({ category, itemId, edition: edition.label, url, reason: "No unambiguous matching variants" });
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
