import "fake-indexeddb/auto";
import Dexie from "dexie";
import { vi } from "vitest";
import { expect, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { deleteDatabases, resetSavedData } from "#lib/app/delete-data.ts";

it.effect("does not reload after deletion fails", () =>
  Effect.gen(function* () {
    const enumerate = vi.spyOn(Dexie, "getDatabaseNames").mockRejectedValueOnce(new Error("Storage unavailable"));
    let reloaded = false;
    const error = yield* resetSavedData({
      prepare: Effect.void,
      stop: Effect.void,
      reload: Effect.sync(() => {
        reloaded = true;
      }),
    }).pipe(Effect.flip);
    expect(error._tag).toBe("ResetError");
    expect(reloaded).toBe(false);
    enumerate.mockRestore();
  }),
);

it.effect("defers reset and waits for storage shutdown before deleting and reloading", () =>
  Effect.gen(function* () {
    const stopping = yield* Deferred.make<void>();
    const stopped = yield* Deferred.make<void>();
    const events: string[] = [];
    const db = new Dexie("reset-order");
    db.version(1).stores({ records: "id" });
    yield* Effect.promise(() => db.open());
    const reset = resetSavedData({
      prepare: Effect.sync(() => {
        events.push("prepare");
      }),
      stop: Effect.gen(function* () {
        yield* Deferred.succeed(stopping, undefined);
        yield* Deferred.await(stopped);
        db.close();
        events.push("stop");
      }),
      reload: Effect.gen(function* () {
        expect(yield* Effect.promise(() => indexedDB.databases())).toEqual([]);
        events.push("reload");
      }),
    });
    expect(events).toEqual([]);
    const fiber = yield* reset.pipe(Effect.forkScoped);
    yield* Deferred.await(stopping);
    expect((yield* Effect.promise(() => indexedDB.databases())).map((db) => db.name)).toContain("reset-order");
    yield* Deferred.succeed(stopped, undefined);
    yield* Fiber.join(fiber);
    expect(events).toEqual(["prepare", "stop", "reload"]);
  }),
);

it.effect("interruption during shutdown prevents deletion and reload", () =>
  Effect.gen(function* () {
    const started = yield* Deferred.make<void>();
    let reloaded = false;
    const enumerate = vi.spyOn(Dexie, "getDatabaseNames");
    const fiber = yield* resetSavedData({
      prepare: Effect.void,
      stop: Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)),
      reload: Effect.sync(() => {
        reloaded = true;
      }),
    }).pipe(Effect.forkScoped);
    yield* Deferred.await(started);
    yield* Fiber.interrupt(fiber);
    const exit = yield* Fiber.await(fiber);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(enumerate).not.toHaveBeenCalled();
    expect(reloaded).toBe(false);
    enumerate.mockRestore();
  }),
);

it("deletes every database, including preferences, other owners, and legacy databases", async () => {
  const names = ["guidepost-collection", "guidepost-preferences", "legacy-data"];
  for (const name of names) {
    const db = new Dexie(name);
    db.version(1).stores({ records: "id" });
    await db.table("records").bulkPut([{ id: "guest" }, { id: "other-owner" }]);
    db.close();
  }
  await Effect.runPromise(deleteDatabases());
  expect(await indexedDB.databases()).toEqual([]);
});

it("reports enumeration failures instead of claiming all data was deleted", async () => {
  const spy = vi.spyOn(Dexie, "getDatabaseNames").mockRejectedValueOnce(new Error("Storage unavailable"));
  try {
    expect(await Effect.runPromise(Effect.flip(deleteDatabases()))).toMatchObject({
      _tag: "ResetError",
      cause: new Error("Storage unavailable"),
    });
  } finally {
    spy.mockRestore();
  }
});

it("reports a blocked database so the user can close other tabs and retry", async () => {
  const connection = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("blocked-data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    expect(await Effect.runPromise(Effect.flip(deleteDatabases()))).toMatchObject({
      _tag: "ResetError",
      cause: "Close other Guidepost tabs, then try again.",
    });
  } finally {
    connection.close();
    await Effect.runPromise(deleteDatabases());
  }
});
