import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/jev-review.yml", import.meta.url),
  "utf8"
);

test("self-review forwards its secrets and repository policy to the action", () => {
  assert.match(workflow, /jev-api-key: \$\{\{ secrets\.JEV_API_KEY \}\}/);
  assert.match(
    workflow,
    /minimum-score: \$\{\{ vars\.JEV_MIN_SCORE \|\| '7' \}\}/
  );
  assert.match(
    workflow,
    /rawtree-api-key: \$\{\{ secrets\.RAWTREE_JEV_API_KEY \}\}/
  );
  assert.match(
    workflow,
    /rawtree-database: \$\{\{ vars\.RAWTREE_JEV_DATABASE \}\}/
  );
});
