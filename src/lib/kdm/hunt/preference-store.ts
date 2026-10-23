import { Effect, Predicate, Schema } from "effect";

export const HuntValues = Schema.Struct({
  option: Schema.Literals(["fen", "kekasi", "ccg"]),
  bravadoBeta: Schema.Boolean,
  devilSatan: Schema.Boolean,
  gregalopeCE: Schema.Boolean,
});
export interface HuntValues extends Schema.Schema.Type<typeof HuntValues> {}
export type HuntOption = HuntValues["option"];

export const huntDefaults: HuntValues = { option: "kekasi", bravadoBeta: false, devilSatan: false, gregalopeCE: false };

/**
 * Compatibility policy: absent known fields use current defaults; present values
 * (including undefined) must validate. Loads never rewrite older records.
 * Effect's excess-property options only strip or reject, so an unknown-valued
 * rest record preserves future fields when a transactional patch is saved.
 */
const recordContainer = Schema.Unknown.check(
  Schema.makeFilter(
    (input) => Predicate.isObject(input) && (Object.getPrototypeOf(input) === Object.prototype || Object.getPrototypeOf(input) === null),
    { expected: "a plain preference record" },
  ),
);
const decodeRecord = Schema.decodeUnknownSync(
  recordContainer.pipe(
    Schema.decodeTo(
      Schema.StructWithRest(
        Schema.Struct({
          option: Schema.optionalKey(HuntValues.fields.option),
          bravadoBeta: Schema.optionalKey(HuntValues.fields.bravadoBeta),
          devilSatan: Schema.optionalKey(HuntValues.fields.devilSatan),
          gregalopeCE: Schema.optionalKey(HuntValues.fields.gregalopeCE),
        }),
        [Schema.Record(Schema.String, Schema.Unknown)],
      ),
    ),
  ),
);

export function decodeHuntRecord(input: unknown) {
  return { ...huntDefaults, ...decodeRecord(input) };
}
export class HuntStorageError extends Schema.TaggedError<HuntStorageError>()("HuntStorageError", {
  operation: Schema.Literals(["load", "save"]),
  cause: Schema.Defect(),
}) {
  get message() {
    return this.operation === "load"
      ? "Hunt preferences could not be loaded on this device."
      : "Hunt preference changed, but could not be saved on this device.";
  }
}

export interface HuntPreferenceStore {
  load(): Effect.Effect<HuntValues, HuntStorageError>;
  save(patch: Partial<HuntValues>): Effect.Effect<void, HuntStorageError>;
  close(): void;
}
