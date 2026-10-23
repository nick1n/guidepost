import { createContext } from "svelte";
import { Effect } from "effect";
import type { Notice } from "#lib/app/notifications/notifications.ts";
import { PreferenceSession } from "#lib/app/preferences/preference-session.svelte.ts";
import { huntDefaults, HuntStorageError, type HuntPreferenceStore, type HuntValues } from "./preference-store.ts";

const openStore = Effect.fn("HuntPreferences.openStore")(function* () {
  const { DexieHuntStore } = yield* Effect.tryPromise({
    try: () => import("./dexie-store.ts"),
    catch: (cause) => new HuntStorageError({ operation: "load", cause }),
  });
  return new DexieHuntStore();
});

export class HuntPreferences {
  #session: PreferenceSession<HuntValues, HuntStorageError>;

  constructor(record: (notice: Notice) => void = () => {}, open: Effect.Effect<HuntPreferenceStore, HuntStorageError> = openStore()) {
    this.#session = new PreferenceSession({
      defaults: huntDefaults,
      open,
      record,
      name: "hunt preferences",
      closedError: () => new HuntStorageError({ operation: "save", cause: "Storage session is closed" }),
    });
  }

  get option() {
    return this.#session.values.option;
  }

  get bravadoBeta() {
    return this.#session.values.bravadoBeta;
  }

  get devilSatan() {
    return this.#session.values.devilSatan;
  }

  get gregalopeCE() {
    return this.#session.values.gregalopeCE;
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

  run = Effect.fn("HuntPreferences.run")({ self: this }, function () {
    return this.#session.run();
  });

  setOption(value: string) {
    if (value !== "fen" && value !== "kekasi" && value !== "ccg") return;
    this.#session.save({ option: value });
  }

  setBravadoBeta(value: boolean) {
    this.#session.save({ bravadoBeta: value });
  }

  setDevilSatan(value: boolean) {
    this.#session.save({ devilSatan: value });
  }

  setGregalopeCE(value: boolean) {
    this.#session.save({ gregalopeCE: value });
  }
}

export const [getHuntPreferences, setHuntPreferences] = createContext<HuntPreferences>();
