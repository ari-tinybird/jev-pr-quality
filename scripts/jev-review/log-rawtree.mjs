import { existsSync, readFileSync } from 'node:fs';
import { buildReviewEvent, insertReviewEvent } from './rawtree.mjs';

if (!existsSync('jev-review.json')) {
  console.log('Skipping Rawtree logging: this run did not produce a review report.');
} else if (!process.env.RAWTREE_JEV_API_KEY?.trim()) {
  console.log('Skipping Rawtree logging: RAWTREE_JEV_API_KEY is not configured.');
} else {
  try {
    const githubEvent = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const report = JSON.parse(readFileSync('jev-review.json', 'utf8'));
    const event = buildReviewEvent({ report, pullRequest: githubEvent.pull_request, environment: process.env });
    await insertReviewEvent({
      event,
      apiKey: process.env.RAWTREE_JEV_API_KEY,
      table: process.env.RAWTREE_JEV_TABLE || 'jev_pr_reviews',
      database: process.env.RAWTREE_JEV_DATABASE,
      baseUrl: process.env.RAWTREE_JEV_BASE_URL || 'https://api.rawtree.com',
    });
    console.log(`Logged Jev review for ${event.repository}#${event.pr_number} to Rawtree.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Rawtree logging error.';
    console.error(`Unable to log Jev review to Rawtree: ${message}`);
    process.exitCode = 1;
  }
}
