import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import { StoreError } from "#lib/state/stores.ts";
import { Deferred, Effect, Exit, Fiber } from "effect";
import { OptimisticStore } from "#lib/state/optimistic-store.ts";
import type { CollectionSnapshot } from "#lib/types/index.ts";

const fixture = Effect.fnUntraced(function* (initial: CollectionSnapshot = {}, failures: readonly number[] = []) {
  let disk = initial;
  let visible = initial;
  let calls = 0;
  const gates = yield* Effect.all(
    Array.from({ length: 4 }, () =>
      Effect.gen(function* () {
        return {
          started: yield* Deferred.make<void>(),
          release: yield* Deferred.make<void>(),
        };
      }),
    ),
  );
  const persist = Effect.fnUntraced(function* (apply: (state: CollectionSnapshot) => CollectionSnapshot) {
    const index = calls++;
    yield* Deferred.succeed(gates[index].started, undefined);
    yield* Deferred.await(gates[index].release);
    if (failures.includes(index))
      return yield* new StoreError({ operation: "save", reason: "unavailable", cause: "Simulated storage failure" });
    disk = apply(disk);
  });
  const writer = new OptimisticStore(
    {
      load: () => Effect.sync(() => disk),
      save: (state) => persist(() => state),
      clear: () => persist(() => ({})),
    },
    initial,
    (state) => {
      visible = state;
    },
  );
  return {
    writer,
    get visible() {
      return visible;
    },
    get disk() {
      return disk;
    },
    get calls() {
      return calls;
    },
    started: (index: number) => TestClock.adjust(0).pipe(Effect.andThen(Deferred.await(gates[index].started))),
    release: (index: number) => Deferred.succeed(gates[index].release, undefined),
  };
});

const start = <A, E>(effect: Effect.Effect<A, E>) => Effect.forkChild(Effect.exit(effect), { startImmediately: true });
const finish = Fiber.join;

for (const fails of [false, true]) {
  it.effect(`snapshot replacement ${fails ? "rolls back" : "persists"} while preserving a newer edit`, () =>
    Effect.gen(function* () {
      const initial = { core: { owned: true } };
      const f = yield* fixture(initial, fails ? [0] : []);
      const restore = yield* start(f.writer.replace({ dice: { copyNumber: 5000 } }));
      yield* f.started(0);
      const edit = yield* start(f.writer.saveMany({ dice: { wished: true } }));
      const exported = yield* start(f.writer.snapshot());
      yield* f.release(0);
      yield* finish(restore);
      yield* f.started(1);
      yield* f.release(1);
      yield* finish(edit);
      const expected = fails ? { ...initial, dice: { wished: true } } : { dice: { copyNumber: 5000, wished: true } };
      const result = yield* finish(exported);
      assert.ok(Exit.isSuccess(result));
      assert.deepEqual(result.value, expected);
      assert.deepEqual(f.visible, expected);
      assert.deepEqual(f.disk, expected);
      result.value.dice.wished = false;
      assert.deepEqual(yield* f.writer.snapshot(), expected);
    }),
  );
}

it.effect("snapshot saves preserve untouched entries and fields", () =>
  Effect.gen(function* () {
    const f = yield* fixture({ core: { owned: true, copyNumber: 16 }, dice: { wished: true } });
    const edit = yield* start(f.writer.saveMany({ core: { wished: false } }));
    yield* TestClock.adjust(0);
    assert.deepEqual(yield* finish(edit), Exit.succeed(false));
    assert.equal(f.calls, 0);
    assert.deepEqual(f.disk, {
      core: { owned: true, copyNumber: 16 },
      dice: { wished: true },
    });
  }),
);

it.effect("clearing a copy number removes its key from optimistic and saved snapshots", () =>
  Effect.gen(function* () {
    const f = yield* fixture({ core: { owned: true, copyNumber: 42 } });
    const edit = yield* start(f.writer.saveMany({ core: { copyNumber: undefined } }));
    assert.deepEqual(f.visible, { core: { owned: true } });
    yield* f.started(0);
    yield* f.release(0);
    assert.ok(Exit.isSuccess(yield* finish(edit)));
    assert.deepEqual(f.disk, { core: { owned: true } });
  }),
);

it.effect("false patches remove empty rows without clearing untouched legacy data", () =>
  Effect.gen(function* () {
    const legacy = { owned: false, wished: false };
    const f = yield* fixture({ core: { owned: true, missing: true }, legacy });
    const edit = yield* start(f.writer.saveMany({ core: { owned: false, missing: false } }));
    assert.deepEqual(f.visible, { legacy });
    yield* f.started(0);
    yield* f.release(0);
    yield* finish(edit);
    assert.deepEqual(f.disk, { legacy });
  }),
);

