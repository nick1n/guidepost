import assert from "node:assert/strict";
import { test } from "node:test";
import { Data, Deferred, Effect, Exit, Fiber } from "effect";
import { OptimisticStore } from "../src/lib/state/optimistic-store.ts";
import type { CollectionState } from "../src/lib/types/index.ts";

class TestError extends Data.TaggedError("StoreError") {
  readonly operation = "save";
  readonly reason = "unavailable";
  readonly cause = "Simulated storage failure";
  override readonly message = "Storage failed";
}

function fixture(initial: CollectionState = {}, failures: readonly number[] = []) {
  let disk = initial;
  let visible = initial;
  let calls = 0;
  const gates = Array.from({ length: 4 }, () => ({
    started: Effect.runSync(Deferred.make<void>()),
    release: Effect.runSync(Deferred.make<void>()),
  }));
  const persist = (apply: (state: CollectionState) => CollectionState) =>
    Effect.gen(function* () {
      const index = calls++;
      yield* Deferred.succeed(gates[index].started, undefined);
      yield* Deferred.await(gates[index].release);
      if (failures.includes(index)) return yield* new TestError();
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
    started: (index: number) => Effect.runPromise(Deferred.await(gates[index].started)),
    release: (index: number) => Effect.runSync(Deferred.succeed(gates[index].release, undefined)),
  };
}

const start = <A, E>(effect: Effect.Effect<A, E>) => Effect.runFork(Effect.exit(effect));
const finish = <A, E>(fiber: Fiber.Fiber<A, E>) => Effect.runPromise(Fiber.join(fiber));

test("snapshot saves preserve untouched entries and fields", async () => {
  const f = fixture({ core: { owned: true, versions: ["1.6"] }, dice: { wishlisted: true } });
  const edit = start(f.writer.saveMany({ core: { wishlisted: false } }));
  await f.started(0);
  f.release(0);
  assert.ok(Exit.isSuccess(await finish(edit)));
  assert.deepEqual(f.disk, {
    core: { owned: true, versions: ["1.6"], wishlisted: false },
    dice: { wishlisted: true },
  });
});

test("canceling a queued edit removes only its patch without persisting it", async () => {
  const f = fixture();
  const first = start(f.writer.saveMany({ core: { owned: true } }));
  await f.started(0);
  const queued = start(f.writer.saveMany({ dice: { owned: true } }));
  assert.equal(f.visible.dice.owned, true);
  await Effect.runPromise(Fiber.interrupt(queued));
  assert.deepEqual(f.visible, { core: { owned: true } });
  f.release(0);
  await finish(first);
  assert.equal(f.calls, 1);
  assert.deepEqual(f.disk, f.visible);
});

test("canceling an active write lets it settle before the next save", async () => {
  const f = fixture();
  const first = start(f.writer.saveMany({ core: { owned: true } }));
  await f.started(0);
  const interruption = Effect.runFork(Fiber.interrupt(first));
  const second = start(f.writer.saveMany({ dice: { owned: true } }));
  assert.equal(f.calls, 1);
  f.release(0);
  await Effect.runPromise(Fiber.join(interruption));
  await f.started(1);
  assert.deepEqual(f.visible, { core: { owned: true }, dice: { owned: true } });
  f.release(1);
  await finish(second);
  assert.deepEqual(f.disk, f.visible);
});

test("a newer value on the same field survives an earlier failure", async () => {
  const f = fixture({ core: { versions: ["1.3"] } }, [0]);
  const first = start(f.writer.saveMany({ core: { versions: ["1.5"] } }));
  await f.started(0);
  const second = start(f.writer.saveMany({ core: { versions: ["1.6"] } }));
  f.release(0);
  await finish(first);
  await f.started(1);
  assert.deepEqual(f.visible.core.versions, ["1.6"]);
  f.release(1);
  await finish(second);
  assert.deepEqual(f.disk.core.versions, ["1.6"]);
});

test("running the same Effect twice keeps each pending write independent", async () => {
  const f = fixture();
  const action = f.writer.saveMany({ core: { owned: true } });
  const first = start(action);
  await f.started(0);
  const second = start(action);
  f.release(0);
  await finish(first);
  await f.started(1);
  assert.deepEqual(f.visible, { core: { owned: true } });
  f.release(1);
  await finish(second);
  assert.deepEqual(f.disk, f.visible);
});

test("effects are lazy; optimistic edits appear before persistence starts", async () => {
  const f = fixture();
  const action = f.writer.saveMany({ core: { owned: true } });
  assert.deepEqual(f.visible, {});
  const fiber = start(action);
  assert.deepEqual(f.visible, { core: { owned: true } });
  assert.deepEqual(f.disk, {});
  await f.started(0);
  f.release(0);
  assert.ok(Exit.isSuccess(await finish(fiber)));
  assert.deepEqual(f.disk, f.visible);
});

test("a failed earlier edit does not erase newer edits or leak into their saved fields", async () => {
  const f = fixture({ core: { owned: false } }, [0]);
  const first = start(f.writer.saveMany({ core: { owned: true } }));
  await f.started(0);
  const second = start(f.writer.saveMany({ core: { wishlisted: true }, dice: { owned: true } }));
  assert.equal(f.visible.dice.owned, true);
  assert.equal(f.visible.core.wishlisted, true);
  assert.equal(f.calls, 1);
  f.release(0);
  assert.ok(Exit.isFailure(await finish(first)));
  await f.started(1);
  assert.equal(f.visible.core.owned, false);
  assert.equal(f.visible.core.wishlisted, true);
  f.release(1);
  assert.ok(Exit.isSuccess(await finish(second)));
  assert.deepEqual(f.disk, { core: { owned: false, wishlisted: true }, dice: { owned: true } });
});

test("two failed edits restore the last confirmed state", async () => {
  const initial = { core: { owned: false } };
  const f = fixture(initial, [0, 1]);
  const first = start(f.writer.saveMany({ core: { owned: true } }));
  await f.started(0);
  const second = start(f.writer.saveMany({ core: { owned: false, wishlisted: true } }));
  f.release(0);
  await finish(first);
  await f.started(1);
  f.release(1);
  await finish(second);
  assert.deepEqual(f.visible, initial);
  assert.deepEqual(f.disk, initial);
});

for (const failReset of [false, true]) {
  test(`an edit after a ${failReset ? "failed" : "successful"} reset survives`, async () => {
    const f = fixture({ core: { owned: true } }, failReset ? [0] : []);
    const reset = start(f.writer.clear());
    assert.deepEqual(f.visible, {});
    await f.started(0);
    const edit = start(f.writer.saveMany({ dice: { owned: true } }));
    f.release(0);
    await finish(reset);
    await f.started(1);
    f.release(1);
    await finish(edit);
    assert.deepEqual(f.visible, failReset ? { core: { owned: true }, dice: { owned: true } } : { dice: { owned: true } });
    assert.deepEqual(f.disk, f.visible);
  });
}

test("a failed reset restores a preceding successful save", async () => {
  const f = fixture({}, [1]);
  const edit = start(f.writer.saveMany({ core: { owned: true } }));
  await f.started(0);
  const reset = start(f.writer.clear());
  assert.deepEqual(f.visible, {});
  f.release(0);
  await finish(edit);
  await f.started(1);
  assert.deepEqual(f.visible, {});
  f.release(1);
  await finish(reset);
  assert.deepEqual(f.visible, { core: { owned: true } });
  assert.deepEqual(f.disk, f.visible);
});
