import { execFileSync } from 'node:child_process';
import { buildDemoReviewEvents } from './demo-data.mjs';
import { insertReviewEvents } from './rawtree.mjs';

const write = process.argv.includes('--write');
const repository = process.env.JEV_DEMO_REPOSITORY;
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Set JEV_DEMO_REPOSITORY to owner/repository.');

const pullRequests = JSON.parse(execFileSync('gh', [
  'pr', 'list', '--repo', repository, '--state', 'all', '--limit', '75',
  '--json', 'number,title,author,state,mergedAt,closedAt,createdAt,headRefOid,url,additions,deletions,changedFiles',
], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const events = buildDemoReviewEvents(pullRequests, repository);

if (!write) {
  console.log(JSON.stringify(events, null, 2));
  console.error(`Generated ${events.length} synthetic review events. Add --write to insert them.`);
} else {
  await insertReviewEvents({
    events,
    apiKey: process.env.RAWTREE_JEV_API_KEY,
    table: process.env.RAWTREE_JEV_TABLE || 'jev_pr_reviews',
    database: process.env.RAWTREE_JEV_DATABASE,
    baseUrl: process.env.RAWTREE_JEV_BASE_URL || 'https://api.rawtree.com',
  });
  console.log(`Inserted ${events.length} synthetic review events for ${repository}.`);
}
