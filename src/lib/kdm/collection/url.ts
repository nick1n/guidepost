import { formatHash, readHash } from "#lib/app/navigation/hash.ts";

export const categories = [
  { id: "content", label: "Content" },
  { id: "accessories", label: "Accessories" },
  { id: "bundles", label: "Bundles" },
  { id: "homebrew", label: "Homebrew" },
] as const;

export type Category = (typeof categories)[number]["id"];
/** itemId is absent for lists, null for invalid item paths, or an exact case-sensitive catalog ID. */
export type CollectionView = { category: Category; query: string; tags: string[]; itemId?: string | null };

export function readCollectionHash(hash: string): CollectionView {
  const separator = hash.indexOf("?");
  const path = separator < 0 ? hash : hash.slice(0, separator);
  const params = new URLSearchParams(separator < 0 || !hash.startsWith("#/") ? "" : hash.slice(separator + 1));
  const segments = readHash(path);
  const category = categories.find(({ id }) => id === segments?.[0])?.id;
  const itemPath = path.startsWith("#/") && path.slice(2).includes("/");
  const itemId = itemPath ? (category && segments?.length === 2 && segments[1] ? segments[1] : null) : undefined;
  return {
    category: category ?? "content",
    query: itemPath ? "" : (params.get("q") ?? ""),
    tags: itemPath ? [] : [...new Set(params.getAll("tag"))],
    ...(itemPath ? { itemId } : {}),
  };
}

export function formatCollectionHash(view: CollectionView) {
  if (view.itemId !== undefined) return formatHash([view.category, view.itemId ?? ""]);
  const params = new URLSearchParams();
  if (view.query) params.set("q", view.query);
  for (const tag of new Set(view.tags)) params.append("tag", tag);
  const query = params.toString();
  if (view.category === "content" && !query) return "";
  return formatHash([view.category]) + (query ? `?${query}` : "");
}

export const collectionHash = { read: readCollectionHash, format: formatCollectionHash };
