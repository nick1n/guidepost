import Dexie, { liveQuery, type Table } from "dexie";
import { Cause, Effect, Queue, Result, Schema as S, Stream } from "effect";
import {
  CollectionSnapshotSchema,
  EntryStateSchema,
  collectionKey,
  entryId,
  parseCollectionKey,
  type CollectionSnapshot,
  type EntryState,
} from "#lib/types/index.ts";
import { StoreError, type CollectionStore } from "./stores";

const EntryRow = S.Struct({
  id: S.String,
  ownerId: S.String,
  contentId: S.NonEmptyString,
  editionId: S.NonEmptyString,
  state: EntryStateSchema,
});
interface EntryRow extends S.Schema.Type<typeof EntryRow> {}

const Metadata = S.Struct({
  ownerId: S.String,
  schemaVersion: S.Literal(1),
  revision: S.String,
});
interface Metadata extends S.Schema.Type<typeof Metadata> {}

class CollectionDatabase extends Dexie {
  readonly entries: Table<EntryRow, string>;
  readonly metadata: Table<Metadata, string>;

  constructor(name: string) {
    super(name, { autoOpen: false });
    this.version(1).stores({ entries: "id, ownerId", metadata: "ownerId" });
    this.entries = this.table("entries");
    this.metadata = this.table("metadata");
  }
}

const storeError =
  (operation: StoreError["operation"], reason: StoreError["reason"] = "unavailable") =>
  (cause: unknown) =>
    cause instanceof StoreError ? cause : new StoreError({ operation, reason, cause });

/** Local collection snapshots with transactional revision checks against competing tabs. */
export class DexieStore implements CollectionStore {
  private database: CollectionDatabase | undefined;
  private revision: string | undefined;
  private pendingRevision: string | undefined;

  private constructor(
    private readonly ownerId: string,
    private readonly databaseName: string,
  ) {}

  static make(ownerId = "guest", options: { databaseName?: string } = {}) {
    return Effect.sync(() => new DexieStore(ownerId, options.databaseName ?? "guidepost-collection"));
  }

  private open = Effect.fn("DexieStore.open")({ self: this }, function (operation: StoreError["operation"]) {
    return Effect.tryPromise({
      try: async () => {
        this.database ??= new CollectionDatabase(this.databaseName);
        if (!this.database.isOpen()) await this.database.open();
        return this.database;
      },
      catch: storeError(operation),
    });
  });

