// Collection HTML embeds its prerendered catalog response, so defer both until the route is visited.
export function isDeferredAsset(path: string) {
  return path.startsWith("collection/") || path.startsWith("kdm-catalog/");
}
