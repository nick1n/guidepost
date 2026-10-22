import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { catalogCache, catalogLocal, catalogTemp } from "#scripts/catalog/paths.mts";

test("catalog paths follow the supplied workspace and separate retained inputs, caches, and reports", () => {
  for (const workspace of [resolve("temp/path-fixture-a"), resolve("temp/path-fixture-b")]) {
    const catalog = resolve(workspace, "static/kdm/catalog");
    assert.equal(catalogLocal(catalog), resolve(workspace, "local-data/kdm-catalog"));
    assert.equal(catalogCache(catalog), resolve(workspace, ".cache/kdm-catalog"));
    assert.equal(catalogTemp(catalog), resolve(workspace, "temp/kdm-catalog"));
    assert.equal(new Set([catalogLocal(catalog), catalogCache(catalog), catalogTemp(catalog)]).size, 3);
  }
});
