import { Effect, Schema } from "effect";
import { preferenceDecoder } from "#lib/app/preferences/record.ts";
import { DisplayCurrency } from "#lib/app/currency/model.ts";

export const dateFormats = ["iso", "day-first", "month-first", "written"] as const;
export const DateFormat = Schema.Literals(dateFormats);
export type DateFormat = typeof DateFormat.Type;

export const AppValues = Schema.Struct({
  currency: DisplayCurrency,
  dateFormat: DateFormat,
  glass: Schema.NullOr(Schema.Boolean),
});
export interface AppValues extends Schema.Schema.Type<typeof AppValues> {}

export const appDefaults: AppValues = { currency: "USD", dateFormat: "iso", glass: null };

export const decodeAppRecord = preferenceDecoder(AppValues, appDefaults);

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
