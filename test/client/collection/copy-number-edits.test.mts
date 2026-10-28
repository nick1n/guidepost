import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Deferred, Effect, Fiber } from "effect";
import type { EditionSelection } from "#lib/catalog-view.ts";
import { createCollectionActions } from "#lib/kdm/collection/state/collection-actions.ts";
import { Collection } from "#lib/kdm/collection/state/collection.svelte.ts";
import { CopyNumberEdits } from "#lib/kdm/collection/state/copy-number-edits.svelte.ts";
import { Notifications, type Notice } from "#lib/app/notifications/notifications.ts";
import { type CollectionStore } from "#lib/kdm/collection/state/collection-store.ts";
import { collectionKey, type Catalog, type CollectionSnapshot } from "#lib/types/index.ts";
import { makeStore } from "./test-store.ts";

const catalog: Catalog = {
  content: {
    model: {
      name: "Model",
      tags: [],
      editions: [
        { id: "resin", label: "Resin", format: "physical", runSize: 100 },
        { id: "encore", label: "Encore", format: "physical" },
      ],
    },
    other: { name: "Other", tags: [], editions: [{ id: "resin", label: "Resin", format: "physical" }] },
  },
  accessories: {},
  bundles: {},
  homebrew: {},
  "included-only": {},
};

function selection(itemId = "model", editionId = "resin"): EditionSelection {
  const item = catalog.content[itemId];
  const edition = item.editions?.find((entry) => entry.id === editionId);
  if (!edition) throw new Error("Missing test edition");
  return { item: { ...item, id: itemId, category: "content" }, edition };
}

function input(value: string, badInput = false) {
  return {
    value,
    valueAsNumber: value === "" ? NaN : Number(value),
    validity: {
      badInput,
      customError: false,
      patternMismatch: false,
      rangeOverflow: false,
      rangeUnderflow: false,
      stepMismatch: false,
      tooLong: false,
      tooShort: false,
      typeMismatch: false,
      valid: !badInput,
      valueMissing: false,
    },
  };
}

function keyboard(key: string, isComposing = false) {
  return Object.assign(new Event("keydown", { cancelable: true }), { key, isComposing }) as KeyboardEvent;
}

async function fixture(initial: CollectionSnapshot = {}) {
  const store = makeStore(initial);
  const started = Effect.runSync(Deferred.make<void>());
  store.onSaveStarted(() => Deferred.succeed(started, undefined));
  const collection = new Collection(catalog);
  await Effect.runPromise(collection.setStore(store));
  const notices: Notice[] = [];
  const actions = createCollectionActions(Notifications.layerWith((notice) => notices.push(notice)));
  const run = vi.spyOn(actions, "run");
  const edits = new CopyNumberEdits(collection, actions);
  return {
    collection,
    edits,
    notices,
    get writes() {
      return store.saved;
    },
    run,
    started: () => Effect.runPromise(Deferred.await(started)),
    pause: () => {
      const gate = Effect.runSync(Deferred.make<void>());
      store.waitForSave(Deferred.await(gate));
      return () => Effect.runPromise(Deferred.succeed(gate, undefined));
    },
    fail: () => {
      store.failNextSave("unavailable");
    },
    settled: async () => {
      for (const result of run.mock.results) {
        if (result.type === "return") await Effect.runPromise(Fiber.await(result.value));
      }
    },
  };
}

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("restarts the debounce deadline and saves only the final typed number", async () => {
  const f = await fixture();
  f.edits.update(selection(), input("1"));
  await vi.advanceTimersByTimeAsync(700);
  f.edits.update(selection(), input("12"));
  await vi.advanceTimersByTimeAsync(999);
  expect(f.writes).toHaveLength(0);
  expect(f.edits.value("model", "resin")).toBe("12");
  expect(f.collection.hasPendingChanges).toBe(true);
  expect(f.collection.isSaving).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await f.settled();
  expect(f.writes).toEqual([{ [collectionKey("model", "resin")]: { copyNumber: 12 } }]);
  expect(f.notices.map((notice) => notice.message)).toEqual(["Model (Resin) copy number set to 12."]);
  expect(f.collection.hasPendingChanges).toBe(false);
  expect(f.edits.value("model", "resin")).toBeUndefined();
});

it("flushes immediately on blur and ignores duplicate flushes and the old deadline", async () => {
  const f = await fixture();
  const release = f.pause();
  f.edits.update(selection(), input("42"));
  f.edits.flush("model", "resin");
  await f.started();
  f.edits.flush("model", "resin");
  f.edits.flush();
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.run).toHaveBeenCalledTimes(1);
  expect(f.collection.hasPendingChanges).toBe(true);
  await release();
  await f.settled();
  expect(f.writes).toHaveLength(1);
  expect(f.collection.hasPendingChanges).toBe(false);
});

