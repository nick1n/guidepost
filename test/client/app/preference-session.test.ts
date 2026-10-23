import { expect, it } from "@effect/vitest";
import { vi } from "vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Queue } from "effect";
import { AppPreferences } from "#lib/app/preferences/preferences.svelte.ts";
import { appDefaults, AppStorageError, type AppPreferenceStore, type AppValues } from "#lib/app/preferences/preference-store.ts";
import { HuntPreferences } from "#lib/kdm/hunt/preferences.svelte.ts";
import { huntDefaults, HuntStorageError, type HuntPreferenceStore, type HuntValues } from "#lib/kdm/hunt/preference-store.ts";

type MutablePatch = { -readonly [Key in keyof AppValues]?: AppValues[Key] };

it("prevents persisted values from bypassing preference commands", () => {
  const app = new AppPreferences();
  const hunt = new HuntPreferences();
  expect(Reflect.set(app, "dateFormat", "written")).toBe(false);
  expect(Reflect.set(app, "glass", false)).toBe(false);
  expect(Reflect.set(hunt, "option", "ccg")).toBe(false);
  expect(Reflect.set(hunt, "bravadoBeta", true)).toBe(false);
  expect(app).toMatchObject(appDefaults);
  expect(hunt).toMatchObject(huntDefaults);
  expect(app.hasPendingChanges).toBe(false);
  expect(hunt.hasPendingChanges).toBe(false);
});

it.effect("keeps load and save errors distinct and only clears failed app fields after an explicit successful save", () =>
  Effect.gen(function* () {
    const loadError = new AppStorageError({ operation: "load", cause: "Unreadable record" });
    const saveError = new AppStorageError({ operation: "save", cause: "Quota" });
    const attempts = yield* Queue.make<Partial<AppValues>>();
    const outcomes = yield* Queue.make<Effect.Effect<void, AppStorageError>>();
    const record = vi.fn();
    const store: AppPreferenceStore = {
      load: () => Effect.fail(loadError),
      save: (patch) => Queue.offer(attempts, patch).pipe(Effect.andThen(Queue.take(outcomes)), Effect.flatten),
      close: vi.fn(),
    };
    const preferences = new AppPreferences(record, Effect.succeed(store));
    const worker = yield* Effect.forkChild(preferences.run(), { startImmediately: true });
    expect(preferences.ready).toBe(true);
    expect(preferences.loadError).toBe(loadError.message);
    expect(preferences.saveError).toBeUndefined();

    preferences.save({ dateFormat: "written" });
    expect(yield* Queue.take(attempts)).toEqual({ dateFormat: "written" });
    expect(preferences.hasPendingChanges).toBe(true);
    yield* Queue.offer(outcomes, Effect.fail(saveError));
    yield* Effect.yieldNow;
    expect(preferences.dateFormat).toBe("written");
    expect(preferences.saveError).toBe(saveError.message);
    expect(preferences.hasPendingChanges).toBe(false);
    expect(yield* Queue.size(attempts)).toBe(0);

    preferences.save({ glass: false });
    expect(yield* Queue.take(attempts)).toEqual({ glass: false });
    yield* Queue.offer(outcomes, Effect.void);
    yield* Effect.yieldNow;
    expect(preferences.saveError).toBe(saveError.message);
    expect(preferences.loadError).toBe(loadError.message);

    preferences.save({ dateFormat: "written" });
    expect(yield* Queue.take(attempts)).toEqual({ dateFormat: "written" });
    yield* Queue.offer(outcomes, Effect.void);
    yield* Effect.yieldNow;
    expect(preferences.saveError).toBeUndefined();
    expect(preferences.loadError).toBe(loadError.message);
    expect(preferences.hasPendingChanges).toBe(false);
    yield* Fiber.interrupt(worker);
    expect(store.close).toHaveBeenCalledOnce();
  }),
);

