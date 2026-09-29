import assert from 'node:assert/strict';
import test from 'node:test';
import { formatComment, marker, publishComment } from './comment.mjs';

const rating = { key: 'security', label: 'Security', applicable: true, score: 8, confidence: 0.8, passed: true, hint: null };
const report = { passed: true, threshold: 7, batches: [{ batch: 1, ratings: [rating] }] };
const head = 'a'.repeat(40);
const runUrl = 'https://github.com/example/repo/actions/runs/123';

test('formats a passing review with linked provenance and ratings', () => {
  const body = formatComment({ report, head, runUrl });
  assert.ok(body.startsWith(marker));
  assert.match(body, /✅ Passed/);
  assert.match(body, /\*\*7\/10\*\*/);
  assert.match(body, /\| Security \| \*\*8.000\*\* \| 80% \| ✅ Pass \|/);
  assert.ok(body.includes(runUrl));
  assert.match(body, /No material weaknesses/);
});

test('displays the lowest score and its own confidence and note across batches', () => {
  const multi = { ...report, passed: false, batches: [
    { batch: 1, ratings: [rating, { key: 'performance', label: 'Performance', applicable: false }] },
    { batch: 2, ratings: [{ ...rating, score: 6, confidence: 0.6, passed: false, hint: 'Check the trust boundary.' }] },
  ] };
  const body = formatComment({ report: multi, head, runUrl });
  assert.match(body, /❌ Changes needed/);
  assert.match(body, /\*\*0\/1\*\*/);
  assert.match(body, /\| Security \| \*\*6.000\*\* \| 60% \| ❌ Below threshold \|/);
  assert.match(body, /Security \(batch 2\):\*\* Check the trust boundary/);
  assert.match(body, /Not applicable/);
  assert.equal(body.split('| Security |').length - 1, 1);
});

test('evaluation errors show an incomplete review instead of a passing result', () => {
  const body = formatComment({ report: null, head, runUrl });
  assert.match(body, /Review could not complete/);
  assert.ok(body.includes(runUrl));
  assert.ok(!body.includes('✅ Passed'));
});

function fixture(comments = [], currentHead = head) {
  const writes = [];
  const context = {
    repo: { owner: 'example', repo: 'repo' }, serverUrl: 'https://github.com', runId: 123,
    payload: { pull_request: { number: 42, head: { sha: head }, base: { ref: 'main' } } },
  };
  const github = {
    rest: {
      pulls: { get: async () => ({ data: { head: { sha: currentHead }, base: { ref: 'main' } } }) },
      issues: {
        listComments: () => {},
        createComment: async (input) => writes.push({ action: 'create', ...input }),
        updateComment: async (input) => writes.push({ action: 'update', ...input }),
      },
    },
    paginate: async () => comments,
  };
  return { github, context, core: { info() {} }, report, writes };
}

test('creates a comment without overwriting a human comment containing the marker', async () => {
  const input = fixture([{ id: 1, user: { login: 'developer', type: 'User' }, body: marker }]);
  await publishComment(input);
  assert.equal(input.writes.length, 1);
  assert.equal(input.writes[0].action, 'create');
  assert.equal(input.writes[0].issue_number, 42);
});

test('updates the existing Actions comment on reruns, including evaluation errors', async () => {
  const input = fixture([{ id: 12, user: { login: 'github-actions[bot]', type: 'Bot' }, body: marker }]);
  await publishComment({ ...input, report: null });
  assert.equal(input.writes.length, 1);
  assert.equal(input.writes[0].action, 'update');
  assert.equal(input.writes[0].comment_id, 12);
  assert.match(input.writes[0].body, /Review could not complete/);
});

test('does not replace the comment when the PR has a newer head', async () => {
  const input = fixture([], 'b'.repeat(40));
  await publishComment(input);
  assert.deepEqual(input.writes, []);
});
