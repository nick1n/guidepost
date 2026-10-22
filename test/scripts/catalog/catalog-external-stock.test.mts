import { expect, test } from "vitest";
import { availabilityFromUrls } from "#scripts/catalog/availability.mts";
import type { Catalog } from "#scripts/catalog/types.mts";

test("shop refresh clears false stock evidence on external listings outside homebrew without changing availability", () => {
  const catalog: Catalog = {
    content: {},
    accessories: {},
    bundles: {
      phoenix: { name: "Phoenix Base Bundle", tags: ["homebrew"], url: "https://ko-fi.com/s/cb9ee97746", shop: "missing" },
      files: {
        name: "Files",
        tags: ["homebrew"],
        editions: [
          { id: "available", label: "3D Files", url: "https://example.com/products/files", available: true, shop: "missing" },
          { id: "unknown", label: "3D Files", url: "https://ko-fi.com/s/unknown", shop: "missing" },
          { id: "missing", label: "3D Files", handle: "missing" },
        ],
      },
    },
    homebrew: {},
    "included-only": {},
  };

  const result = availabilityFromUrls(catalog, []);

  expect(catalog.bundles.phoenix!.shop).toBeUndefined();
  const [available, unknown, missing] = catalog.bundles.files!.editions!;
  expect(available!.shop).toBeUndefined();
  expect(available!.available).toBe(true);
  expect(unknown!.shop).toBeUndefined();
  expect(unknown!.available).toBeUndefined();
  expect(missing!.shop).toBe("missing");
  expect(result.shopChanged).toBe(4);
  expect(result.changed).toBe(0);
  expect(result.unmatched).toEqual([
    {
      category: "bundles",
      itemId: "files",
      edition: "3D Files",
      url: "https://shop.kingdomdeath.com/products/missing",
      reason: "No matching product handle",
    },
  ]);
});
