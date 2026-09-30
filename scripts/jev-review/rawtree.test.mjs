import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewEvent, insertReviewEvent, insertReviewEvents } from './rawtree.mjs';

const pullRequest = {
  number: 42,
  title: 'Improve the parser',
  html_url: 'https://github.com/example/repo/pull/42',
  user: { login: 'alice', id: 123 },
  head: { sha: 'a'.repeat(40) },
  base: { sha: 'b'.repeat(40), ref: 'main' },
};
const environment = {
  GITHUB_REPOSITORY: 'example/repo',
  GITHUB_RUN_ID: '987',
  GITHUB_RUN_ATTEMPT: '2',
  GITHUB_SERVER_URL: 'https://github.example',
};

test('builds one queryable event using the lowest rating per dimension', () => {
  const report = {
    model: 'jev-latest', threshold: 7, passed: false, batches: [
      { batch: 1, ratings: [
        { key: 'correctness', label: 'Correctness', applicable: true, score: 8, confidence: 0.9, passed: true, hint: null },
        { key: 'security', label: 'Security', applicable: false },
      ] },
      { batch: 2, ratings: [
        { key: 'correctness', label: 'Correctness', applicable: true, score: 6, confidence: 0.8, passed: false, hint: 'Check an edge case.' },
        { key: 'readability', label: 'Readability', applicable: true, score: 9, confidence: 0.7, passed: true, hint: null },
      ] },
    ],
  };
  const event = buildReviewEvent({ report, pullRequest, environment, recordedAt: '2026-09-25T12:00:00.000Z' });

  assert.equal(event.event_id, `example/repo:42:${'a'.repeat(40)}:987:2`);
  assert.equal(event.author_login, 'alice');
  assert.equal(event.data_source, 'jev');
  assert.equal(event.minimum_score, 6);
  assert.equal(event.average_score, 7.5);
  assert.equal(event.applicable_dimensions, 2);
  assert.equal(event.passed_dimensions, 1);
  assert.deepEqual(event.ratings.map(({ key, score }) => [key, score]), [
    ['correctness', 6], ['security', undefined], ['readability', 9],
  ]);
});

test('inserts the event with a write-only key and optional database selector', async () => {
  const event = { event_type: 'jev_pr_review' };
  let request;
  await insertReviewEvent({
    event,
    apiKey: 'rt_test',
    table: 'PR reviews',
    database: 'engineering analytics',
    baseUrl: 'https://rawtree.example/base',
    fetch: async (url, options) => {
      request = { url: String(url), options };
      return new Response('{}', { status: 200 });
    },
  });

  assert.equal(request.url, 'https://rawtree.example/v1/tables/PR%20reviews');
  const headers = new Headers(request.options.headers);
  assert.equal(headers.get('authorization'), 'Bearer rt_test');
  assert.equal(headers.get('x-rawtree-database'), 'engineering analytics');
  assert.deepEqual(JSON.parse(request.options.body), [event]);
});

test('inserts multiple review events as one batch', async () => {
  const events = [{ event_id: 'one' }, { event_id: 'two' }];
  let body;
  await insertReviewEvents({
    events, apiKey: 'rt_test',
    fetch: async (_url, options) => {
      body = JSON.parse(options.body);
      return new Response('{}', { status: 200 });
    },
  });
  assert.deepEqual(body, events);
});

test('does not expose a Rawtree response body when an insert fails', async () => {
  await assert.rejects(insertReviewEvent({
    event: {}, apiKey: 'rt_test',
    fetch: async () => Response.json({ message: 'private event data' }, { status: 403 }),
  }), (error) => /HTTP 403/.test(error.message) && !error.message.includes('private'));
});
