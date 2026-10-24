import { Context, Effect, Layer } from "effect";
import { CollectionStorage, StoreError, type CollectionStore } from "#lib/kdm/collection/state/collection-store.ts";
import type { CollectionSnapshot } from "#lib/types/index.ts";

export interface TestStore extends CollectionStore {
  readonly state: CollectionSnapshot;
  readonly writes: number;
  readonly saved: readonly CollectionSnapshot[];
  failLoad(fail: boolean): void;
  failNextSave(reason: StoreError["reason"]): void;
  replaceState(state: CollectionSnapshot): void;
  onLoadStarted(effect: () => Effect.Effect<void>): void;
  waitForLoad(effect: Effect.Effect<void>): void;
  onSaveStarted(effect: () => Effect.Effect<void>): void;
  waitForSave(effect: Effect.Effect<void>): void;
}

export class TestCollectionStore extends Context.Service<TestCollectionStore, TestStore>()("guidepost/test/CollectionStore") {}

export function makeTestStore(initial: CollectionSnapshot = {}): TestStore {
  let state = structuredClone(initial);
  let failLoad = false;
  let failSave: StoreError["reason"] | undefined;
  const saved: CollectionSnapshot[] = [];
  let beforeLoad = () => Effect.void;
  let waitForLoad: Effect.Effect<void> = Effect.void;
  let beforeSave = () => Effect.void;
  let waitForSave: Effect.Effect<void> = Effect.void;

  return TestCollectionStore.of({
    load: Effect.fn("TestCollectionStore.load")(function* () {
      yield* beforeLoad();
      yield* waitForLoad;
      if (failLoad) return yield* new StoreError({ operation: "load", reason: "invalid-data", cause: "Simulated load failure" });
      return structuredClone(state);
    }),
    save: Effect.fn("TestCollectionStore.save")(function* (next: CollectionSnapshot) {
      const snapshot = structuredClone(next);
      saved.push(snapshot);
      yield* beforeSave();
      yield* waitForSave;
      if (failSave) {
        const reason = failSave;
        failSave = undefined;
        return yield* new StoreError({ operation: "save", reason, cause: "Simulated save failure" });
      }
      state = snapshot;
    }),
    clear: Effect.fn("TestCollectionStore.clear")(() =>
      Effect.sync(() => {
        state = {};
      }),
    ),
    get state() {
      return structuredClone(state);
    },
    get writes() {
      return saved.length;
    },
    get saved() {
      return saved.map((snapshot) => structuredClone(snapshot));
    },
    failLoad: (fail) => {
      failLoad = fail;
    },
    failNextSave: (reason) => {
      failSave = reason;
    },
    replaceState: (next) => {
      state = structuredClone(next);
    },
    onLoadStarted: (effect) => {
      beforeLoad = effect;
    },
    waitForLoad: (effect) => {
      waitForLoad = effect;
    },
    onSaveStarted: (effect) => {
      beforeSave = effect;
    },
    waitForSave: (effect) => {
      waitForSave = effect;
    },
  });
}

export function testStoreLayer(initial: CollectionSnapshot = {}) {
  return Layer.effectContext(
    Effect.sync(() => {
      const service = makeTestStore(initial);
      return Context.make(CollectionStorage, service).pipe(Context.add(TestCollectionStore, service));
    }),
  );
}
