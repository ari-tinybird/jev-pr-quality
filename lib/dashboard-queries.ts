import type { DashboardConfig, DashboardQuery } from "@/lib/types";

const FILTER_MARKER = "/* dashboard filters */";
const DATE_EXPRESSION = "parseDateTime64BestEffort(toString(recorded_at))";

export const dashboardConfig: DashboardConfig = {
  table: "jev_pr_reviews",
  dateExpression: DATE_EXPRESSION,
  dedupIdColumn: "concat(repository, ':', toString(pr_number))",
  dedupTsColumn:
    "tuple(parseDateTime64BestEffort(toString(recorded_at)), ifNull(run_id::Nullable(UInt64), 0), ifNull(run_attempt::Nullable(UInt64), 0))",
  stats: [
    { label: "Reviewed PRs", sqlExpression: "count() AS reviewed_prs", key: "reviewed_prs" },
    {
      label: "Repositories",
      sqlExpression: "uniq(repository::Nullable(String)) AS repositories",
      key: "repositories",
    },
    {
      label: "Avg. Minimum Score",
      sqlExpression: "round(avg(minimum_score::Nullable(Float64)), 2) AS average_minimum_score",
      key: "average_minimum_score",
    },
    {
      label: "Pass Rate",
      sqlExpression: "round(100 * avg(if(ifNull(passed::Nullable(Bool), false), 1, 0)), 1) AS pass_rate",
      key: "pass_rate",
    },
  ],
};

export function buildDedupCte(): string {
  return `WITH events AS (
  SELECT * FROM (
    SELECT *,
      ROW_NUMBER() OVER (
        PARTITION BY ${dashboardConfig.dedupIdColumn}
        ORDER BY ${dashboardConfig.dedupTsColumn} DESC
      ) AS _rn
    FROM ${dashboardConfig.table}
    WHERE event_type::Nullable(String) = 'jev_pr_review'
      AND rubric_version::Nullable(String) = '1'
      ${FILTER_MARKER}
  ) WHERE _rn = 1
)`;
}

const CTE = buildDedupCte();

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
}

export const repositoryListQuery = `SELECT DISTINCT
  repository::Nullable(String) AS repository
FROM ${dashboardConfig.table}
WHERE event_type::Nullable(String) = 'jev_pr_review'
  AND rubric_version::Nullable(String) = '1'
  AND repository::Nullable(String) IS NOT NULL
ORDER BY repository`;

export function buildDateRangeQuery(): string {
  return `${CTE}
SELECT
  min(${DATE_EXPRESSION}) AS min_date,
  max(${DATE_EXPRESSION}) AS max_date
FROM events`;
}

export function buildStatsQuery(): string {
  const expressions = dashboardConfig.stats.map((stat) => stat.sqlExpression).join(",\n  ");
  return `${CTE}
SELECT
  ${expressions}
FROM events`;
}

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function assertDate(value: string, label: string): void {
  if (!ISO_DATE_ONLY.test(value)) throw new Error(`${label} must be YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a valid calendar date`);
  }
}

export function applyDashboardFilters(
  sql: string,
  filters: { repository?: string; dateFrom?: string; dateTo?: string },
): string {
  const conditions: string[] = [];
  if (filters.repository) {
    if (!REPOSITORY.test(filters.repository)) throw new Error("Invalid repository name");
    conditions.push(`repository::Nullable(String) = '${filters.repository}'`);
  }
  if (filters.dateFrom && filters.dateTo) {
    assertDate(filters.dateFrom, "dateFrom");
    assertDate(filters.dateTo, "dateTo");
    conditions.push(
      `${DATE_EXPRESSION} >= '${filters.dateFrom}'`,
      `${DATE_EXPRESSION} < addDays(toDate('${filters.dateTo}'), 1)`,
    );
  }
  const replacement = conditions.map((condition) => `AND ${condition}`).join("\n      ");
  return sql.replace(FILTER_MARKER, replacement);
}

