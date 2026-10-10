import { error } from "@sveltejs/kit";
import { asset } from "$app/paths";
import type { Catalog } from "#lib/types/index.ts";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
  const message = "The catalog could not be loaded. Please try again.";
  try {
    const response = await fetch(asset("kdm-catalog/data.json"));
    if (!response.ok) error(503, message);
    // This is the bundled catalog, validated by catalog:validate rather than a user import.
    const catalog: Catalog = await response.json();
    return { catalog };
  } catch {
    error(503, message);
  }
};
