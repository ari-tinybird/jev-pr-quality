import { createHash } from 'node:crypto';
import metrics from './metrics.json' with { type: 'json' };
import { buildReviewEvent } from './rawtree.mjs';

function unitInterval(value) {
  return createHash('sha256').update(value).digest().readUInt32BE() / 0xffffffff;
}

export function buildDemoReviewEvent(pullRequest, repository) {
  const prQuality = 6.8 + unitInterval(`${pullRequest.number}:quality`) * 2.2;
  const ratings = metrics.map((metric) => {
    const applicable = !metric.conditional || unitInterval(`${pullRequest.number}:${metric.key}:applicable`) > 0.25;
    if (!applicable) return { key: metric.key, label: metric.label, applicable: false };
    const score = Math.min(9.8, prQuality - 0.25 + unitInterval(`${pullRequest.number}:${metric.key}:score`) * 0.5);
    return {
      key: metric.key,
      label: metric.label,
      applicable: true,
      score,
      confidence: 0.65 + unitInterval(`${pullRequest.number}:${metric.key}:confidence`) * 0.3,
      passed: score >= 7,
      hint: null,
    };
  });
  const recordedAt = pullRequest.mergedAt ?? pullRequest.closedAt ?? pullRequest.createdAt;
  const event = buildReviewEvent({
    report: {
      model: 'synthetic-demo-v1',
      threshold: 7,
      passed: ratings.every((rating) => !rating.applicable || rating.passed),
      batches: [{ batch: 1, ratings }],
    },
    pullRequest: {
      number: pullRequest.number,
      title: pullRequest.title,
      html_url: pullRequest.url,
      user: { login: pullRequest.author.login, id: null },
      head: { sha: pullRequest.headRefOid },
      base: { sha: '0'.repeat(40), ref: 'main' },
    },
    environment: { GITHUB_REPOSITORY: repository },
    recordedAt,
  });
  return {
    ...event,
    event_id: `demo:${repository}:${pullRequest.number}:v1`,
    data_source: 'synthetic_demo',
    rubric_version: '1-demo',
    pr_state: pullRequest.state.toLowerCase(),
    pr_merged_at: pullRequest.mergedAt,
    additions: pullRequest.additions,
    deletions: pullRequest.deletions,
    changed_files: pullRequest.changedFiles,
  };
}

export function buildDemoReviewEvents(pullRequests, repository) {
  return pullRequests
    .filter((pullRequest) => pullRequest.author?.login && !pullRequest.author.is_bot)
    .map((pullRequest) => buildDemoReviewEvent(pullRequest, repository));
}
