import { expect, it } from "vitest";
import { formatHash, readHash } from "#lib/app/navigation/hash.ts";

it("round trips encoded path segments without confusing data with separators", () => {
  const values = ["settlement", "People of the Sun", "A/B", "#?%", "\u96ea"];
  const hash = formatHash(values);
  expect(hash).toBe("#/settlement/People%20of%20the%20Sun/A%2FB/%23%3F%25/%E9%9B%AA");
  expect(readHash(hash)).toEqual(values);
});

it("distinguishes page parameters from anchors and rejects malformed escapes", () => {
  for (const hash of ["", "#section", "#/bad%zz", "#/%E9"]) expect(readHash(hash)).toBeUndefined();
  expect(readHash("#/0//back")).toEqual(["0", "", "back"]);
  expect(formatHash([0, "ccg", "front"])).toBe("#/0/ccg/front");
});
