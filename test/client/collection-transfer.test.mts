import assert from "node:assert/strict";
import { it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Result } from "effect";
import { vi } from "vitest";
import { FetchHttpClient } from "effect/http";
import workbookMap from "../../static/kdm-catalog/workbook-map.json";
import catalogJson from "../../static/kdm-catalog/data.json";
import { decodeBackup, encodeBackup, previewWorkbookRows, exportWorkbookRows, TransferError } from "#lib/state/collection-transfer.ts";
import { collectionKey, type Catalog } from "#lib/types/index.ts";

vi.mock("$app/paths", () => ({ asset: (path: string) => `https://guidepost.test/test-base/${path}` }));

const data = catalogJson as Catalog;
const mapped = workbookMap.rows[0];
const primaryKey = collectionKey(mapped.primary.contentId, mapped.primary.editionId);

it.effect("exports and restores a versioned collection with stable edition IDs", () =>
  Effect.gen(function* () {
    const entries = { [primaryKey]: { owned: true, wished: false, copyNumber: 42 } };
    const json = yield* encodeBackup(entries, data);
    assert.deepEqual(JSON.parse(json), { formatVersion: 1, entries });
    assert.deepEqual(yield* decodeBackup(json, data), entries);
  }),
);

it.effect("rejects malformed, unsupported, and invalid backups as typed errors", () =>
  Effect.gen(function* () {
    for (const json of [
      "{",
      JSON.stringify({ formatVersion: 2, entries: {} }),
      JSON.stringify({ formatVersion: 1, entries: { [primaryKey]: { copyNumber: "42" } } }),
      JSON.stringify({ formatVersion: 1, entries: {}, extra: true }),
      JSON.stringify({ formatVersion: 1, entries: { [primaryKey]: { owned: true, wished: true } } }),
    ]) {
      const result = yield* Effect.result(decodeBackup(json, data));
      assert.ok(Result.isFailure(result));
      assert.ok(result.failure instanceof TransferError && result.failure.reason === "invalid-data");
    }
  }),
);

it.effect("workbook rows round trip collection fields without labels or personal cells", () =>
  Effect.gen(function* () {
    const entries = yield* previewWorkbookRows(
      [{ sheet: mapped.sheet, row: mapped.row, name: mapped.name, owned: true, copyNumber: 5000 }],
      data,
      workbookMap,
    );
    const rows = yield* exportWorkbookRows(entries, data, workbookMap);
    assert.deepEqual(yield* previewWorkbookRows(rows, data, workbookMap), entries);
    assert.equal(rows[0].editionId, mapped.primary.editionId);
    assert.equal(rows[0].copyNumber, 5000);
    assert.ok(!Object.hasOwn(rows[0], "label"));
  }),
);

it.effect("rejects numbers above a known run size and exports without a workbook mapping", () =>
  Effect.gen(function* () {
    const catalog = {
      content: {
        limited: {
          name: "Limited",
          tags: [],
          editions: [{ id: "limited-run", label: "Renamed label", format: "physical" as const, numbered: true as const, runSize: 5000 }],
        },
      },
      bundles: {},
      homebrew: {},
      accessories: {},
      "included-only": {},
    };
    const key = collectionKey("limited", "limited-run");
    assert.equal(
      (yield* Effect.flip(decodeBackup(JSON.stringify({ formatVersion: 1, entries: { [key]: { copyNumber: 5001 } } }), catalog))).reason,
      "invalid-data",
    );
    const valid = { [key]: { copyNumber: 5000 } };
    assert.deepEqual(yield* decodeBackup(yield* encodeBackup(valid, catalog), catalog), valid);
    assert.equal((yield* Effect.flip(exportWorkbookRows(valid, catalog, workbookMap))).reason, "unknown-reference");
  }),
);

it.effect("rejects duplicate workbook selections and conflicting related ownership", () =>
  Effect.gen(function* () {
    const row = { sheet: mapped.sheet, row: mapped.row, name: mapped.name, owned: true };
    assert.equal((yield* Effect.flip(previewWorkbookRows([row, row], data, workbookMap))).reason, "invalid-data");
    const source = workbookMap.rows.find((row) => row.ownershipScope === "source-row" && row.related?.length)!;
    const entries = yield* previewWorkbookRows(
      [{ sheet: source.sheet, row: source.row, name: source.name, owned: true }],
      data,
      workbookMap,
    );
    const key = collectionKey(source.related![0].contentId, source.related![0].editionId);
    const inconsistent = { ...entries, [key]: { owned: false } };
    assert.equal((yield* Effect.flip(exportWorkbookRows(inconsistent, data, workbookMap))).reason, "invalid-data");
  }),
);

