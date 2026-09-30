import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const repositoryRoot = new URL("../", import.meta.url);
const internalTools = [
  "scripts/jev-review/backfill-rawtree.mjs",
  "scripts/jev-review/backfill-rawtree.test.mjs",
  "scripts/jev-review/demo-data.mjs",
  "scripts/jev-review/demo-data.test.mjs",
  "scripts/jev-review/seed-demo.mjs",
];

test("the OSS package excludes internal migration and synthetic-data tools", () => {
  for (const path of internalTools) {
    assert.equal(existsSync(new URL(path, repositoryRoot)), false, path);
  }
});
