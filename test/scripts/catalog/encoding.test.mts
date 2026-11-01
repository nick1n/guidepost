import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("preserves Unicode in catalog names and aliases", () => {
  const catalog = JSON.parse(readFileSync(new URL("../../../static/kdm/catalog/data.json", import.meta.url), "utf8"));
  expect(catalog.content.bjorn.name).toBe("Bj\u00f6rn");
  expect(catalog.content.bjorn.aliases).toContain("Bj\u00f6rn Deathgrey M2 Edition");
});
