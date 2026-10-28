import { expect, it } from "vitest";
import { Result, Schema } from "effect";
import {
  CollectionSnapshotSchema,
  CopyNumberSchema,
  collectionKey,
  copyNumberMaximum,
  entryId,
  parseCollectionKey,
} from "#lib/types/index.ts";

it("uses collision-safe keys and stable owner-scoped entry IDs", () => {
  const key = collectionKey('item:"id', "First Run:2");
  expect(parseCollectionKey(key)).toEqual(Result.succeed(['item:"id', "First Run:2"]));
  expect(collectionKey("a:b", "c")).not.toBe(collectionKey("a", "b:c"));
  expect(entryId("guest", 'item:"id', "First Run:2")).toBe(JSON.stringify(["guest", 'item:"id', "First Run:2"]));
  expect(entryId("guest", "a:b", "c")).not.toBe(entryId("guest", "a", "b:c"));
  expect(entryId("guest", 'item:"id', "First Run:2")).not.toBe(entryId("account", 'item:"id', "First Run:2"));
  expect(entryId("guest", "core", "core-16")).toBe('["guest","core","core-16"]');
});

it("rejects malformed or noncanonical keys and invalid state", () => {
  for (const key of ["item:edition", '["item"]', '["item",1]', '["", "edition"]', '["item","edition","extra"]', '[ "item", "edition" ]']) {
    expect(Result.isFailure(parseCollectionKey(key))).toBe(true);
    expect(() => Schema.decodeUnknownSync(CollectionSnapshotSchema)({ [key]: { owned: true } })).toThrow();
  }
  for (const invalid of ["42", -1, 1.5, 10000, Number.NaN]) {
    expect(() => Schema.decodeUnknownSync(CopyNumberSchema)(invalid)).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(CollectionSnapshotSchema)({ [collectionKey("item", "edition")]: { copyNumber: invalid } }),
    ).toThrow();
  }
  expect(() =>
    Schema.decodeUnknownSync(CollectionSnapshotSchema)({ [collectionKey("item", "edition")]: { copyNumber: undefined } }),
  ).toThrow();
  expect(copyNumberMaximum).toBe(9999);
  for (const valid of [0, 1, 5000, copyNumberMaximum]) {
    expect(Schema.decodeUnknownSync(CopyNumberSchema)(valid)).toBe(valid);
  }
  expect(
    Schema.decodeUnknownSync(CollectionSnapshotSchema)({
      [collectionKey("item", "edition")]: { owned: true, wished: false, copyNumber: 42 },
    }),
  ).toEqual({ [collectionKey("item", "edition")]: { owned: true, wished: false, copyNumber: 42 } });
});
