import { expect, it } from "vitest";
import { isDeferredAsset } from "../../src/service-worker/cache-policy.ts";

it("defers collection HTML and catalog assets while keeping Quick Start and shell assets precached", () => {
  for (const path of ["collection/", "collection/__data.json", "kdm-catalog/data.json", "kdm-catalog/workbook-map.json"])
    expect(isDeferredAsset(path)).toBe(true);
  for (const path of ["", "start/", "_app/immutable/entry/start.js", "logo/guidepost.svg"]) expect(isDeferredAsset(path)).toBe(false);
});

it("defers playground HTML and the legacy font fallback while keeping the modern font precached", () => {
  for (const path of ["font-test/", "font-test/__data.json", "gesture-test/", "gesture-test/__data.json", "fonts/kd-icons-v1.woff"])
    expect(isDeferredAsset(path)).toBe(true);
  expect(isDeferredAsset("fonts/kd-icons-v1.woff2")).toBe(false);
});
