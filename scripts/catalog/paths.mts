import { resolve } from "node:path";

// Each helper receives the catalog directory, normally static/kdm/catalog/.
export function catalogTemp(root: string) {
  return resolve(root, "../../../temp/kdm-catalog");
}

export function catalogLocal(root: string) {
  return resolve(root, "../../../local-data/kdm-catalog");
}

export function catalogCache(root: string) {
  return resolve(root, "../../../.cache/kdm-catalog");
}