  readonly changes = Stream.unwrap(
    this.open("load").pipe(
      Effect.map((db) =>
        Stream.callback<boolean, StoreError>((queue) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              const fail = (cause: unknown) => Queue.failCauseUnsafe(queue, Cause.fail(storeError("load")(cause)));
              return liveQuery(() => db.metadata.get(this.ownerId)).subscribe({
                next: (metadata) => {
                  if (!metadata) {
                    Queue.offerUnsafe(queue, this.revision !== undefined);
                    return;
                  }
                  const decoded = S.decodeUnknownResult(Metadata)(metadata);
                  if (Result.isFailure(decoded) || decoded.success.ownerId !== this.ownerId) {
                    fail(new StoreError({ operation: "load", reason: "invalid-data", cause: metadata }));
                    return;
                  }
                  // A commit can notify observers before the writing Effect publishes its revision.
                  Queue.offerUnsafe(
                    queue,
                    this.revision !== undefined && metadata.revision !== this.revision && metadata.revision !== this.pendingRevision,
                  );
                },
                error: fail,
              });
            }),
            (subscription) => Effect.sync(() => subscription.unsubscribe()),
          ),
        ),
      ),
    ),
  );

  load = Effect.fn("DexieStore.load")(
    { self: this },
    function* () {
      const db = yield* this.open("load");
      const snapshot = yield* Effect.tryPromise({
        try: async () => {
          const snapshot = await db.transaction("r", db.entries, db.metadata, async () => ({
            metadata: await db.metadata.get(this.ownerId),
            rows: await db.entries.where("ownerId").equals(this.ownerId).toArray(),
          }));
          if (snapshot.metadata) return snapshot;
          return db.transaction("rw", db.entries, db.metadata, async () => {
            let metadata = await db.metadata.get(this.ownerId);
            if (!metadata) {
              metadata = { ownerId: this.ownerId, schemaVersion: 1, revision: crypto.randomUUID() };
              await db.metadata.add(metadata);
            }
            return { metadata, rows: await db.entries.where("ownerId").equals(this.ownerId).toArray() };
          });
        },
        catch: storeError("load"),
      }).pipe(Effect.uninterruptible);
      const metadata = yield* S.decodeUnknownEffect(Metadata)(snapshot.metadata).pipe(Effect.mapError(storeError("load", "invalid-data")));
      const rows = yield* Effect.try({ try: () => this.decodeRows(snapshot.rows, "load"), catch: storeError("load", "invalid-data") });
      if (metadata.ownerId !== this.ownerId) {
        return yield* Effect.fail(new StoreError({ operation: "load", reason: "invalid-data", cause: "Collection owner is inconsistent" }));
      }
      const state: Record<string, EntryState> = {};
      for (const row of rows) {
        const key = collectionKey(row.contentId, row.editionId);
        state[key] = row.state;
      }
      this.revision = metadata.revision;
      return state;
    },
    (effect) =>
      effect.pipe(
        Effect.tapError(() =>
          Effect.sync(() => {
            this.revision = undefined;
          }),
        ),
      ),
  );

  private decodeRows(rows: unknown, operation: StoreError["operation"]) {
    const decoded = S.decodeUnknownResult(S.Array(EntryRow))(rows);
    if (Result.isFailure(decoded)) throw new StoreError({ operation, reason: "invalid-data", cause: decoded.failure });
    for (const row of decoded.success) {
      if (row.ownerId !== this.ownerId || row.id !== entryId(this.ownerId, collectionKey(row.contentId, row.editionId))) {
        throw new StoreError({ operation, reason: "invalid-data", cause: "Collection row identity is inconsistent" });
      }
    }
    return decoded.success;
  }

  private rows(state: CollectionSnapshot): EntryRow[] {
    return Object.entries(state).map(([key, selection]) => {
      const [contentId, editionId] = parseCollectionKey(key);
      return { id: entryId(this.ownerId, key), ownerId: this.ownerId, contentId, editionId, state: selection };
    });
  }

  private write = Effect.fn("DexieStore.write")({ self: this }, function* (state: CollectionSnapshot, operation: "save" | "clear") {
    const validated = yield* S.decodeUnknownEffect(CollectionSnapshotSchema)(state).pipe(
      Effect.mapError(storeError(operation, "invalid-data")),
    );
    const rows = yield* Effect.try({ try: () => this.rows(validated), catch: storeError(operation, "invalid-data") });
    const expectedRevision = this.revision;
    if (expectedRevision === undefined) {
      return yield* Effect.fail(new StoreError({ operation, reason: "stale", cause: "Load the collection before writing" }));
    }
    const db = yield* this.open(operation);
    const nextRevision = crypto.randomUUID();
    // Settle the transaction before releasing the optimistic queue on cancellation.
    yield* Effect.tryPromise({
      try: () => {
        this.pendingRevision = nextRevision;
        return db.transaction("rw", db.entries, db.metadata, async () => {
          const metadata = await db.metadata.get(this.ownerId);
          if (!metadata || metadata.revision !== expectedRevision) {
            throw new StoreError({ operation, reason: "stale", cause: "Another connection changed the collection" });
          }
          const decoded = S.decodeUnknownResult(Metadata)(metadata);
          if (Result.isFailure(decoded)) {
            throw new StoreError({ operation, reason: "invalid-data", cause: decoded.failure });
          }
          const existing = this.decodeRows(await db.entries.where("ownerId").equals(this.ownerId).toArray(), operation);
          const byId = new Map(existing.map((row) => [row.id, row]));
          const nextIds = new Set(rows.map((row) => row.id));
          const removed = existing.filter((row) => !nextIds.has(row.id)).map((row) => row.id);
          const changed = rows.filter((row) => {
            const previous = byId.get(row.id)?.state;
            return (
              !previous ||
              previous.owned !== row.state.owned ||
              previous.wished !== row.state.wished ||
              previous.copyNumber !== row.state.copyNumber
            );
          });
          if (removed.length) await db.entries.bulkDelete(removed);
          if (changed.length) await db.entries.bulkPut(changed);
          await db.metadata.put({ ...decoded.success, revision: nextRevision });
        });
      },
      catch: storeError(operation),
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          this.revision = nextRevision;
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          this.pendingRevision = undefined;
        }),
      ),
      Effect.uninterruptible,
    );
  });

  save = Effect.fn("DexieStore.save")({ self: this }, function (state: CollectionSnapshot) {
    return this.write(state, "save");
  });

  clear = Effect.fn("DexieStore.clear")({ self: this }, function () {
    return this.write({}, "clear");
  });

  close() {
    this.database?.close();
    this.database = undefined;
    this.revision = undefined;
    this.pendingRevision = undefined;
  }
}
