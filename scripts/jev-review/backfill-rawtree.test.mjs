import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBackfillReviewEvent, selectBackfillArtifacts } from './backfill-rawtree.mjs';

test('selects retained completed PR review artifacts and excludes cancelled runs', () => {
  const artifacts = [{ artifacts: [
    { id: 1, name: 'jev-review-a', expired: false, created_at: '2026-09-20T00:00:00Z', workflow_run: { id: 10 } },
    { id: 2, name: 'jev-review-b', expired: false, created_at: '2026-09-19T00:00:00Z', workflow_run: { id: 11 } },
    { id: 3, name: 'other', expired: false, created_at: '2026-09-18T00:00:00Z', workflow_run: { id: 12 } },
  ] }];
  const runs = [{ workflow_runs: [
    { id: 10, event: 'pull_request', status: 'completed', conclusion: 'success' },
    { id: 11, event: 'pull_request', status: 'completed', conclusion: 'cancelled' },
    { id: 12, event: 'pull_request', status: 'completed', conclusion: 'success' },
  ] }];

  assert.deepEqual(selectBackfillArtifacts(artifacts, runs).map(({ artifact }) => artifact.id), [1]);
});

test('preserves artifact provenance instead of the PR current head', () => {
  const report = {
    head: 'a'.repeat(40),
    base: 'b'.repeat(40),
    model: 'jev-latest',
    threshold: 7,
    passed: true,
    batches: [{ batch: 1, ratings: [
      { key: 'correctness', label: 'Correctness', applicable: true, score: 8, confidence: 0.8, passed: true, hint: null },
    ] }],
  };
  const event = buildBackfillReviewEvent({
    report,
    repository: 'example/repo',
    pullRequest: {
      number: 42,
      title: 'Reviewed PR',
      html_url: 'https://github.com/example/repo/pull/42',
      user: { login: 'alice', id: 123 },
      head: { sha: 'c'.repeat(40) },
      base: { sha: 'd'.repeat(40), ref: 'main' },
    },
    run: { id: 987, run_attempt: 2, head_sha: 'a'.repeat(40) },
    artifact: { id: 654, created_at: '2026-09-20T12:00:00Z' },
  });

  assert.equal(event.event_id, `example/repo:42:${'a'.repeat(40)}:987:2`);
  assert.equal(event.recorded_at, '2026-09-20T12:00:00Z');
  assert.equal(event.head_sha, 'a'.repeat(40));
  assert.equal(event.base_sha, 'b'.repeat(40));
  assert.equal(event.data_source, 'jev');
});

test('rejects an artifact attached to a different workflow head', () => {
  assert.throws(() => buildBackfillReviewEvent({
    report: { head: 'a'.repeat(40) },
    pullRequest: {},
    run: { id: 987, head_sha: 'b'.repeat(40) },
    artifact: { id: 654 },
    repository: 'example/repo',
  }), /head does not match/);
});
