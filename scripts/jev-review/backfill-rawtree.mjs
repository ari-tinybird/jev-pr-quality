import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildReviewEvent, insertReviewEvents } from './rawtree.mjs';

function ghJson(args) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return JSON.parse(execFileSync('gh', args, {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }));
    } catch (error) {
      if (attempt === 3) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 500);
    }
  }
}

export function selectBackfillArtifacts(artifactPages, runPages) {
  const runs = new Map(
    runPages.flatMap((page) => page.workflow_runs).map((run) => [run.id, run]),
  );
  return artifactPages
    .flatMap((page) => page.artifacts)
    .filter((artifact) => artifact.name.startsWith('jev-review-') && !artifact.expired)
    .map((artifact) => ({ artifact, run: runs.get(artifact.workflow_run.id) }))
    .filter(({ run }) => run?.event === 'pull_request' && run.status === 'completed' && run.conclusion !== 'cancelled')
    .sort((left, right) => left.artifact.created_at.localeCompare(right.artifact.created_at));
}

export function buildBackfillReviewEvent({ report, pullRequest, run, artifact, repository }) {
  if (report.head !== run.head_sha) {
    throw new Error(`Artifact ${artifact.id} head does not match workflow run ${run.id}.`);
  }
  return buildReviewEvent({
    report,
    pullRequest: {
      ...pullRequest,
      head: { ...pullRequest.head, sha: report.head },
      base: { ...pullRequest.base, sha: report.base },
    },
    environment: {
      GITHUB_REPOSITORY: repository,
      GITHUB_RUN_ID: String(run.id),
      GITHUB_RUN_ATTEMPT: String(run.run_attempt),
      GITHUB_SERVER_URL: 'https://github.com',
    },
    recordedAt: artifact.created_at,
  });
}

function fetchPages(endpoint) {
  return ghJson(['api', '--paginate', '--slurp', endpoint]);
}

