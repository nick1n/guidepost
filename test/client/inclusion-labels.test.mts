import { expect, it } from "vitest";
import { reviewIndex, type ReviewCatalog } from "#lib/catalog-view.ts";

function fixture(): ReviewCatalog {
  return {
    content: {
      expansion: {
        name: "Knight expansion",
        tags: [],
        editions: [
          { id: "1-6", label: "1.6", format: "physical" },
          { id: "1-7", label: "1.7", format: "physical" },
        ],
        includes: [
          { item: "knight", editionId: "plastic", shortLabel: "Model" },
          { item: "gameplay", editionId: "1-7", parentEditionIds: ["1-7"], shortLabel: "Gameplay content" },
        ],
      },
      knight: {
        name: "Knight",
        tags: [],
        editions: [{ id: "plastic", label: "Plastic", format: "physical", materials: ["Plastic"] }],
      },
      gameplay: {
        name: "Knight gameplay content",
        tags: [],
        editions: [{ id: "1-7", label: "1.7", format: "physical" }],
      },
    },
    bundles: {
      bundle: { name: "Bundle", tags: [], includes: [{ item: "knight", editionId: "plastic" }, "gameplay"] },
    },
    accessories: {},
    homebrew: {},
    "included-only": {},
  };
}

it("uses relationship labels in contents without changing canonical names or other parents", () => {
  const index = reviewIndex(fixture());
  const coverage = index.coverage({});
  const children = coverage.contents("expansion", "1-7").children;

  expect(children.map((child) => child.name)).toEqual(["Model", "Gameplay content"]);
  expect(children.map((child) => child.item.name)).toEqual(["Knight", "Knight gameplay content"]);
  expect(children.map((child) => child.edition.label)).toEqual(["Plastic", "1.7"]);
  expect(coverage.contents("bundle", "bundle").children.map((child) => child.name)).toEqual(["Knight", "Knight gameplay content"]);
  expect(index.byId.get("knight")?.name).toBe("Knight");
});

it("keeps contextual labels scoped to the matching parent edition", () => {
  const index = reviewIndex(fixture());
  expect(
    index
      .coverage({})
      .contents("expansion", "1-6")
      .children.map((child) => child.name),
  ).toEqual(["Model"]);
  expect(index.includedEditions("expansion", "1-7", false).map((child) => child.edition.id)).toEqual(["plastic", "1-7"]);
});
