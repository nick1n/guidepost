import { it, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { BrowserStorage, StorageError } from "../src/lib/state/browser-storage.ts";
import { GuestStore, StoreError } from "../src/lib/state/stores.ts";

function storage(initial: string | null = null, failure?: StorageError["operation"]) {
  let value = initial;
  const access = <A,>(operation: StorageError["operation"], run: () => A) =>
    failure === operation ? Effect.fail(new StorageError({ operation, cause: "Simulated browser failure" })) : Effect.sync(run);
  const layer = Layer.succeed(BrowserStorage, {
    get: () => access("get", () => value),
    set: (_key, next) =>
      access("set", () => {
        value = next;
      }),
    remove: () =>
      access("remove", () => {
        value = null;
      }),
  });
  return {
    layer,
    get value() {
      return value;
    },
  };
}

it.effect("round-trips snapshots, replaces old entries, and clears storage", () =>
  Effect.gen(function* () {
    const f = storage();
    const store = yield* GuestStore.make("test").pipe(Effect.provide(f.layer));
    expect(yield* store.load()).toEqual({});
    const first = { core: { owned: true, versions: ["1.6"] }, dice: { wishlisted: true } };
    yield* store.save(first);
    expect(yield* store.load()).toEqual(first);
    yield* store.save({ core: { owned: false } });
    expect(yield* store.load()).toEqual({ core: { owned: false } });
    yield* store.clear();
    expect(f.value).toBeNull();
    expect(yield* store.load()).toEqual({});
  }),
);

for (const value of ["not JSON", '{"core":{"owned":"yes"}}']) {
  it.effect(`rejects malformed saved data: ${value}`, () =>
    Effect.gen(function* () {
      const f = storage(value);
      const store = yield* GuestStore.make("test").pipe(Effect.provide(f.layer));
      const error = yield* Effect.flip(store.load());
      expect(error).toBeInstanceOf(StoreError);
      expect(error.operation).toBe("load");
      expect(error.reason).toBe("invalid-data");
      expect(f.value).toBe(value);
    }),
  );
}

for (const operation of ["get", "set", "remove"] as const) {
  it.effect(`maps browser ${operation} failures to typed persistence errors`, () =>
    Effect.gen(function* () {
      const f = storage(null, operation);
      const store = yield* GuestStore.make("test").pipe(Effect.provide(f.layer));
      const action = operation === "get" ? store.load() : operation === "set" ? store.save({}) : store.clear();
      const error = yield* Effect.flip(action);
      expect(error).toBeInstanceOf(StoreError);
      expect(error.reason).toBe("unavailable");
      expect(error.cause).toBeInstanceOf(StorageError);
    }),
  );
}

it.effect("named store methods retain their instance when passed as callbacks", () =>
  Effect.gen(function* () {
    const f = storage();
    const store = yield* GuestStore.make("test").pipe(Effect.provide(f.layer));
    const { load, save, clear } = store;
    yield* save({ core: { owned: true } });
    expect(yield* load()).toEqual({ core: { owned: true } });
    yield* clear();
    expect(yield* load()).toEqual({});
  }),
);
