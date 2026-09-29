import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDashboardFilters,
  buildStatsQuery,
  dashboardQueries,
} from "./dashboard-queries.ts";

test("filters by repository and date before selecting the latest PR run", () => {
  const sql = applyDashboardFilters(buildStatsQuery(), {
    repository: "example/service-api",
    dateFrom: "2026-09-01",
    dateTo: "2026-09-30",
  });

  assert.match(sql, /PARTITION BY concat\(repository, ':', toString\(pr_number\)\)/);
  assert.match(sql, /repository::Nullable\(String\) = 'example\/service-api'/);
  assert.match(sql, /recorded_at.*>= '2026-09-01'/);
  assert.match(sql, /recorded_at.*< addDays\(toDate\('2026-09-30'\), 1\)/);
  assert.ok(sql.indexOf("repository::Nullable") < sql.indexOf(") WHERE _rn = 1"));
  assert.doesNotMatch(sql, /dashboard filters/);
});

test("every chart excludes unrelated and synthetic event versions", () => {
  for (const query of dashboardQueries) {
    const sql = applyDashboardFilters(query.sql, {});
    assert.match(sql, /event_type::Nullable\(String\) = 'jev_pr_review'/, query.id);
    assert.match(sql, /rubric_version::Nullable\(String\) = '1'/, query.id);
    assert.doesNotMatch(sql, /dashboard filters/, query.id);
  }
});

test("rejects filter values that could change SQL structure", () => {
  assert.throws(
    () => applyDashboardFilters(buildStatsQuery(), { repository: "owner/repo' OR 1=1" }),
    /Invalid repository/,
  );
  assert.throws(
    () => applyDashboardFilters(buildStatsQuery(), { dateFrom: "2026-02-30", dateTo: "2026-03-01" }),
    /valid calendar date/,
  );
});
