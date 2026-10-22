import { afterAll, beforeAll, expect, test } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCatalog } from "#scripts/catalog/validate.mts";
import type { Catalog, Edition } from "#scripts/catalog/types.mts";

let workspace: string;
let schemaPath: string;
beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), "kdm-price-references-"));
  schemaPath = join(workspace, "data.schema.json");
  await writeFile(schemaPath, await readFile("static/kdm/catalog/data.schema.json", "utf8"));
});
afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
});

function fixture() {
  const included: Edition = { id: "included", label: "1.6", format: "physical", includedOnly: true, priceFrom: "sold" };
  const sold: Edition = { id: "sold", label: "1.6", format: "physical", prices: [4000] };
  const other: Edition = { id: "other", label: "1.6", format: "physical", prices: [2000] };
  const catalog: Catalog = {
    content: {},
    bundles: {},
    homebrew: {},
    "included-only": {},
    accessories: {
      rulebook: { name: "Rulebook", tags: ["rulebook"], kind: "accessory", accessoryType: "other", editions: [included, sold, other] },
    },
  };
  return { catalog, included, sold, other };
}

test.each([4000, 0])("accepts a direct reviewed reference to a price of %i cents", async (price) => {
  const { catalog, sold } = fixture();
  sold.prices = [price];
  await expect(validateCatalog(catalog, schemaPath)).resolves.toMatchObject({ editions: 3 });
});

test.each(["missing", "self", "chain", "cycle", "unpriced", "included", "own price", "format", "simulator"])(
  "rejects an invalid price reference: %s",
  async (scenario) => {
    const { catalog, included, sold } = fixture();
    switch (scenario) {
      case "missing":
        included.priceFrom = "absent";
        break;
      case "self":
        included.priceFrom = "included";
        break;
      case "chain":
        sold.priceFrom = "other";
        delete sold.prices;
        break;
      case "cycle":
        sold.priceFrom = "included";
        delete sold.prices;
        break;
      case "unpriced":
        delete sold.prices;
        break;
      case "included":
        sold.includedOnly = true;
        delete sold.prices;
        break;
      case "own price":
        delete included.includedOnly;
        included.prices = [1000];
        break;
      case "format":
        included.format = "digital";
        break;
      case "simulator":
        included.format = "digital";
        sold.format = "digital";
        included.simulator = true;
        break;
    }
    await expect(validateCatalog(catalog, schemaPath)).rejects.toThrow(/price reference|both prices and priceFrom/);
  },
);
