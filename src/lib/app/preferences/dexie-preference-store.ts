import { DexieStore } from "./dexie-store.ts";
import { decodeAppRecord, appDefaults, AppStorageError, type AppValues, type AppPreferenceStore } from "./preference-store.ts";

export class DexieAppStore extends DexieStore<AppValues, AppStorageError> implements AppPreferenceStore {
  constructor(name?: string) {
    super(
      {
        key: "app",
        defaults: appDefaults,
        decode: decodeAppRecord,
        error: (operation, cause) => new AppStorageError({ operation, cause }),
      },
      name,
    );
  }
}