it.effect("retains hunt save errors until every failed field is explicitly saved", () =>
  Effect.gen(function* () {
    const attempts = yield* Queue.make<Partial<HuntValues>>();
    const outcomes = yield* Queue.make<Effect.Effect<void, HuntStorageError>>();
    const error = new HuntStorageError({ operation: "save", cause: "Quota" });
    const store: HuntPreferenceStore = {
      load: () => Effect.succeed(huntDefaults),
      save: (patch) => Queue.offer(attempts, patch).pipe(Effect.andThen(Queue.take(outcomes)), Effect.flatten),
      close: vi.fn(),
    };
    const preferences = new HuntPreferences(vi.fn(), Effect.succeed(store));
    const worker = yield* Effect.forkChild(preferences.run(), { startImmediately: true });
    preferences.setBravadoBeta(true);
    preferences.setDevilSatan(true);
    expect(yield* Queue.take(attempts)).toEqual({ bravadoBeta: true });
    yield* Queue.offer(outcomes, Effect.fail(error));
    expect(yield* Queue.take(attempts)).toEqual({ devilSatan: true });
    yield* Queue.offer(outcomes, Effect.fail(error));
    yield* Effect.yieldNow;
    expect(preferences).toMatchObject({ bravadoBeta: true, devilSatan: true, hasPendingChanges: false, saveError: error.message });

    preferences.setGregalopeCE(true);
    expect(yield* Queue.take(attempts)).toEqual({ gregalopeCE: true });
    yield* Queue.offer(outcomes, Effect.void);
    yield* Effect.yieldNow;
    expect(preferences.saveError).toBe(error.message);
    preferences.setBravadoBeta(true);
    expect(yield* Queue.take(attempts)).toEqual({ bravadoBeta: true });
    yield* Queue.offer(outcomes, Effect.void);
    yield* Effect.yieldNow;
    expect(preferences.saveError).toBe(error.message);
    preferences.setDevilSatan(false);
    expect(yield* Queue.take(attempts)).toEqual({ devilSatan: false });
    yield* Queue.offer(outcomes, Effect.void);
    yield* Effect.yieldNow;
    expect(preferences.saveError).toBeUndefined();
    expect(preferences.loadError).toBeUndefined();
    expect(preferences.hasPendingChanges).toBe(false);
    yield* Fiber.interrupt(worker);
    expect(store.close).toHaveBeenCalledOnce();
  }),
);

it.effect("snapshots caller-owned app patches before startup and while queued", () =>
  Effect.gen(function* () {
    const loaded = yield* Deferred.make<AppValues>();
    const release = yield* Deferred.make<void>();
    const attempts = yield* Queue.make<Partial<AppValues>>();
    const store: AppPreferenceStore = {
      load: () => Deferred.await(loaded),
      save: (patch) => Queue.offer(attempts, patch).pipe(Effect.andThen(Deferred.await(release))),
      close: vi.fn(),
    };
    const preferences = new AppPreferences(vi.fn(), Effect.succeed(store));
    const first: MutablePatch = { dateFormat: "written" };
    preferences.save(first);
    first.dateFormat = "day-first";
    first.glass = true;
    const worker = yield* Effect.forkChild(preferences.run(), { startImmediately: true });
    yield* Deferred.succeed(loaded, appDefaults);
    expect(yield* Queue.take(attempts)).toEqual({ dateFormat: "written" });
    const second: MutablePatch = { glass: false };
    preferences.save(second);
    second.glass = true;
    second.dateFormat = "month-first";
    yield* Deferred.succeed(release, undefined);
    expect(yield* Queue.take(attempts)).toEqual({ glass: false });
    expect(preferences).toMatchObject({ dateFormat: "written", glass: false });
    yield* Fiber.interrupt(worker);
  }),
);

