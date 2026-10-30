import { it, expect } from "vitest";
import type { EditionSelection } from "#lib/catalog-view.ts";
import { copyNumberMessage, editionName, includedMessage, ownershipMessage, wishMessage } from "#lib/kdm/collection/messages.ts";

function selection(
  id: string,
  name: string,
  editionId = "original",
  label: EditionSelection["edition"]["label"] = "Original",
): EditionSelection {
  return {
    item: { id, name, tags: [], category: "content" },
    edition: { id: editionId, label, format: "physical" },
  };
}

it("names editions using only an item name and edition label", () => {
  expect(editionName({ item: { name: "Kingdom Death: Monster" }, edition: { label: "1.6" } })).toBe("Kingdom Death: Monster (1.6)");
  expect(editionName(selection("model", "Model", "encore", "Encore"))).toBe("Model (Encore)");
});

it("names editions added to and removed from the wishlist", () => {
  const target = selection("model", "Model", "encore", "Encore");
  expect(wishMessage(target, true)).toBe("Model (Encore) added to your wishlist.");
  expect(wishMessage(target, false)).toBe("Model (Encore) removed from your wishlist.");
});

it("names included editions marked present, missing, or restored", () => {
  const target = selection("model", "Model", "encore", "Encore");
  expect(includedMessage(target, true)).toBe("Model (Encore) marked as present.");
  expect(includedMessage(target, false)).toBe("Model (Encore) marked as missing.");
  expect(includedMessage(target, true, true)).toBe("Model (Encore) restored.");
  expect(includedMessage(target, false, true)).toBe("Model (Encore) marked as missing.");
});

it("names editions when setting or clearing their copy number", () => {
  const target = selection("model", "Model", "encore", "Encore");
  expect(copyNumberMessage(target, 1)).toBe("Model (Encore) copy number set to 1.");
  expect(copyNumberMessage(target, 9999)).toBe("Model (Encore) copy number set to 9999.");
  expect(copyNumberMessage(target, undefined)).toBe("Model (Encore) copy number cleared.");
});

it("empty ownership actions have no success message", () => {
  expect(ownershipMessage([], true)).toBe(false);
  expect(ownershipMessage([], false)).toBe(false);
});

for (const owned of [false, true]) {
  const status = owned ? "owned" : "not owned";
  it(`names a single edition marked as ${status}`, () => {
    expect(ownershipMessage([selection("core", "Core")], owned)).toBe(`Core (Original) marked as ${status}.`);
  });

  it(`names up to three unique editions marked as ${status}`, () => {
    const first = selection("core", "Core");
    expect(ownershipMessage([first, { ...first }, selection("king", "Dragon King"), selection("lion", "Lion Knight")], owned)).toBe(
      `Core (Original); Dragon King (Original); Lion Knight (Original) marked as ${status}.`,
    );
  });

  it(`summarizes bulk editions marked as ${status} while retaining their names`, () => {
    const first = selection("core", "Core");
    const targets = [first, selection("king", "Dragon King"), selection("lion", "Lion Knight"), selection("sun", "Sunstalker")];
    expect(ownershipMessage([...targets, { ...first }], owned)).toEqual({
      message: `4 editions marked as ${status}.`,
      details: ["Core (Original)", "Dragon King (Original)", "Lion Knight (Original)", "Sunstalker (Original)"],
    });
  });
}

it("ownership messages deduplicate by item and edition identity rather than display names", () => {
  const first = selection("first", "Model");
  expect(ownershipMessage([first, { ...first }, selection("second", "Model"), selection("first", "Model", "encore", "Encore")], true)).toBe(
    "Model (Original); Model (Original); Model (Encore) marked as owned.",
  );
});