it("Enter flushes while other keys and composing Enter leave the draft pending", async () => {
  const f = await fixture();
  f.edits.update(selection(), input("9"));
  for (const event of [keyboard("Tab"), keyboard("Enter", true)]) {
    f.edits.keydown("model", "resin", event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(f.run).not.toHaveBeenCalled();
  const enter = keyboard("Enter");
  f.edits.keydown("model", "resin", enter);
  expect(enter.defaultPrevented).toBe(true);
  await f.settled();
  expect(f.writes).toHaveLength(1);
});

it("keeps a newer draft when an older in-flight save completes", async () => {
  const f = await fixture();
  const release = f.pause();
  f.edits.update(selection(), input("1"));
  f.edits.flush();
  await f.started();
  f.edits.update(selection(), input("12"));
  await release();
  await f.settled();
  expect(f.edits.value("model", "resin")).toBe("12");
  expect(f.collection.hasPendingChanges).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  await f.settled();
  expect(f.writes.map((snapshot) => snapshot[collectionKey("model", "resin")].copyNumber)).toEqual([1, 12]);
  expect(f.collection.hasPendingChanges).toBe(false);
});

it("isolates editions and items and supports item and app-wide flushes", async () => {
  const f = await fixture();
  f.edits.update(selection(), input("3"));
  f.edits.update(selection("model", "encore"), input("4"));
  f.edits.update(selection("other"), input("5"));
  f.edits.flush("model");
  await f.settled();
  expect(f.collection.get(collectionKey("model", "resin")).copyNumber).toBe(3);
  expect(f.collection.get(collectionKey("model", "encore")).copyNumber).toBe(4);
  expect(f.collection.get(collectionKey("other", "resin")).copyNumber).toBeUndefined();
  expect(f.edits.value("other", "resin")).toBe("5");
  f.edits.flush();
  await f.settled();
  expect(f.collection.get(collectionKey("other", "resin")).copyNumber).toBe(5);
  expect(f.collection.hasPendingChanges).toBe(false);
});

it.each([0, 101, 9999])("saves copy number %s independently of run size", async (value) => {
  const f = await fixture();
  f.edits.update(selection(), input(String(value)));
  f.edits.flush();
  await f.settled();
  expect(f.writes).toHaveLength(1);
  expect(f.collection.get(collectionKey("model", "resin")).copyNumber).toBe(value);
  expect(f.notices.filter((notice) => notice.kind === "error")).toEqual([]);
  expect(f.collection.hasPendingChanges).toBe(false);
});

it.each([input("1.5"), input("-1"), input("10000"), input("", true)])("reports invalid input without saving", async (value) => {
  const f = await fixture();
  f.edits.update(selection(), value);
  f.edits.flush();
  await f.settled();
  expect(f.writes).toHaveLength(0);
  expect(f.notices).toHaveLength(1);
  expect(f.notices[0].kind).toBe("error");
  expect(f.collection.hasPendingChanges).toBe(false);
});

it("clears a number while unchanged values and an already empty number stay silent", async () => {
  const key = collectionKey("model", "resin");
  const f = await fixture({ [key]: { owned: true, copyNumber: 7 } });
  f.edits.update(selection(), input("7"));
  f.edits.flush();
  await f.settled();
  expect(f.notices).toEqual([]);
  expect(f.writes).toEqual([]);
  f.edits.update(selection(), input(""));
  f.edits.flush();
  await f.settled();
  expect(f.collection.get(key)).toEqual({ owned: true });
  expect(f.notices.map((notice) => notice.message)).toEqual(["Model (Resin) copy number cleared."]);
  f.edits.update(selection(), input(""));
  f.edits.flush();
  await f.settled();
  expect(f.writes).toHaveLength(1);
  expect(f.notices).toHaveLength(1);
});

it("clears pending state and reports persistence failure", async () => {
  const f = await fixture();
  f.fail();
  f.edits.update(selection(), input("8"));
  f.edits.flush();
  await f.settled();
  expect(f.collection.hasPendingChanges).toBe(false);
  expect(f.notices.map((notice) => notice.kind)).toEqual(["error"]);
  expect(f.collection.get(collectionKey("model", "resin")).copyNumber).toBeUndefined();
});

it.each([false, true])("discards a captured draft after a session switch (owner change: %s)", async (ownerChange) => {
  const f = await fixture();
  f.edits.update(selection(), input("8"));
  if (ownerChange) f.collection.setUser("another-owner");
  const save = vi.fn(() => Effect.void);
  await Effect.runPromise(f.collection.setStore({ load: () => Effect.succeed({}), save, clear: () => Effect.void }));
  await vi.advanceTimersByTimeAsync(1000);
  await f.settled();
  expect(f.writes).toEqual([]);
  expect(save).not.toHaveBeenCalled();
  expect(f.notices).toEqual([]);
  expect(f.collection.hasPendingChanges).toBe(false);
});

it("the collection flushes registered drafts and stays pending until storage settles", async () => {
  const f = await fixture();
  expect(f.collection.hasPendingChanges).toBe(false);
  const release = f.pause();
  f.edits.update(selection(), input("8"));
  expect(f.collection.hasPendingChanges).toBe(true);
  expect(f.collection.isSaving).toBe(false);
  f.collection.flushPendingEdits();
  await f.started();
  expect(f.collection.hasPendingChanges).toBe(true);
  expect(f.collection.isSaving).toBe(true);
  f.collection.flushPendingEdits();
  expect(f.run).toHaveBeenCalledTimes(1);
  await release();
  await f.settled();
  expect(f.collection.hasPendingChanges).toBe(false);
  expect(f.collection.isSaving).toBe(false);
});
