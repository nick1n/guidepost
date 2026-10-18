import { readFile } from "node:fs/promises";
import { format, resolveConfig } from "prettier";
import { expect, it } from "vitest";

it("formats compact and expanded catalog JSON identically", async () => {
  const path = "static/kdm/catalog/data.json";
  const options = { ...(await resolveConfig(path)), parser: "json" };
  const text = await readFile(path, "utf8");
  const catalog = JSON.parse(text);
  const compact = await format(JSON.stringify(catalog), options);
  const expanded = await format(JSON.stringify(catalog, null, 2), options);
  expect(expanded).toBe(compact);
  expect(await format(compact, options)).toBe(compact);
  expect(text).toBe(compact);
  const fixture = { editions: [{ id: "original", label: "Original", format: "physical" }] };
  expect(await format(JSON.stringify(fixture, null, 2), options)).toContain(
    '"editions": [{ "id": "original", "label": "Original", "format": "physical" }]',
  );
});