it.effect("an explicit false patch survives an earlier failure even when its optimistic row disappears", () =>
  Effect.gen(function* () {
    const f = yield* fixture({ core: { wished: true } }, [0]);
    const first = yield* start(f.writer.saveMany({ core: { owned: true, wished: false } }));
    yield* f.started(0);
    const second = yield* start(f.writer.saveMany({ core: { owned: false, wished: false } }));
    assert.deepEqual(f.visible, {});
    yield* f.release(0);
    assert.ok(Exit.isFailure(yield* finish(first)));
    yield* f.started(1);
    assert.deepEqual(f.visible, {});
    yield* f.release(1);
    yield* finish(second);
    assert.deepEqual(f.disk, {});
  }),
);

it.effect("a failed row removal restores the confirmed sparse entry", () =>
  Effect.gen(function* () {
    const initial = { core: { owned: true } };
    const f = yield* fixture(initial, [0]);
    const edit = yield* start(f.writer.saveMany({ core: { owned: false } }));
    assert.deepEqual(f.visible, {});
    yield* f.started(0);
    yield* f.release(0);
    assert.ok(Exit.isFailure(yield* finish(edit)));
    assert.deepEqual(f.visible, initial);
    assert.deepEqual(f.disk, initial);
  }),
);

it.effect("a failed copy number clear restores the confirmed number", () =>
  Effect.gen(function* () {
    const f = yield* fixture({ core: { copyNumber: 42 } }, [0]);
    const edit = yield* start(f.writer.saveMany({ core: { copyNumber: undefined } }));
    assert.deepEqual(f.visible, {});
    yield* f.started(0);
    yield* f.release(0);
    assert.ok(Exit.isFailure(yield* finish(edit)));
    assert.deepEqual(f.visible, { core: { copyNumber: 42 } });
    assert.deepEqual(f.disk, f.visible);
  }),
);

it.effect("canceling a queued edit removes only its patch without persisting it", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const first = yield* start(f.writer.saveMany({ core: { owned: true } }));
    yield* f.started(0);
    const queued = yield* start(f.writer.saveMany({ dice: { owned: true } }));
    assert.equal(f.visible.dice.owned, true);
    yield* Fiber.interrupt(queued);
    assert.deepEqual(f.visible, { core: { owned: true } });
    yield* f.release(0);
    yield* finish(first);
    assert.equal(f.calls, 1);
    assert.deepEqual(f.disk, f.visible);
  }),
);

it.effect("canceling an active write lets it settle before the next save", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const first = yield* start(f.writer.saveMany({ core: { owned: true } }));
    yield* f.started(0);
    const interruption = yield* Effect.forkChild(Fiber.interrupt(first), { startImmediately: true });
    const second = yield* start(f.writer.saveMany({ dice: { owned: true } }));
    assert.equal(f.calls, 1);
    yield* f.release(0);
    yield* Fiber.join(interruption);
    yield* f.started(1);
    assert.deepEqual(f.visible, { core: { owned: true }, dice: { owned: true } });
    yield* f.release(1);
    yield* finish(second);
    assert.deepEqual(f.disk, f.visible);
  }),
);

it.effect("a newer value on the same field survives an earlier failure", () =>
  Effect.gen(function* () {
    const f = yield* fixture({ core: { copyNumber: 1 } }, [0]);
    const first = yield* start(f.writer.saveMany({ core: { copyNumber: 2 } }));
    yield* f.started(0);
    const second = yield* start(f.writer.saveMany({ core: { copyNumber: 3 } }));
    yield* f.release(0);
    yield* finish(first);
    yield* f.started(1);
    assert.equal(f.visible.core.copyNumber, 3);
    yield* f.release(1);
    yield* finish(second);
    assert.equal(f.disk.core.copyNumber, 3);
  }),
);

it.effect("running the same Effect twice skips a queued write after the first succeeds", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const action = f.writer.saveMany({ core: { owned: true } });
    const first = yield* start(action);
    yield* f.started(0);
    const second = yield* start(action);
    yield* f.release(0);
    assert.deepEqual(yield* finish(first), Exit.succeed(true));
    assert.deepEqual(f.visible, { core: { owned: true } });
    yield* TestClock.adjust(0);
    assert.deepEqual(yield* finish(second), Exit.succeed(false));
    assert.equal(f.calls, 1);
    assert.deepEqual(f.disk, f.visible);
  }),
);

it.effect("an identical queued edit persists after the earlier write fails", () =>
  Effect.gen(function* () {
    const f = yield* fixture({}, [0]);
    const action = f.writer.saveMany({ core: { owned: true } });
    const first = yield* start(action);
    yield* f.started(0);
    const second = yield* start(action);
    assert.deepEqual(f.visible, { core: { owned: true } });
    yield* f.release(0);
    assert.ok(Exit.isFailure(yield* finish(first)));
    yield* f.started(1);
    assert.deepEqual(f.visible, { core: { owned: true } });
    assert.deepEqual(f.disk, {});
    yield* f.release(1);
    assert.deepEqual(yield* finish(second), Exit.succeed(true));
    assert.equal(f.calls, 2);
    assert.deepEqual(f.disk, f.visible);
  }),
);