export const dashboardQueries: DashboardQuery[] = [
  {
    id: "contributor-leaderboard",
    title: "Contributor Quality Score",
    description: "Average minimum Jev score across each contributor's latest PR reviews",
    sql: `${CTE}
SELECT
  author_login::Nullable(String) AS author,
  round(avg(minimum_score::Nullable(Float64)), 2) AS quality_score,
  count() AS reviewed_prs,
  round(100 * avg(if(ifNull(passed::Nullable(Bool), false), 1, 0)), 1) AS pass_rate
FROM events
GROUP BY author
ORDER BY quality_score DESC, pass_rate DESC, reviewed_prs DESC
LIMIT 10`,
    chartType: "table",
    chartConfig: { xKey: "quality_score", yKeys: ["author"] },
    columns: [
      { key: "author", label: "Contributor" },
      { key: "quality_score", label: "Score", format: "score" },
      { key: "reviewed_prs", label: "PRs", format: "number", width: 117 },
      { key: "pass_rate", label: "Pass rate", format: "percent" },
    ],
    colSpan: 2,
    chartHeight: 260,
  },
  {
    id: "quality-over-time",
    title: "Quality Over Time",
    description: "Daily average and lowest minimum Jev score",
    sql: `${CTE}
SELECT
  toDate(${DATE_EXPRESSION}) AS day,
  round(avg(minimum_score::Nullable(Float64)), 2) AS average_score,
  round(min(minimum_score::Nullable(Float64)), 2) AS lowest_score
FROM events
GROUP BY day
ORDER BY day`,
    chartType: "line",
    chartConfig: {
      xKey: "day",
      yKeys: ["average_score", "lowest_score"],
      colors: ["var(--chart-1)", "var(--chart-3)"],
      seriesLabels: { average_score: "Average score", lowest_score: "Lowest score" },
    },
    threshold: { value: 7, label: "Pass threshold" },
    headline: (rows) => {
      if (rows.length === 0) return null;
      const mean = average(rows.map((row) => Number(row.average_score)));
      return { value: mean.toFixed(1), unit: "/10" };
    },
    showLegend: true,
    colSpan: 2,
    chartHeight: 200,
  },
  {
    id: "quality-by-repository",
    title: "Quality by Repository",
    description: "Average minimum Jev score for each repository",
    sql: `${CTE}
SELECT
  repository::Nullable(String) AS repository,
  round(avg(minimum_score::Nullable(Float64)), 2) AS quality_score,
  count() AS reviewed_prs
FROM events
GROUP BY repository
ORDER BY quality_score DESC, reviewed_prs DESC
LIMIT 15`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "quality_score",
      yKeys: ["repository"],
      colors: ["var(--chart-1)"],
      seriesLabels: { quality_score: "Quality score" },
    },
    threshold: { value: 7, label: "Pass threshold" },
    headline: (rows) => {
      if (rows.length === 0) return null;
      const mean = average(rows.map((row) => Number(row.quality_score)));
      return { value: mean.toFixed(1), unit: "/10" };
    },
    colSpan: 2,
    chartHeight: 110,
  },
  {
    id: "review-outcomes",
    title: "Review Outcomes",
    description: "Latest passing and below-threshold PR results",
    sql: `${CTE}
SELECT
  if(ifNull(passed::Nullable(Bool), false), 'Passed', 'Below threshold') AS outcome,
  count() AS reviews
FROM events
GROUP BY outcome
ORDER BY reviews DESC`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "reviews",
      yKeys: ["outcome"],
      colors: ["var(--chart-1)"],
      seriesLabels: { reviews: "Reviews" },
      categoryColors: { Passed: "var(--success)", "Below threshold": "var(--destructive)" },
    },
    headline: (rows) => {
      const total = rows.reduce((sum, row) => sum + Number(row.reviews), 0);
      const passed = Number(rows.find((row) => row.outcome === "Passed")?.reviews ?? 0);
      if (!total) return null;
      return {
        value: passed.toLocaleString("en-US"),
        unit: `/${total.toLocaleString("en-US")} passed`,
        suffix: ` (${((100 * passed) / total).toFixed(1)}%)`,
      };
    },
    colSpan: 2,
    chartHeight: 56,
  },
  {
    id: "reviews-by-repository",
    title: "Reviews by Repository",
    description: "Latest PR evaluations represented in each repository",
    sql: `${CTE}
SELECT
  repository::Nullable(String) AS repository,
  count() AS reviews
FROM events
GROUP BY repository
ORDER BY reviews DESC
LIMIT 15`,
    chartType: "bar",
    chartConfig: {
      xKey: "repository",
      yKeys: ["reviews"],
      colors: ["var(--chart-1)"],
      seriesLabels: { reviews: "Reviews" },
    },
    headline: (rows) => ({
      value: rows.reduce((sum, row) => sum + Number(row.reviews), 0).toLocaleString("en-US"),
    }),
    colSpan: 2,
    chartHeight: 114,
  },
];
