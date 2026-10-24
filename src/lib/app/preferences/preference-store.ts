import { Effect, Predicate, Result, Schema } from "effect";

export const dateFormats = ["iso", "day-first", "month-first", "written"] as const;
export const DateFormat = Schema.Literals(dateFormats);
export type DateFormat = typeof DateFormat.Type;

export const AppValues = Schema.Struct({
  dateFormat: DateFormat,
  glass: Schema.NullOr(Schema.Boolean),
});
export interface AppValues extends Schema.Schema.Type<typeof AppValues> {}

export const appDefaults: AppValues = { dateFormat: "iso", glass: null };

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
const decodeRecord = Schema.decodeUnknownResult(
  recordContainer.pipe(
    Schema.decodeTo(
      Schema.StructWithRest(
        Schema.Struct({
          dateFormat: Schema.optionalKey(AppValues.fields.dateFormat),
          glass: Schema.optionalKey(AppValues.fields.glass),
        }),
        [Schema.Record(Schema.String, Schema.Unknown)],
      ),
    ),
  ),
);

export function decodeAppRecord(input: unknown) {
  return Result.map(decodeRecord(input), (record) => ({ ...appDefaults, ...record }));
}
export class AppStorageError extends Schema.TaggedError<AppStorageError>()("AppStorageError", {
  operation: Schema.Literals(["load", "save"]),
  cause: Schema.Defect(),
}) {
  get message() {
    return this.operation === "load"
      ? "App preferences could not be loaded on this device."
      : "App preference changed, but could not be saved on this device.";
  }
}

export interface AppPreferenceStore {
  load(): Effect.Effect<AppValues, AppStorageError>;
  save(patch: Partial<AppValues>): Effect.Effect<void, AppStorageError>;
  close(): void;
}
