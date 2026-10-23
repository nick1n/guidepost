import { Effect } from "effect";
import type { Notice } from "../notifications/notifications.ts";
import { PreferenceSession } from "./preference-session.svelte.ts";
import { appDefaults, AppStorageError, type AppPreferenceStore, type AppValues } from "./preference-store.ts";

const openStore = Effect.fn("AppPreferences.openStore")(function* () {
  const { DexieAppStore } = yield* Effect.tryPromise({
    try: () => import("./dexie-preference-store.ts"),
    catch: (cause) => new AppStorageError({ operation: "load", cause }),
  });
  return new DexieAppStore();
});

export class AppPreferences {
  #session: PreferenceSession<AppValues, AppStorageError>;

  constructor(record: (notice: Notice) => void = () => {}, open: Effect.Effect<AppPreferenceStore, AppStorageError> = openStore()) {
    this.#session = new PreferenceSession({
      defaults: appDefaults,
      open,
      record,
      name: "app preferences",
      closedError: () => new AppStorageError({ operation: "save", cause: "Storage session is closed" }),
    });
  }

  get dateFormat() {
    return this.#session.values.dateFormat;
  }

  get glass() {
    return this.#session.values.glass;
  }

  get ready() {
    return this.#session.ready;
  }

  get hasPendingChanges() {
    return this.#session.hasPendingChanges;
  }

  get loadError() {
    return this.#session.loadError;
  }

  get saveError() {
    return this.#session.saveError;
  }

  run = Effect.fn("AppPreferences.run")({ self: this }, function () {
    return this.#session.run();
  });

  save(patch: Partial<AppValues>) {
    this.#session.save(patch);
  }
}
