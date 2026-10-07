import { resolve } from "node:path";

// Catalogs live under static/kdm-catalog/; optional working files live under the same workspace's temp/.
export function catalogTemp(root: string) {
  return resolve(root, "../../temp/kdm-catalog");
}
