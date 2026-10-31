import { DexieStore } from "#lib/app/preferences/dexie-store.ts";
import { decodeHuntRecord, huntDefaults, HuntStorageError, type HuntValues, type HuntPreferenceStore } from "./preference-store.ts";

export class DexieHuntStore extends DexieStore<HuntValues, HuntStorageError> implements HuntPreferenceStore {
  constructor(name?: string) {
    super(
      {
        key: "hunt",
        defaults: huntDefaults,
        decode: decodeHuntRecord,
        error: (operation, cause) => new HuntStorageError({ operation, cause }),
      },
      name,
    );
  }
}
