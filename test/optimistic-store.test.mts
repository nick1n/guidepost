import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import { StoreError } from "../src/lib/state/stores.ts";
import { Deferred, Effect, Exit, Fiber } from "effect";
import { OptimisticStore } from "../src/lib/state/optimistic-store.ts";
import type { CollectionState } from "../src/lib/types/index.ts";

const fixture = Effect.fnUntraced(function* (initial: CollectionState = {}, failures: readonly number[] = []) {
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
  const persist = Effect.fnUntraced(function* (apply: (state: CollectionState) => CollectionState) {
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

it.effect("snapshot saves preserve untouched entries and fields", () =>
  Effect.gen(function* () {
    const f = yield* fixture({ core: { owned: true, versions: ["1.6"] }, dice: { wishlisted: true } });
    const edit = yield* start(f.writer.saveMany({ core: { wishlisted: false } }));
    yield* f.started(0);
    yield* f.release(0);
    assert.ok(Exit.isSuccess(yield* finish(edit)));
    assert.deepEqual(f.disk, {
      core: { owned: true, versions: ["1.6"], wishlisted: false },
      dice: { wishlisted: true },
    });
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
    const f = yield* fixture({ core: { versions: ["1.3"] } }, [0]);
    const first = yield* start(f.writer.saveMany({ core: { versions: ["1.5"] } }));
    yield* f.started(0);
    const second = yield* start(f.writer.saveMany({ core: { versions: ["1.6"] } }));
    yield* f.release(0);
    yield* finish(first);
    yield* f.started(1);
    assert.deepEqual(f.visible.core.versions, ["1.6"]);
    yield* f.release(1);
    yield* finish(second);
    assert.deepEqual(f.disk.core.versions, ["1.6"]);
  }),
);

it.effect("running the same Effect twice keeps each pending write independent", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const action = f.writer.saveMany({ core: { owned: true } });
    const first = yield* start(action);
    yield* f.started(0);
    const second = yield* start(action);
    yield* f.release(0);
    yield* finish(first);
    yield* f.started(1);
    assert.deepEqual(f.visible, { core: { owned: true } });
    yield* f.release(1);
    yield* finish(second);
    assert.deepEqual(f.disk, f.visible);
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
    const second = yield* start(f.writer.saveMany({ core: { wishlisted: true }, dice: { owned: true } }));
    assert.equal(f.visible.dice.owned, true);
    assert.equal(f.visible.core.wishlisted, true);
    assert.equal(f.calls, 1);
    yield* f.release(0);
    assert.ok(Exit.isFailure(yield* finish(first)));
    yield* f.started(1);
    assert.equal(f.visible.core.owned, false);
    assert.equal(f.visible.core.wishlisted, true);
    yield* f.release(1);
    assert.ok(Exit.isSuccess(yield* finish(second)));
    assert.deepEqual(f.disk, { core: { owned: false, wishlisted: true }, dice: { owned: true } });
  }),
);

it.effect("two failed edits restore the last confirmed state", () =>
  Effect.gen(function* () {
    const initial = { core: { owned: false } };
    const f = yield* fixture(initial, [0, 1]);
    const first = yield* start(f.writer.saveMany({ core: { owned: true } }));
    yield* f.started(0);
    const second = yield* start(f.writer.saveMany({ core: { owned: false, wishlisted: true } }));
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
