import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { parseThreshold, review, summary } from './review.mjs';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

try {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const pr = event.pull_request;
  if (!pr || !/^[a-f0-9]{40}$/.test(pr.base?.sha) || !/^[a-f0-9]{40}$/.test(pr.head?.sha)) {
    throw new Error('Expected a pull_request event with valid base and head SHAs.');
  }
  const threshold = parseThreshold(process.env.JEV_MIN_SCORE ?? '7');
  // Three-dot matches the PR: only changes introduced since the common ancestor.
  const diff = git('diff', '--no-ext-diff', '--no-textconv', '--binary', '--find-renames', '--unified=20', `${pr.base.sha}...${pr.head.sha}`, '--');
  let repositoryContext = 'No root AGENTS.md was present in the base revision.';
  try {
    repositoryContext = git('show', `${pr.base.sha}:AGENTS.md`);
  } catch {
    // Repository guidance is useful context, not an installation requirement.
  }
  const report = await review({
    diff,
    task: `${pr.title ?? ''}\n\n${pr.body ?? ''}`,
    repositoryContext,
    threshold,
    apiKey: process.env.JEV_API_KEY,
  });
  report.head = pr.head.sha;
  report.base = pr.base.sha;
  const markdown = summary(report);
  writeFileSync('jev-review.json', JSON.stringify(report, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log(markdown);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  // Git's stderr and arbitrary exceptions are not safe to echo into CI logs.
  const message = error instanceof Error && !('status' in error) ? error.message : 'Unable to read PR context from Git.';
  const output = `Jev quality gate failed: ${message}\n`;
  console.error(output);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, output);
  process.exitCode = 1;
}
