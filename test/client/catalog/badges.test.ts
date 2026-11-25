import { describe, expect, it } from "vitest";
import { reviewBadges } from "#lib/catalog-view.ts";

describe("catalog badges", () => {
  it("shows only Beta when all gameplay releases are Beta", () => {
    expect(
      reviewBadges({
        name: "Investment Sniper Punctual Bride",
        tags: ["gameplay", "beta"],
        kind: "box",
        editions: [
          { id: "first-run", label: "First Run", format: "physical", gameplay: true, beta: true },
          { id: "painters", label: "Painters", format: "physical" },
        ],
      }),
    ).toEqual({ gameplay: false, beta: true });
  });

  it("shows both badges for separate Beta and non-Beta gameplay releases", () => {
    expect(
      reviewBadges({
        name: "Mixed releases",
        tags: ["gameplay", "beta"],
        kind: "box",
        gameplay: true,
        editions: [
          { id: "first-run", label: "First Run", format: "physical", beta: true },
          { id: "plastic", label: "Plastic", format: "physical" },
        ],
      }),
    ).toEqual({ gameplay: true, beta: true });
  });
});
