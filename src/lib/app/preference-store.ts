import { Effect, Schema } from "effect";

export const dateFormats = ["iso", "day-first", "month-first", "written"] as const;
export const DateFormat = Schema.Literals(dateFormats);
export type DateFormat = typeof DateFormat.Type;

export const AppValues = Schema.Struct({
  dateFormat: DateFormat,
  glass: Schema.NullOr(Schema.Boolean),
});
export interface AppValues extends Schema.Schema.Type<typeof AppValues> {}

export const appDefaults: AppValues = { dateFormat: "iso", glass: null };

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
