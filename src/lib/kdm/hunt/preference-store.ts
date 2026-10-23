import { Effect, Schema } from "effect";

export const HuntValues = Schema.Struct({
  option: Schema.Literals(["fen", "kekasi", "ccg"]),
  bravadoBeta: Schema.Boolean,
  devilSatan: Schema.Boolean,
  gregalopeCE: Schema.Boolean,
});
export interface HuntValues extends Schema.Schema.Type<typeof HuntValues> {}
export type HuntOption = HuntValues["option"];

export const huntDefaults: HuntValues = { option: "kekasi", bravadoBeta: false, devilSatan: false, gregalopeCE: false };

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
