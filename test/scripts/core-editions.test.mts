import { expect, it } from "vitest";
import catalogJson from "../../static/kdm-catalog/data.json";
import coreEditions from "#lib/gen/core-editions.json";
import { editionGameplay } from "#lib/kdm-data.ts";
import type { Catalog } from "#lib/types/index.ts";

it("generates only playable core edition ids and labels, preserving catalog order", () => {
  const core = (catalogJson as Catalog).content.core;
  const expected = core.editions
    ?.filter((edition) => edition.id !== "resin" && editionGameplay(core, edition))
    .map(({ id, label }) => ({ id, label }));
  expect(coreEditions).toEqual(expected);
  expect(coreEditions.length).toBeGreaterThan(0);
  expect(coreEditions.some(({ id }) => id === "resin")).toBe(false);
  expect(core.editions?.some(({ id }) => id === "resin")).toBe(true);
});
