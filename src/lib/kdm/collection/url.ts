import { formatHash, readHash } from "#lib/app/navigation/hash.ts";

export const categories = [
  { id: "content", label: "Content" },
  { id: "accessories", label: "Accessories" },
  { id: "bundles", label: "Bundles" },
  { id: "homebrew", label: "Homebrew" },
] as const;

export type Category = (typeof categories)[number]["id"];
export type CollectionView = { category: Category; query: string; tags: string[] };

export function readCollectionHash(hash: string): CollectionView {
  const separator = hash.indexOf("?");
  const path = separator < 0 ? hash : hash.slice(0, separator);
  const params = new URLSearchParams(separator < 0 || !hash.startsWith("#/") ? "" : hash.slice(separator + 1));
  const category = readHash(path)?.[0];
  return {
    category: categories.find(({ id }) => id === category)?.id ?? "content",
    query: params.get("q") ?? "",
    tags: [...new Set(params.getAll("tag"))],
  };
}

export function formatCollectionHash(view: CollectionView) {
  const params = new URLSearchParams();
  if (view.query) params.set("q", view.query);
  for (const tag of new Set(view.tags)) params.append("tag", tag);
  const query = params.toString();
  if (view.category === "content" && !query) return "";
  return formatHash([view.category]) + (query ? `?${query}` : "");
}

export const collectionHash = { read: readCollectionHash, format: formatCollectionHash };