it.effect("rejects collection keys missing from the current catalog", () =>
  Effect.gen(function* () {
    const json = JSON.stringify({ formatVersion: 1, entries: { [collectionKey("missing-item", "item")]: { owned: true } } });
    const result = yield* Effect.result(decodeBackup(json, data));
    assert.ok(Result.isFailure(result));
    assert.ok(result.failure instanceof TransferError && result.failure.reason === "unknown-reference");
  }),
);

it.effect("requires the workbook row name and exact release selection", () =>
  Effect.gen(function* () {
    const mismatch = yield* Effect.result(
      previewWorkbookRows([{ sheet: mapped.sheet, row: mapped.row, name: "Changed name", owned: true }], data, workbookMap),
    );
    assert.ok(Result.isFailure(mismatch));
    assert.ok(mismatch.failure instanceof TransferError && mismatch.failure.reason === "unknown-reference");

    const ambiguous = workbookMap.rows.find((row) =>
      Object.values(row.releaseEditions ?? {}).some((alternatives) => alternatives.length > 1),
    );
    assert.ok(ambiguous);
    const [column, alternatives] = Object.entries(ambiguous.releaseEditions ?? {}).find(([, targets]) => targets.length > 1)!;
    const row = { sheet: ambiguous.sheet, row: ambiguous.row, name: ambiguous.name, owned: true, releaseColumn: column };
    const unresolved = yield* Effect.result(previewWorkbookRows([row], data, workbookMap));
    assert.ok(Result.isFailure(unresolved));
    assert.ok(unresolved.failure instanceof TransferError && unresolved.failure.reason === "ambiguous");

    const selected = yield* previewWorkbookRows([{ ...row, editionId: alternatives[0].editionId }], data, workbookMap);
    assert.deepEqual(selected[collectionKey(alternatives[0].contentId, alternatives[0].editionId)], { owned: true, wished: false });
  }),
);

it.effect("propagates source-row ownership to explicitly related editions", () =>
  Effect.gen(function* () {
    const source = workbookMap.rows.find((row) => row.ownershipScope === "source-row" && row.related?.length);
    assert.ok(source);
    const snapshot = yield* previewWorkbookRows(
      [{ sheet: source.sheet, row: source.row, name: source.name, owned: true, copyNumber: 7 }],
      data,
      workbookMap,
    );
    for (const target of [source.primary, ...(source.related ?? [])]) {
      assert.deepEqual(snapshot[collectionKey(target.contentId, target.editionId)], {
        owned: true,
        wished: false,
        ...(target === source.primary ? { copyNumber: 7 } : {}),
      });
    }
  }),
);

it.effect("rejects invalid workbook number cells", () =>
  Effect.gen(function* () {
    for (const copyNumber of ["7", 0, 10000, 1.5]) {
      const result = yield* Effect.result(
        previewWorkbookRows([{ sheet: mapped.sheet, row: mapped.row, name: mapped.name, copyNumber }], data, workbookMap),
      );
      assert.ok(Result.isFailure(result));
      assert.ok(result.failure instanceof TransferError && result.failure.reason === "invalid-data");
    }
    assert.ok(data.content[mapped.primary.contentId]);
  }),
);

it.effect("reports unrepresentable release alternatives as an export error", () =>
  Effect.gen(function* () {
    const catalog = {
      content: {
        model: {
          name: "Model",
          tags: [],
          editions: ["primary", "first", "second"].map((id) => ({ id, label: id, format: "physical" as const })),
        },
      },
      bundles: {},
      accessories: {},
      homebrew: {},
      "included-only": {},
    };
    const target = (editionId: string) => ({ category: "content", contentId: "model", editionId });
    const mapping = {
      $schema: "./workbook-map.schema.json",
      source: { id: "kdm-collection-sheets", workbook: "Products.xlsx" },
      formatVersion: 1,
      rows: [
        {
          sheet: "KDM Miniatures",
          row: 2,
          name: "Model",
          primary: target("primary"),
          releaseEditions: { M: [target("first"), target("second")] },
        },
      ],
    };
    const entries = { [collectionKey("model", "first")]: { wished: true }, [collectionKey("model", "second")]: { wished: true } };
    const error = yield* Effect.flip(exportWorkbookRows(entries, catalog, mapping));
    assert.equal(error.message, 'Workbook selection ["KDM Miniatures",2,"M"] appears more than once.');
    assert.equal(error.operation, "export");
    assert.equal(error.reason, "invalid-data");
  }),
);

