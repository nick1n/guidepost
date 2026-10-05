import catalog from "../../../exports/kdm-catalog/kdm-data.json";
import type { ReviewCatalog } from "#lib/catalog-view.ts";

export function load() {
  return { catalog: catalog as ReviewCatalog };
}
