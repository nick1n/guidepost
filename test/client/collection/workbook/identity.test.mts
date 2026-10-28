import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import { workbookIdentities } from "#lib/kdm/collection/workbook/identity.ts";
import type { Metadata } from "#lib/types/workbook.ts";

function metadata(name: string, material?: string): Metadata {
  return { name, entries: [], baseline: material === undefined ? {} : { H: material } };
}

it("recovers product identities when a visible-only sort leaves metadata on the original row", () => {
  const speaker = metadata("White Speaker", "Resin");
  const knight = metadata("Twilight Knight", "Resin");
  const match = workbookIdentities(
    new Map([
      [10, speaker],
      [11, knight],
    ]),
  );
  assert.equal(match(10, { name: "Twilight Knight", material: "Resin" }), knight);
  assert.equal(match(11, { name: "White Speaker", material: "Resin" }), speaker);
});

it("distinguishes matching product names by material after a sort", () => {
  const resin = metadata("Questing Aya", "Photoresin");
  const grey = metadata("Questing Aya", "Deathgrey");
  const match = workbookIdentities(
    new Map([
      [10, resin],
      [11, grey],
    ]),
  );
  assert.equal(match(10, { name: "Questing Aya", material: "Deathgrey" }), grey);
  assert.equal(match(11, { name: "Questing Aya", material: "Photoresin" }), resin);
});

it("retains the original row identity when duplicate names and materials still match", () => {
  const first = metadata("Model", "Resin");
  const second = metadata("Model", "Resin");
  const match = workbookIdentities(
    new Map([
      [10, first],
      [11, second],
    ]),
  );
  assert.equal(match(10, { name: "Model", material: "Resin" }), first);
  assert.equal(match(11, { name: "Model", material: "Resin" }), second);
  assert.equal(match(12, { name: "Model", material: "Resin" }), undefined);
});

it("does not guess an identity for changed product names or unmatched materials", () => {
  const original = metadata("White Speaker", "Resin");
  const match = workbookIdentities(new Map([[10, original]]));
  assert.equal(match(10, { name: "Renamed model", material: "Resin" }), undefined);
  assert.equal(match(10, { name: "White Speaker", material: "Plastic" }), undefined);
});

it("supports accessories without material columns and older metadata without a material baseline", () => {
  const shirt = metadata("Shirt", "Cotton");
  const older = metadata("Model");
  const match = workbookIdentities(
    new Map([
      [10, shirt],
      [11, older],
    ]),
  );
  assert.equal(match(10, { name: "Shirt" }), shirt);
  assert.equal(match(11, { name: "Model", material: "Resin" }), older);
});

it("treats blank and missing material values as the same identity", () => {
  const original = metadata("Model", "");
  const match = workbookIdentities(new Map([[10, original]]));
  assert.equal(match(10, { name: "Model", material: undefined }), original);
  assert.equal(match(10, { name: "Model", material: null }), original);
});
