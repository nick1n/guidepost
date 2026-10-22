import { Result, Schema } from "effect";

export const copyNumberMaximum = 9999;
export const CopyNumberSchema = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: copyNumberMaximum }));

export const EntryStateSchema = Schema.Struct({
  owned: Schema.optionalKey(Schema.Boolean),
  missing: Schema.optionalKey(Schema.Boolean),
  wished: Schema.optionalKey(Schema.Boolean),
  copyNumber: Schema.optionalKey(CopyNumberSchema),
});

export interface EntryState extends Schema.Schema.Type<typeof EntryStateSchema> {}

const KeyPartsSchema = Schema.fromJsonString(Schema.Tuple([Schema.NonEmptyString, Schema.NonEmptyString]));
const decodeKey = Schema.decodeUnknownResult(KeyPartsSchema);

export const CollectionKeySchema = Schema.String.check(
  Schema.makeFilter(
    (key) => {
      const decoded = decodeKey(key);
      return Result.isSuccess(decoded) && JSON.stringify(decoded.success) === key;
    },
    { message: "Expected a canonical JSON tuple containing a content ID and edition ID." },
  ),
);

const decodeCollectionKey = Schema.decodeUnknownResult(CollectionKeySchema);

export const CollectionSnapshotSchema = Schema.Record(Schema.String, EntryStateSchema).check(
  Schema.makeFilter((state) => Object.keys(state).every((key) => Result.isSuccess(decodeCollectionKey(key))), {
    message: "Collection entries must use canonical content and edition ID keys.",
  }),
);
export type CollectionSnapshot = Schema.Schema.Type<typeof CollectionSnapshotSchema>;
export type CollectionPatch = Record<string, Omit<EntryState, "copyNumber"> & { copyNumber?: number | undefined }>;

export function normalizeEntry(entry: EntryState): EntryState {
  return {
    ...(entry.owned ? { owned: true } : {}),
    ...(entry.wished ? { wished: true } : {}),
    ...(entry.missing ? { missing: true } : {}),
    ...(entry.copyNumber === undefined ? {} : { copyNumber: entry.copyNumber }),
  };
}

export function normalizeSnapshot(snapshot: CollectionSnapshot): CollectionSnapshot {
  return Object.fromEntries(
    Object.entries(snapshot).flatMap(([key, entry]) => {
      const normalized = normalizeEntry(entry);
      return Object.keys(normalized).length ? [[key, normalized]] : [];
    }),
  );
}

export function collectionKey(contentId: string, editionId: string) {
  return JSON.stringify([contentId, editionId]);
}

export function parseCollectionKey(key: string) {
  Schema.decodeUnknownSync(CollectionKeySchema)(key);
  return Schema.decodeUnknownSync(KeyPartsSchema)(key);
}

export function entryId(ownerId: string, key: string) {
  return JSON.stringify([ownerId, ...parseCollectionKey(key)]);
}
