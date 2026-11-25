import { describe, expect, it } from "vitest";
import { editionModelScales } from "#lib/kdm-data.ts";
import type { Edition } from "#lib/types/index.ts";

const physical: Edition = { id: "first-run", label: "First Run", format: "physical" };
const painters: Edition = { id: "painters", label: "Painters: First Run", format: "physical" };

describe("edition model scales", () => {
  it.each(["30", "50", "54", "100", "120", "135", "35 & 54", "30-100"])("does not derive scale from %s mm", (size) => {
    const item = { tags: [], size };
    expect(editionModelScales(item, { ...physical, size })).toEqual([]);
  });

  it("uses the large tag even when the recorded sizes are 30 or 50 mm", () => {
    const item = { tags: ["scale-large"], size: "50" };
    expect(editionModelScales(item, { ...physical, size: "30" })).toEqual([{ scale: "large", label: "Large scale" }]);
  });

  it("retains multiple tagged scales in ascending order without duplicates", () => {
    expect(editionModelScales({ tags: ["scale-small", "scale-tiny", "scale-small"] }, physical)).toEqual([
      { scale: "tiny", label: "Tiny scale" },
      { scale: "small", label: "Small scale" },
    ]);
    expect(editionModelScales({ tags: ["scale-medium", "scale-small"] }, physical)).toEqual([
      { scale: "small", label: "Small scale" },
      { scale: "medium", label: "Medium scale" },
    ]);
  });

  it("uses the painter tag even without a Painters edition label", () => {
    expect(editionModelScales({ tags: ["scale-painters"] }, physical)).toEqual([{ scale: "xl", label: "Painter’s scale" }]);
  });

  it("does not infer scale from an edition label without its tag", () => {
    expect(editionModelScales({ tags: [] }, painters)).toEqual([]);
  });

  it("scopes the painter tag to dedicated painter editions on mixed items", () => {
    const item = { tags: ["scale-painters"], editions: [physical, painters] };
    expect(editionModelScales(item, physical)).toEqual([]);
    expect(editionModelScales(item, painters)).toEqual([{ scale: "xl", label: "Painter’s scale" }]);
  });

  it("keeps the remaining scale tags on standard editions of mixed items", () => {
    const item = { tags: ["scale-small", "scale-painters"], editions: [physical, painters] };
    expect(editionModelScales(item, physical)).toEqual([{ scale: "small", label: "Small scale" }]);
    expect(editionModelScales(item, painters)).toEqual([{ scale: "xl", label: "Painter’s scale" }]);
  });

  it("omits mini and unrecognized tags", () => {
    expect(editionModelScales({ tags: ["scale-mini", "scale-unknown", "large", "50"] }, physical)).toEqual([]);
  });

  it("does not put scale icons on digital or simulator editions", () => {
    const item = { tags: ["scale-small", "scale-tiny"] };
    expect(editionModelScales(item, { ...physical, format: "digital" })).toEqual([]);
    expect(editionModelScales(item, { ...physical, simulator: true })).toEqual([]);
  });
});
