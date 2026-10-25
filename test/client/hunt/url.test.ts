import { expect, it } from "vitest";
import { readHuntHash, formatHuntHash } from "#lib/kdm/hunt/url.ts";

it("reads explicit hash links and retains the 00 event", () => {
  expect(readHuntHash("#/1/fen/front")).toEqual({ event: 1, art: "fen", show: "front" });
  expect(readHuntHash("#/00/kekasi/reverse")).toEqual({ event: 0, art: "kekasi", show: "reverse" });
});

it("defaults hash links to CCG artwork and the back face", () => {
  expect(readHuntHash("#/1")).toEqual({ event: 1, art: "ccg", show: "back" });
  expect(readHuntHash("#/1/fen")).toEqual({ event: 1, art: "fen", show: "back" });
  expect(readHuntHash("#/1//front")).toEqual({ event: 1, art: "ccg", show: "front" });
});

it("preserves bare-page preferences and falls back for invalid values", () => {
  for (const hash of ["", "#details"]) expect(readHuntHash(hash)).toEqual({ event: 1, art: undefined, show: "back" });
  expect(readHuntHash("#/%zz")).toEqual({ event: 1, art: "ccg", show: "back" });
  for (const event of ["", "-1", "100", "1.5", "1e1", "NaN", " 1"]) {
    expect(readHuntHash(`#/${event}/unknown/unknown`)).toEqual({ event: 1, art: "ccg", show: "back" });
  }
  expect(readHuntHash("#/%31/fen/front")).toEqual({ event: 1, art: "fen", show: "front" });
});

it("omits CCG and back defaults while retaining positional artwork for other faces", () => {
  for (const [state, hash] of [
    [{ event: 1, art: "ccg", show: "back" }, "#/1"],
    [{ event: 1, art: "fen", show: "back" }, "#/1/fen"],
    [{ event: 1, art: "ccg", show: "front" }, "#/1/ccg/front"],
    [{ event: 73, art: "kekasi", show: "reverse" }, "#/73/kekasi/reverse"],
    [{ event: 0, art: "ccg", show: "back" }, "#/0"],
  ] as const) {
    expect(formatHuntHash(state)).toBe(hash);
    expect(readHuntHash(hash)).toEqual(state);
  }
});