it.effect("rejects malformed mappings at both workbook action interfaces", () =>
  Effect.gen(function* () {
    const source = workbookMap.rows.find((row) => row.related?.length)!;
    const valid = { ...workbookMap, rows: [source] };
    const { ownershipScope: _scope, ...withoutScope } = source;
    for (const mapping of [
      { ...valid, rows: [{ ...source, row: 1 }] },
      { ...valid, rows: [withoutScope] },
      { ...valid, rows: [{ ...source, notes: "Personal cells" }] },
      { ...valid, rows: [{ ...source, releaseEditions: { M: [source.primary, source.primary] } }] },
      { ...valid, source: { ...valid.source, id: "another-workbook" } },
      { ...valid, rows: [source, { ...source, name: "Other product" }] },
    ]) {
      const preview = yield* Effect.flip(previewWorkbookRows([], data, mapping));
      const exported = yield* Effect.flip(exportWorkbookRows({}, data, mapping));
      for (const error of [preview, exported]) {
        assert.ok(error instanceof TransferError);
        assert.equal(error.reason, "invalid-data");
        assert.equal(error.message, "Workbook mapping is invalid.");
      }
    }
    for (const row of [
      { sheet: source.sheet, row: 1, name: source.name },
      { sheet: source.sheet, row: source.row, name: source.name, notes: "Private" },
    ]) {
      assert.equal((yield* Effect.flip(previewWorkbookRows([row], data, valid))).message, "Workbook rows are invalid.");
    }
  }),
);

it.effect("loads the workbook map from the deployment's asset path", () =>
  Effect.gen(function* () {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json(workbookMap));
    assert.deepEqual(yield* previewWorkbookRows([], data).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)), {});
    assert.equal(String(fetch.mock.calls[0][0]), "https://guidepost.test/test-base/kdm-catalog/workbook-map.json");
    assert.ok(fetch.mock.calls[0][1]?.signal instanceof AbortSignal);
  }),
);

for (const [failure, response] of [
  ["HTTP failure", () => Promise.resolve(new Response("Missing", { status: 404 }))],
  ["network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
  ["invalid JSON", () => Promise.resolve(new Response("not JSON"))],
] as const) {
  it.effect(`reports a typed workbook load error after ${failure}`, () =>
    Effect.gen(function* () {
      const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(response);
      for (const action of [Effect.asVoid(previewWorkbookRows([], data)), Effect.asVoid(exportWorkbookRows({}, data))]) {
        const error = yield* Effect.flip(action.pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)));
        assert.ok(error instanceof TransferError);
        assert.equal(error.reason, "invalid-data");
        assert.equal(error.message, "Workbook mapping could not be loaded.");
      }
    }),
  );
}

it.effect("validates downloaded mapping data before preview or export", () =>
  Effect.gen(function* () {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json({ ...workbookMap, privateCells: [] }));
    for (const action of [Effect.asVoid(previewWorkbookRows([], data)), Effect.asVoid(exportWorkbookRows({}, data))]) {
      assert.equal(
        (yield* Effect.flip(action.pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)))).message,
        "Workbook mapping is invalid.",
      );
    }
  }),
);

for (const phase of ["request", "response body"] as const) {
  it.effect(`aborts the workbook ${phase} when its transfer is interrupted`, () =>
    Effect.gen(function* () {
      const started = yield* Deferred.make<AbortSignal>();
      const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation((_, options) => {
        const signal = options?.signal;
        assert.ok(signal);
        if (phase === "request") {
          return new Promise((_, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
            Effect.runSync(Deferred.succeed(started, signal));
          });
        }
        const body = new ReadableStream<Uint8Array>(
          {
            pull(controller) {
              signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
              Effect.runSync(Deferred.succeed(started, signal));
            },
          },
          { highWaterMark: 0 },
        );
        return Promise.resolve(new Response(body));
      });
      const active = yield* Effect.forkChild(previewWorkbookRows([], data).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)));
      const signal = yield* Deferred.await(started);
      yield* Fiber.interrupt(active);
      const result = yield* Fiber.await(active);
      assert.ok(Exit.isFailure(result) && Cause.hasInterrupts(result.cause));
      assert.equal(signal.aborted, true);
    }),
  );
}
