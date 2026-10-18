import { format, resolveConfig } from "prettier";
import { expect, it } from "vitest";

it("keeps short edition records compact with the catalog formatting configuration", async () => {
  const path = "static/kdm/catalog/data.json";
  const options = { ...(await resolveConfig(path)), parser: "json" };
  const fixture = { editions: [{ id: "original", label: "Original", format: "physical" }] };
  expect(await format(JSON.stringify(fixture, null, 2), options)).toContain(
    '"editions": [{ "id": "original", "label": "Original", "format": "physical" }]',
  );
});
