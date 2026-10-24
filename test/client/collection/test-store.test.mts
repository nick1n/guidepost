import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { CollectionStorage } from "#lib/kdm/collection/state/collection-store.ts";
import { Collection } from "#lib/kdm/collection/state/collection.svelte.ts";
import { collectionKey } from "#lib/types/index.ts";
import { TestCollectionStore, testStoreLayer } from "./test-store.ts";

const key = collectionKey("model", "resin");

it.effect("shares one store between the application interface and test controls", () =>
  Effect.gen(function* () {
    const storage = yield* CollectionStorage;
    const controls = yield* TestCollectionStore;
    expect(storage).toBe(controls);
    const collection = new Collection();
    yield* collection.setStore(storage);
    controls.failNextSave("unavailable");
    expect(yield* collection.setOwned(key, true).pipe(Effect.flip)).toMatchObject({ _tag: "CollectionError", operation: "save" });
    expect(collection.state).toEqual({});
    expect(controls.state).toEqual({});
    yield* collection.setOwned(key, true);
    expect(controls.state).toEqual({ [key]: { owned: true } });
    expect(controls.writes).toBe(2);
  }).pipe(Effect.provide(testStoreLayer())),
);

it.effect("creates isolated store state for separate layer acquisitions", () =>
  Effect.gen(function* () {
    const layer = testStoreLayer();
    const first = yield* TestCollectionStore.pipe(Effect.provide(layer));
    const second = yield* TestCollectionStore.pipe(Effect.provide(layer));
    yield* first.save({ [key]: { owned: true } });
    expect(second.state).toEqual({});
    expect(second.writes).toBe(0);
  }),
);
