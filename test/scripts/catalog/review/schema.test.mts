import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeReview, parseReview } from "#scripts/catalog/review/schema.mts";

const hash = "a".repeat(64);
const common = () => ({
  preparedAt: "2026-10-01T00:00:00Z",
  baselineHash: hash,
  schemaHash: hash,
  tagsHash: hash,
  tagSchemaHash: hash,
  mappingsHash: hash,
  changes: [
    {
      category: "content",
      itemId: "example",
      differences: [{ field: "item", change: "added" }],
      after: { name: "Example", tags: [], description: "Preserve facts" },
    },
  ],
  unresolved: [],
  excluded: 0,
  warnings: [],
  validation: { items: 1, editions: 0, importRows: 0, schemas: "passed", references: "passed", cycles: "none" },
});
const monthly = () => ({
  ...common(),
  date: "monthly",
  newsHash: hash,
  monthly: {
    posts: { "https://kingdomdeath.com/news/example": hash },
    importsHash: null,
    availability: { checked: 0, available: 0, changed: 0, shopChanged: 0, tagsChanged: 0, unmatched: 0 },
    checkedAt: "2026-10-01T00:00:00Z",
  },
});

it("decodes both review kinds without discarding item facts or stock evidence", () => {
  const tags = { ...common(), date: "tags-only" };
  expect(parseReview(JSON.stringify(tags))).toEqual(tags);
  expect(parseReview(JSON.stringify(monthly()))).toEqual(monthly());
});

it("reports malformed JSON and obsolete review envelopes with regeneration instructions", () => {
  expect(() => parseReview("{")).toThrow(/Malformed.*rerun pnpm catalog:update/);
  expect(() => decodeReview({ changes: [], unresolved: [] })).toThrow(/outdated.*rerun/);
});

it("requires field differences and rejects the retired whole-item before field", () => {
  const review = monthly();
  const { differences: _, ...change } = review.changes[0]!;
  expect(() => decodeReview({ ...review, changes: [change] })).toThrow(/Invalid or outdated/);
  expect(() => decodeReview({ ...review, changes: [{ ...review.changes[0], before: null }] })).toThrow(/Invalid or outdated/);
});

it("keeps invalid review messages concise while retaining the schema cause", () => {
  let error: unknown;
  try {
    decodeReview({ changes: [], unresolved: [] });
  } catch (cause) {
    error = cause;
  }
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe("Invalid or outdated catalog review; rerun pnpm catalog:update or pnpm catalog:tags.");
  expect((error as Error).cause).toBeInstanceOf(Error);
});

it("prints only regeneration instructions for an invalid review at the CLI boundary", () => {
  const root = mkdtempSync(join(tmpdir(), "kdm-invalid-review-"));
  try {
    const path = join(root, "review.json");
    writeFileSync(path, "{}");
    let error: unknown;
    try {
      execFileSync(process.execPath, ["scripts/catalog/commands/apply-catalog.mts", "--review", path], { encoding: "utf8", stdio: "pipe" });
    } catch (cause) {
      error = cause;
    }
    expect(error).toMatchObject({
      status: 1,
      stdout: "",
      stderr: "Invalid or outdated catalog review; rerun pnpm catalog:update or pnpm catalog:tags.\n",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it.each(["baselineHash", "schemaHash", "tagsHash", "tagSchemaHash", "mappingsHash", "newsHash"])(
  "requires the captured %s hash",
  (field) => {
    const review: Record<string, unknown> = monthly();
    delete review[field];
    expect(() => decodeReview(review)).toThrow(/Invalid or outdated/);
  },
);

it("rejects mixed monthly and tag-only evidence and missing import baseline", () => {
  expect(() => decodeReview({ ...monthly(), date: "tags-only" })).toThrow(/Invalid/);
  expect(() => decodeReview({ ...common(), date: "monthly" })).toThrow(/Invalid/);
  const review = monthly();
  const { importsHash: _, ...evidence } = review.monthly;
  expect(() => decodeReview({ ...review, monthly: evidence })).toThrow(/Invalid/);
});

it("requires a real captured timestamp and rejects embedded shop feeds", () => {
  const review = monthly();
  expect(() => decodeReview({ ...review, monthly: { ...review.monthly, checkedAt: "2026-02-30T00:00:00Z" } })).toThrow(/Invalid/);
  expect(() => decodeReview({ ...review, monthly: { ...review.monthly, snapshot: { products: [] } } })).toThrow(/Invalid/);
});

it("rejects invalid change categories, missing item shapes, and malformed decisions", () => {
  const review = monthly();
  expect(() => decodeReview({ ...review, changes: [{ ...review.changes[0], category: "other" }] })).toThrow(/Invalid/);
  expect(() => decodeReview({ ...review, changes: [{ ...review.changes[0], after: null }] })).toThrow(/Invalid/);
  expect(() => decodeReview({ ...review, unresolved: [{ handle: "example" }] })).toThrow(/Invalid/);
});

it("accepts listings without a price unit wrapper and rejects the retired field", () => {
  const listing = { url: "https://example.com", checkedAt: "2026-11-01T00:00:00Z", product: { price: 3000 } };
  const review = { ...monthly(), changes: [{ ...monthly().changes[0], listings: [listing] }] };
  expect(decodeReview(review)).toEqual(review);
  expect(() => decodeReview({ ...review, changes: [{ ...review.changes[0], listings: [{ ...listing, priceUnit: "cents" }] }] })).toThrow(
    /Invalid/,
  );
});
