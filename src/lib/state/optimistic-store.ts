import { Effect, Semaphore } from "effect";
import type { CollectionPatch, CollectionSnapshot } from "#lib/types/index.ts";
import type { CollectionStore } from "./stores.ts";

type Change = { patch: CollectionPatch | null; replacement?: CollectionSnapshot };

function cloneSnapshot(state: CollectionSnapshot): CollectionSnapshot {
  return Object.fromEntries(Object.entries(state).map(([key, entry]) => [key, { ...entry }]));
}

function applyChange(state: CollectionSnapshot, { patch, replacement }: Change): CollectionSnapshot {
  if (replacement !== undefined) return cloneSnapshot(replacement);
  if (patch === null) return {};
  const next = { ...state };
  for (const [id, fields] of Object.entries(patch)) {
    const entry = { ...state[id], ...fields };
    if (fields.copyNumber === undefined && Object.hasOwn(fields, "copyNumber")) delete entry.copyNumber;
    next[id] = entry;
  }
  return next;
}

// Pending changes affect the UI immediately; only persistence waits for a permit.
export class OptimisticStore {
  private readonly writes = Semaphore.makeUnsafe(1);
  private pending: Change[] = [];
  private readonly store: CollectionStore;
  private committed: CollectionSnapshot;
  private readonly publish: (state: CollectionSnapshot) => void;

  constructor(store: CollectionStore, committed: CollectionSnapshot, publish: (state: CollectionSnapshot) => void) {
    this.store = store;
    this.committed = committed;
    this.publish = publish;
  }

  private render() {
    this.publish(this.pending.reduce(applyChange, this.committed));
  }

  load = Effect.fn("OptimisticStore.load")({ self: this }, function () {
    return this.writes.withPermit(
      this.store.load().pipe(
        Effect.tap((state) =>
          Effect.sync(() => {
            this.committed = state;
            this.render();
          }),
        ),
      ),
    );
  });

  saveMany(patch: CollectionPatch) {
    return this.commit(patch);
  }

  clear() {
    return this.commit(null);
  }

  replace(state: CollectionSnapshot) {
    return this.commit({}, cloneSnapshot(state));
  }

  snapshot = Effect.fn("OptimisticStore.snapshot")({ self: this }, function () {
    return this.writes.withPermit(Effect.sync(() => cloneSnapshot(this.committed)));
  });

  private commit = Effect.fn("OptimisticStore.commit")(
    { self: this },
    function* (patch: CollectionPatch | null, replacement?: CollectionSnapshot) {
      const change = { patch, replacement };
      this.pending.push(change);
      this.render();

      const settle = Effect.sync(() => {
        if (!this.pending.includes(change)) return;
        this.pending = this.pending.filter((entry) => entry !== change);
        this.render();
      });

      const persist = Effect.suspend(() => {
        const next = applyChange(this.committed, change);
        const write = change.patch === null ? this.store.clear() : this.store.save(next);
        return write.pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              this.committed = next;
            }),
          ),
        );
      });

      // Once a write starts, finish recording its outcome before allowing the next write.
      // The outer finalizer also removes an edit canceled while waiting for a permit.
      // A timer lets the browser render the pending edit before persistence begins.
      return yield* this.writes
        .withPermit(Effect.sleep(0).pipe(Effect.andThen(persist), Effect.ensuring(settle), Effect.uninterruptible))
        .pipe(Effect.ensuring(settle));
    },
  );
}