function cachedJson(path, fetch) {
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  const value = fetch();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value)}\n`);
  return value;
}

function fetchArtifactRuns(artifactPages, repository, cacheDirectory, limit) {
  const artifacts = artifactPages
    .flatMap((page) => page.artifacts)
    .filter((artifact) => artifact.name.startsWith('jev-review-') && !artifact.expired)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const runIds = [...new Set(artifacts.map((artifact) => artifact.workflow_run.id))];
  if (limit === null) {
    if (runIds.length === 0) return [{ workflow_runs: [] }];
    const representative = cachedJson(
      join(cacheDirectory, 'runs', `${runIds[0]}.json`),
      () => ghJson(['api', `repos/${repository}/actions/runs/${runIds[0]}`]),
    );
    const pages = cachedJson(
      join(cacheDirectory, `workflow-${representative.workflow_id}-runs.json`),
      () => fetchPages(
        `repos/${repository}/actions/workflows/${representative.workflow_id}/runs?per_page=100`,
      ),
    );
    const found = new Set(pages.flatMap((page) => page.workflow_runs).map((run) => run.id));
    const missingRuns = runIds
      .filter((runId) => !found.has(runId))
      .map((runId) => cachedJson(
        join(cacheDirectory, 'runs', `${runId}.json`),
        () => ghJson(['api', `repos/${repository}/actions/runs/${runId}`]),
      ));
    return missingRuns.length ? [...pages, { workflow_runs: missingRuns }] : pages;
  }

  const workflow_runs = [];
  for (const [index, runId] of runIds.entries()) {
    process.stderr.write(`Reading workflow run ${index + 1}/${runIds.length}\r`);
    const run = cachedJson(
      join(cacheDirectory, 'runs', `${runId}.json`),
      () => ghJson(['api', `repos/${repository}/actions/runs/${runId}`]),
    );
    workflow_runs.push(run);
    if (limit !== null) {
      const eligible = workflow_runs.filter(
        (candidate) => candidate.event === 'pull_request'
          && candidate.status === 'completed'
          && candidate.conclusion !== 'cancelled',
      ).length;
      if (eligible === limit) break;
    }
  }
  if (runIds.length) process.stderr.write('\n');
  return [{ workflow_runs }];
}

function resolvePullRequest(run, repository, cacheDirectory, pullRequestCache, headCache, branchCache) {
  let number = run.pull_requests.length === 1 ? run.pull_requests[0].number : headCache.get(run.head_sha);
  if (!number) {
    const candidates = cachedJson(
      join(cacheDirectory, 'commit-pulls', `${run.head_sha}.json`),
      () => ghJson(['api', `repos/${repository}/commits/${run.head_sha}/pulls`]),
    );
    const exact = candidates.filter((pullRequest) => pullRequest.head.sha === run.head_sha);
    if (exact.length === 1) {
      number = exact[0].number;
    } else if (exact.length === 0) {
      const owner = run.head_repository?.owner?.login;
      const branchKey = owner && run.head_branch ? `${owner}:${run.head_branch}` : null;
      number = branchKey ? branchCache.get(branchKey) : null;
      if (!number && branchKey) {
        const branchMatches = cachedJson(
          join(cacheDirectory, 'branch-pulls', `${encodeURIComponent(branchKey)}.json`),
          () => ghJson([
            'api', '-X', 'GET', `repos/${repository}/pulls`,
            '-f', 'state=all', '-f', `head=${branchKey}`,
          ]),
        );
        if (branchMatches.length === 1) {
          number = branchMatches[0].number;
          branchCache.set(branchKey, number);
        }
      }
    }
    if (!number) {
      throw new Error(`Could not identify the PR for workflow run ${run.id} head ${run.head_sha}.`);
    }
  }
  headCache.set(run.head_sha, number);
  if (!pullRequestCache.has(number)) {
    pullRequestCache.set(number, cachedJson(
      join(cacheDirectory, 'pull-requests', `${number}.json`),
      () => ghJson(['api', `repos/${repository}/pulls/${number}`]),
    ));
  }
  return pullRequestCache.get(number);
}

function downloadReport(run, artifact, repository, cacheDirectory) {
  const artifactDirectory = join(cacheDirectory, 'artifacts', String(artifact.id));
  const reportPath = join(artifactDirectory, 'jev-review.json');
  if (!existsSync(reportPath)) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      rmSync(artifactDirectory, { recursive: true, force: true });
      try {
        execFileSync('gh', [
          'run', 'download', String(run.id), '--repo', repository,
          '--name', artifact.name, '--dir', artifactDirectory,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 1_000);
      }
    }
  }
  if (!existsSync(reportPath)) throw new Error(`Artifact ${artifact.id} does not contain jev-review.json.`);
  return JSON.parse(readFileSync(reportPath, 'utf8'));
}

function requestedLimit(args) {
  const value = args.find((argument) => argument.startsWith('--limit='))?.slice('--limit='.length);
  if (value === undefined) return null;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('--limit must be a positive integer.');
  return limit;
}

async function main() {
  const write = process.argv.includes('--write');
  const repository = process.env.JEV_BACKFILL_REPOSITORY;
  const limit = requestedLimit(process.argv.slice(2));
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('Set JEV_BACKFILL_REPOSITORY to owner/repository.');
  }
  if (write && !process.env.RAWTREE_JEV_API_KEY?.trim()) {
    throw new Error('RAWTREE_JEV_API_KEY is missing. Export it before running a write backfill.');
  }

  const cacheDirectory = process.env.JEV_BACKFILL_CACHE || join(
    homedir(), '.cache', 'rawtree-jev-backfill', repository.replace('/', '-'),
  );
  const artifactPages = fetchPages(`repos/${repository}/actions/artifacts?per_page=100`);
  const runPages = fetchArtifactRuns(artifactPages, repository, cacheDirectory, limit);
  const selected = selectBackfillArtifacts(artifactPages, runPages);
  const candidates = limit === null ? selected : selected.slice(-limit);
  const pullRequestCache = new Map();
  const headCache = new Map();
  const branchCache = new Map();
  const events = [];
  const unidentifiedRuns = [];

  for (const [index, { artifact, run }] of candidates.entries()) {
    process.stderr.write(`Preparing ${index + 1}/${candidates.length}: workflow run ${run.id}\r`);
    let pullRequest;
    try {
      pullRequest = resolvePullRequest(
        run, repository, cacheDirectory, pullRequestCache, headCache, branchCache,
      );
    } catch (error) {
      if (!error.message.startsWith('Could not identify the PR for workflow run')) throw error;
      unidentifiedRuns.push(run.id);
      process.stderr.write(`\nSkipping workflow run ${run.id}: no matching PR found.\n`);
      continue;
    }
    const report = downloadReport(run, artifact, repository, cacheDirectory);
    events.push(buildBackfillReviewEvent({ report, pullRequest, run, artifact, repository }));
  }
  if (candidates.length) process.stderr.write('\n');

  const summary = {
    repository,
    retained_review_runs: selected.length,
    prepared_events: events.length,
    pull_requests: new Set(events.map((event) => event.pr_number)).size,
    unidentified_runs: unidentifiedRuns.length,
    earliest_review: events[0]?.recorded_at ?? null,
    latest_review: events.at(-1)?.recorded_at ?? null,
  };

  if (!write) {
    console.log(JSON.stringify(summary, null, 2));
    console.error('Preview only. Add --write to insert these real Jev review events.');
    return;
  }

  const table = process.env.RAWTREE_JEV_TABLE || 'jev_pr_reviews';
  const database = process.env.RAWTREE_JEV_DATABASE;
  const baseUrl = process.env.RAWTREE_JEV_BASE_URL || 'https://api.rawtree.com';
  const destination = createHash('sha256').update(`${baseUrl}\n${database ?? ''}\n${table}`).digest('hex');
  const checkpointPath = join(cacheDirectory, `inserted-${destination}.json`);
  const inserted = new Set(existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, 'utf8')) : []);
  const pendingEvents = events.filter((event) => !inserted.has(event.event_id));
  for (let offset = 0; offset < pendingEvents.length; offset += 25) {
    const batch = pendingEvents.slice(offset, offset + 25);
    await insertReviewEvents({
      events: batch,
      apiKey: process.env.RAWTREE_JEV_API_KEY,
      table,
      database,
      baseUrl,
    });
    for (const event of batch) inserted.add(event.event_id);
    writeFileSync(checkpointPath, `${JSON.stringify([...inserted], null, 2)}\n`);
  }
  console.log(JSON.stringify({
    ...summary,
    previously_inserted_events: events.length - pendingEvents.length,
    inserted_events: pendingEvents.length,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
