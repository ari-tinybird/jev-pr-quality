import { existsSync, readFileSync } from 'node:fs';

export const marker = '<!-- rawtree-jev-quality-review -->';

export function formatComment({ report, head, runUrl }) {
  const lines = [marker, '## 🧭 Jev quality review', ''];
  if (!report) {
    lines.push('> [!WARNING]', '> **Review could not complete.** No passing result is available.', '',
      `Check the [workflow logs](${runUrl}) for the error, then rerun the review.`, '',
      `Reviewed commit: \`${head.slice(0, 7)}\``);
    return lines.join('\n');
  }

  // Show the worst applicable score for each dimension; never average away a failure.
  const ratings = new Map();
  for (const batch of report.batches) {
    for (const rating of batch.ratings) {
      const previous = ratings.get(rating.key);
      if (!previous || (rating.applicable && (!previous.applicable || rating.score < previous.score))) {
        ratings.set(rating.key, { ...rating, batch: batch.batch });
      }
    }
  }
  const applicable = [...ratings.values()].filter((rating) => rating.applicable);
  const failures = applicable.filter((rating) => !rating.passed);
  lines.push(
    `> [!${report.passed ? 'TIP' : 'WARNING'}]`,
    `> **${report.passed ? '✅ Passed' : '❌ Changes needed'}** · Minimum score: **${report.threshold}/10** · **${applicable.length - failures.length}/${applicable.length}** applicable dimensions passed.`, '',
    `Reviewed commit: \`${head.slice(0, 7)}\` · [View run and full JSON report](${runUrl})`, '',
  );
  if (report.batches.length > 1) {
    lines.push(`Lowest score per dimension across **${report.batches.length} batches**; confidence and notes correspond to that score.`, '');
  }
  lines.push('### Ratings', '', '| Dimension | Score / 10 | Confidence | Result |', '| :--- | ---: | ---: | :--- |');
  for (const rating of ratings.values()) {
    lines.push(rating.applicable
      ? `| ${rating.label} | **${rating.score.toFixed(3)}** | ${Math.round(rating.confidence * 100)}% | ${rating.passed ? '✅ Pass' : '❌ Below threshold'} |`
      : `| ${rating.label} | — | — | Not applicable |`);
  }
  lines.push('', '### Review notes', '');
  const notes = applicable.filter((rating) => rating.hint || !rating.passed);
  if (!notes.length) lines.push('No material weaknesses were selected for the displayed ratings.');
  for (const rating of notes.sort((a, b) => a.score - b.score)) {
    const batch = report.batches.length > 1 ? ` (batch ${rating.batch})` : '';
    lines.push(`- **${rating.label}${batch}:** ${rating.hint ?? 'Below threshold; inspect the changed code to determine the cause.'}`);
  }
  lines.push('', '<sub>Notes are predefined rubric hints, not root-cause explanations. Confidence is informational. This comment updates when the review reruns.</sub>');
  return lines.join('\n');
}

export async function publishComment({ github, context, core, report }) {
  const pr = context.payload.pull_request;
  const target = { ...context.repo, issue_number: pr.number };
  const current = await github.rest.pulls.get({ ...context.repo, pull_number: pr.number });
  // A cancelled run must not replace the result of a newer push or retargeted PR.
  if (current.data.head.sha !== pr.head.sha || current.data.base.ref !== pr.base.ref) {
    core.info('Skipping comment: the PR head or base branch changed during review.');
    return;
  }
  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const body = formatComment({ report, head: pr.head.sha, runUrl });
  const comments = await github.paginate(github.rest.issues.listComments, { ...target, per_page: 100 });
  const existing = comments.find((comment) => comment.user?.login === 'github-actions[bot]'
    && comment.user?.type === 'Bot' && comment.body?.startsWith(marker));
  if (existing) {
    await github.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
  } else {
    await github.rest.issues.createComment({ ...target, body });
  }
}

export async function run({ github, context, core }) {
  const report = existsSync('jev-review.json') ? JSON.parse(readFileSync('jev-review.json', 'utf8')) : null;
  await publishComment({ github, context, core, report });
}
