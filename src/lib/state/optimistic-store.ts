import { Effect, Semaphore } from "effect";
import type { CollectionState } from "#lib/types/index.ts";
import type { CollectionStore } from "./stores.ts";

type Change = { patch: CollectionState | null };

function applyChange(state: CollectionState, { patch }: Change): CollectionState {
  if (patch === null) return {};
  const next = { ...state };
  for (const [id, fields] of Object.entries(patch)) next[id] = { ...state[id], ...fields };
  return next;
}

// Pending changes affect the UI immediately; only persistence waits for a permit.
export class OptimisticStore {
  private readonly writes = Semaphore.makeUnsafe(1);
  private pending: Change[] = [];
  private readonly store: CollectionStore;
  private committed: CollectionState;
  private readonly publish: (state: CollectionState) => void;

  constructor(store: CollectionStore, committed: CollectionState, publish: (state: CollectionState) => void) {
    this.store = store;
    this.committed = committed;
    this.publish = publish;
  }

  private render() {
    this.publish(this.pending.reduce(applyChange, this.committed));
  }

  load = Effect.fn("OptimisticStore.load")({ self: this }, function* () {
    return yield* this.writes.withPermit(
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

  saveMany(patch: CollectionState) {
    return this.commit(patch);
  }

  clear() {
    return this.commit(null);
  }

  private commit = Effect.fn("OptimisticStore.commit")({ self: this }, function* (patch: CollectionState | null) {
    const change = { patch };
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
    // A timer yields to the browser before synchronous JSON/storage work begins.
    return yield* this.writes
      .withPermit(Effect.sleep(0).pipe(Effect.andThen(persist), Effect.ensuring(settle), Effect.uninterruptible))
      .pipe(Effect.ensuring(settle));
  });
}
