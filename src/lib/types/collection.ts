import { Result, Schema as S } from "effect";

export const copyNumberMaximum = 9999;
export const CopyNumberSchema = S.Int.check(S.isBetween({ minimum: 1, maximum: copyNumberMaximum }));

export const EntryStateSchema = S.Struct({
  owned: S.optionalKey(S.Boolean),
  wished: S.optionalKey(S.Boolean),
  copyNumber: S.optionalKey(CopyNumberSchema),
});

export interface EntryState extends S.Schema.Type<typeof EntryStateSchema> {}

const KeyPartsSchema = S.fromJsonString(S.Tuple([S.NonEmptyString, S.NonEmptyString]));
const decodeKey = S.decodeUnknownResult(KeyPartsSchema);

export const CollectionKeySchema = S.String.check(
  S.makeFilter(
    (key) => {
      const decoded = decodeKey(key);
      return Result.isSuccess(decoded) && JSON.stringify(decoded.success) === key;
    },
    { message: "Expected a canonical JSON tuple containing a content ID and edition ID." },
  ),
);

const decodeCollectionKey = S.decodeUnknownResult(CollectionKeySchema);

export const CollectionSnapshotSchema = S.Record(S.String, EntryStateSchema).check(
  S.makeFilter((state) => Object.keys(state).every((key) => Result.isSuccess(decodeCollectionKey(key))), {
    message: "Collection entries must use canonical content and edition ID keys.",
  }),
);
export type CollectionSnapshot = S.Schema.Type<typeof CollectionSnapshotSchema>;
export type CollectionPatch = Record<string, Omit<EntryState, "copyNumber"> & { copyNumber?: number | undefined }>;

export function collectionKey(contentId: string, editionId: string) {
  return JSON.stringify([contentId, editionId]);
}

export function parseCollectionKey(key: string) {
  S.decodeUnknownSync(CollectionKeySchema)(key);
  return S.decodeUnknownSync(KeyPartsSchema)(key);
}

export function entryId(ownerId: string, key: string) {
  return JSON.stringify([ownerId, ...parseCollectionKey(key)]);
}