it.effect("false defaults and absent copy numbers do not write an empty snapshot", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const edit = yield* start(f.writer.saveMany({ core: { owned: false, wished: false, missing: false, copyNumber: undefined } }));
    assert.deepEqual(f.visible, {});
    yield* TestClock.adjust(0);
    assert.deepEqual(yield* finish(edit), Exit.succeed(false));
    assert.equal(f.calls, 0);
    assert.deepEqual(f.disk, {});
  }),
);

it.effect("clearing an already empty snapshot does not write", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const reset = yield* start(f.writer.clear());
    yield* TestClock.adjust(0);
    assert.deepEqual(yield* finish(reset), Exit.succeed(false));
    assert.equal(f.calls, 0);
    assert.deepEqual(f.visible, {});
    assert.deepEqual(f.disk, {});
  }),
);

it.effect("an unchanged replacement ignores entry order and false defaults", () =>
  Effect.gen(function* () {
    const initial = { core: { owned: true, copyNumber: 42 }, dice: { wished: true } };
    const f = yield* fixture(initial);
    const replacement = yield* start(
      f.writer.replace({ dice: { wished: true, owned: false }, core: { copyNumber: 42, owned: true }, absent: { missing: false } }),
    );
    yield* TestClock.adjust(0);
    assert.deepEqual(yield* finish(replacement), Exit.succeed(false));
    assert.equal(f.calls, 0);
    assert.deepEqual(f.visible, initial);
    assert.deepEqual(f.disk, initial);
  }),
);

it.effect("effects are lazy; optimistic edits appear before persistence starts", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const action = f.writer.saveMany({ core: { owned: true } });
    assert.deepEqual(f.visible, {});
    const fiber = yield* start(action);
    assert.deepEqual(f.visible, { core: { owned: true } });
    assert.deepEqual(f.disk, {});
    yield* f.started(0);
    yield* f.release(0);
    assert.ok(Exit.isSuccess(yield* finish(fiber)));
    assert.deepEqual(f.disk, f.visible);
  }),
);

it.effect("a failed earlier edit does not erase newer edits or leak into their saved fields", () =>
  Effect.gen(function* () {
    const f = yield* fixture({ core: { owned: false } }, [0]);
    const first = yield* start(f.writer.saveMany({ core: { owned: true } }));
    yield* f.started(0);
    const second = yield* start(f.writer.saveMany({ core: { wished: true }, dice: { owned: true } }));
    assert.equal(f.visible.dice.owned, true);
    assert.equal(f.visible.core.wished, true);
    assert.equal(f.calls, 1);
    yield* f.release(0);
    assert.ok(Exit.isFailure(yield* finish(first)));
    yield* f.started(1);
    assert.equal(f.visible.core.owned, undefined);
    assert.equal(f.visible.core.wished, true);
    yield* f.release(1);
    assert.ok(Exit.isSuccess(yield* finish(second)));
    assert.deepEqual(f.disk, { core: { wished: true }, dice: { owned: true } });
  }),
);

it.effect("two failed edits restore the last confirmed state", () =>
  Effect.gen(function* () {
    const initial = { core: { owned: false } };
    const f = yield* fixture(initial, [0, 1]);
    const first = yield* start(f.writer.saveMany({ core: { owned: true } }));
    yield* f.started(0);
    const second = yield* start(f.writer.saveMany({ core: { owned: false, wished: true } }));
    yield* f.release(0);
    yield* finish(first);
    yield* f.started(1);
    yield* f.release(1);
    yield* finish(second);
    assert.deepEqual(f.visible, initial);
    assert.deepEqual(f.disk, initial);
  }),
);

for (const failReset of [false, true]) {
  it.effect(`an edit after a ${failReset ? "failed" : "successful"} reset survives`, () =>
    Effect.gen(function* () {
      const f = yield* fixture({ core: { owned: true } }, failReset ? [0] : []);
      const reset = yield* start(f.writer.clear());
      assert.deepEqual(f.visible, {});
      yield* f.started(0);
      const edit = yield* start(f.writer.saveMany({ dice: { owned: true } }));
      yield* f.release(0);
      yield* finish(reset);
      yield* f.started(1);
      yield* f.release(1);
      yield* finish(edit);
      assert.deepEqual(f.visible, failReset ? { core: { owned: true }, dice: { owned: true } } : { dice: { owned: true } });
      assert.deepEqual(f.disk, f.visible);
    }),
  );
}

it.effect("a failed reset restores a preceding successful save", () =>
  Effect.gen(function* () {
    const f = yield* fixture({}, [1]);
    const edit = yield* start(f.writer.saveMany({ core: { owned: true } }));
    yield* f.started(0);
    const reset = yield* start(f.writer.clear());
    assert.deepEqual(f.visible, {});
    yield* f.release(0);
    yield* finish(edit);
    yield* f.started(1);
    assert.deepEqual(f.visible, {});
    yield* f.release(1);
    yield* finish(reset);
    assert.deepEqual(f.visible, { core: { owned: true } });
    assert.deepEqual(f.disk, f.visible);
  }),
);
