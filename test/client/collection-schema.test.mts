import { expect, it } from "vitest";
import { Schema as S } from "effect";
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
  expect(parseCollectionKey(key)).toEqual(['item:"id', "First Run:2"]);
  expect(collectionKey("a:b", "c")).not.toBe(collectionKey("a", "b:c"));
  expect(entryId("guest", key)).toBe(entryId("guest", JSON.parse(JSON.stringify(key))));
  expect(entryId("guest", key)).not.toBe(entryId("account", key));
});

it("rejects malformed or noncanonical keys and invalid state", () => {
  for (const key of ["item:edition", '["item"]', '["item",1]', '["", "edition"]', '["item","edition","extra"]', '[ "item", "edition" ]']) {
    expect(() => parseCollectionKey(key)).toThrow();
    expect(() => S.decodeUnknownSync(CollectionSnapshotSchema)({ [key]: { owned: true } })).toThrow();
  }
  for (const invalid of ["42", 0, 1.5, 10000, Number.NaN]) {
    expect(() => S.decodeUnknownSync(CopyNumberSchema)(invalid)).toThrow();
    expect(() => S.decodeUnknownSync(CollectionSnapshotSchema)({ [collectionKey("item", "edition")]: { copyNumber: invalid } })).toThrow();
  }
  expect(() => S.decodeUnknownSync(CollectionSnapshotSchema)({ [collectionKey("item", "edition")]: { copyNumber: undefined } })).toThrow();
  expect(copyNumberMaximum).toBe(9999);
  for (const valid of [1, 5000, copyNumberMaximum]) {
    expect(S.decodeUnknownSync(CopyNumberSchema)(valid)).toBe(valid);
  }
  expect(
    S.decodeUnknownSync(CollectionSnapshotSchema)({ [collectionKey("item", "edition")]: { owned: true, wished: false, copyNumber: 42 } }),
  ).toEqual({ [collectionKey("item", "edition")]: { owned: true, wished: false, copyNumber: 42 } });
});

it("keeps the same key when an edition display label changes", () => {
  const edition = { id: "core-16", label: "1.6" };
  const key = collectionKey("core", edition.id);
  edition.label = "Second edition";
  expect(collectionKey("core", edition.id)).toBe(key);
  expect(entryId("guest", key)).toBe('["guest","core","core-16"]');
});
