import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoReviewEvent, buildDemoReviewEvents } from './demo-data.mjs';

const pullRequest = {
  number: 42,
  title: 'Improve the parser',
  url: 'https://github.com/example/repo/pull/42',
  author: { login: 'alice', is_bot: false },
  state: 'MERGED',
  mergedAt: '2026-09-20T10:00:00Z',
  closedAt: '2026-09-20T10:00:00Z',
  createdAt: '2026-09-19T10:00:00Z',
  headRefOid: 'a'.repeat(40),
  additions: 120,
  deletions: 15,
  changedFiles: 5,
};

test('builds deterministic synthetic scores around real PR metadata', () => {
  const first = buildDemoReviewEvent(pullRequest, 'example/repo');
  const second = buildDemoReviewEvent(pullRequest, 'example/repo');
  assert.deepEqual(first, second);
  assert.equal(first.event_id, 'demo:example/repo:42:v1');
  assert.equal(first.data_source, 'synthetic_demo');
  assert.equal(first.model, 'synthetic-demo-v1');
  assert.equal(first.pr_state, 'merged');
  assert.equal(first.recorded_at, pullRequest.mergedAt);
  assert.equal(first.ratings.length, 19);
  assert.ok(first.minimum_score >= 6.55 && first.minimum_score <= 9.25);
});

test('excludes bot PRs from demo leaderboards', () => {
  const events = buildDemoReviewEvents([
    pullRequest,
    { ...pullRequest, number: 43, author: { login: 'renovate[bot]', is_bot: true } },
  ], 'example/repo');
  assert.equal(events.length, 1);
  assert.equal(events[0].author_login, 'alice');
});