it.effect("rejects a duplicate run without closing or disabling the original app worker", () =>
  Effect.gen(function* () {
    const loaded = yield* Deferred.make<AppValues>();
    const attempts = yield* Queue.make<Partial<AppValues>>();
    const close = vi.fn();
    const open = vi.fn(() =>
      Effect.succeed<AppPreferenceStore>({
        load: () => Deferred.await(loaded),
        save: (patch) => Queue.offer(attempts, patch).pipe(Effect.asVoid),
        close,
      }),
    );
    const record = vi.fn();
    const preferences = new AppPreferences(record, Effect.suspend(open));
    const worker = yield* Effect.forkChild(preferences.run(), { startImmediately: true });
    const duplicate = yield* Effect.exit(preferences.run());
    expect(Exit.isFailure(duplicate) && Cause.hasDies(duplicate.cause)).toBe(true);
    expect(open).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    preferences.save({ glass: false });
    yield* Deferred.succeed(loaded, { ...appDefaults, dateFormat: "written" } satisfies AppValues);
    expect(yield* Queue.take(attempts)).toEqual({ glass: false });
    expect(preferences).toMatchObject({ dateFormat: "written", glass: false, ready: true });
    yield* Fiber.interrupt(worker);
    expect(close).toHaveBeenCalledOnce();
    expect(Exit.isFailure(yield* Effect.exit(preferences.run()))).toBe(true);
    expect(open).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  }),
);

it.effect("exposes startup load failure, clears pending writes, and reports later in-memory hunt edits as unsaved", () =>
  Effect.gen(function* () {
    const opened = yield* Deferred.make<HuntPreferenceStore, HuntStorageError>();
    const loadError = new HuntStorageError({ operation: "load", cause: "Module unavailable" });
    const record = vi.fn();
    const preferences = new HuntPreferences(record, Deferred.await(opened));
    preferences.setBravadoBeta(true);
    const worker = yield* Effect.forkChild(preferences.run(), { startImmediately: true });
    expect(preferences.hasPendingChanges).toBe(true);
    yield* Deferred.fail(opened, loadError);
    yield* Fiber.join(worker);
    expect(preferences).toMatchObject({ ready: true, bravadoBeta: true, hasPendingChanges: false, loadError: loadError.message });
    preferences.setOption("ccg");
    yield* Effect.yieldNow;
    expect(preferences.option).toBe("ccg");
    expect(preferences.hasPendingChanges).toBe(false);
    expect(preferences.loadError).toBe(loadError.message);
    expect(preferences.saveError).toBe(new HuntStorageError({ operation: "save", cause: "Closed" }).message);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ message: preferences.saveError }));
  }),
);

it.effect("preserves mixed write interruptions without notifications or late state changes and closes once", () =>
  Effect.gen(function* () {
    const started = yield* Deferred.make<void>();
    const result = yield* Deferred.make<void, HuntStorageError>();
    const error = new HuntStorageError({ operation: "save", cause: "Denied" });
    const record = vi.fn();
    const close = vi.fn();
    const store: HuntPreferenceStore = {
      load: () => Effect.succeed(huntDefaults),
      save: () => Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(result))),
      close,
    };
    const preferences = new HuntPreferences(record, Effect.succeed(store));
    const worker = yield* Effect.forkChild(preferences.run(), { startImmediately: true });
    preferences.setOption("ccg");
    preferences.setDevilSatan(true);
    yield* Deferred.await(started);
    yield* Deferred.failCause(result, Cause.combine(Cause.fail(error), Cause.interrupt(123)));
    const exit = yield* Fiber.await(worker);
    expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
    expect(preferences).toMatchObject({ option: "ccg", devilSatan: true, hasPendingChanges: false });
    expect(preferences.loadError).toBeUndefined();
    expect(preferences.saveError).toBeUndefined();
    expect(record).not.toHaveBeenCalled();
    yield* Deferred.succeed(result, undefined);
    yield* Fiber.interrupt(worker);
    expect(preferences).toMatchObject({ option: "ccg", devilSatan: true, hasPendingChanges: false });
    expect(close).toHaveBeenCalledOnce();
  }),
);
