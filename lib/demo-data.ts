import type { QueryResult } from "@/lib/rawtree-api";

export const DEMO_API_KEY = "demo";

export function isDemoKey(apiKey: string): boolean {
  return process.env.NODE_ENV !== "production" && apiKey === DEMO_API_KEY;
}

interface DemoEvent {
  repository: string;
  author: string;
  day: string;
  score: number;
  passed: boolean;
}

const REPOSITORIES = ["acme/web-app", "acme/api", "acme/mobile", "acme/infra", "acme/design-system"];
const AUTHORS = ["maria-dev", "jlopez", "sam-k", "priya.r", "tomasz", "ana-ux", "chen-w", "leo-b", "noor", "dani-g", "kfisher"];
const START = Date.UTC(2026, 6, 1);
const DAYS = 90;

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function generateEvents(): DemoEvent[] {
  const random = seededRandom(42);
  const skill = AUTHORS.map(() => random() * 2.4 - 1.2);
  const events: DemoEvent[] = [];
  for (let d = 0; d < DAYS; d++) {
    const day = new Date(START + d * 86_400_000).toISOString().slice(0, 10);
    const count = Math.floor(random() * 6) + 1;
    for (let i = 0; i < count; i++) {
      const authorIndex = Math.floor(random() * AUTHORS.length);
      const trend = (d / DAYS) * 1.2;
      const raw = 6.2 + trend + skill[authorIndex] + (random() - 0.5) * 3;
      const score = Math.max(2, Math.min(10, Math.round(raw)));
      events.push({
        repository: REPOSITORIES[Math.floor(random() * REPOSITORIES.length)],
        author: AUTHORS[authorIndex],
        day,
        score,
        passed: score >= 7,
      });
    }
  }
  return events;
}

const EVENTS = generateEvents();

function applyFilters(sql: string): DemoEvent[] {
  const repository = sql.match(/repository::Nullable\(String\) = '([^']+)'/)?.[1];
  const from = sql.match(/>= '(\d{4}-\d{2}-\d{2})'/)?.[1];
  const to = sql.match(/toDate\('(\d{4}-\d{2}-\d{2})'\)/)?.[1];
  return EVENTS.filter((event) =>
    (!repository || event.repository === repository) &&
    (!from || event.day >= from) &&
    (!to || event.day <= to));
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
const passRate = (events: DemoEvent[]) => round(100 * average(events.map((event) => (event.passed ? 1 : 0))), 1);

function groupBy(events: DemoEvent[], key: (event: DemoEvent) => string): [string, DemoEvent[]][] {
  const groups = new Map<string, DemoEvent[]>();
  for (const event of events) groups.set(key(event), [...(groups.get(key(event)) ?? []), event]);
  return [...groups.entries()];
}

function rows(sql: string): Record<string, unknown>[] {
  const events = applyFilters(sql);

  if (sql.includes("SELECT DISTINCT")) return REPOSITORIES.map((repository) => ({ repository }));

  if (sql.includes("min_date")) {
    const days = events.map((event) => event.day).sort();
    return [{ min_date: days[0] ?? null, max_date: days.at(-1) ?? null }];
  }

  if (sql.includes("average_minimum_score")) {
    return [{
      reviewed_prs: events.length,
      repositories: new Set(events.map((event) => event.repository)).size,
      average_minimum_score: round(average(events.map((event) => event.score)), 2),
      pass_rate: passRate(events),
    }];
  }

  if (sql.includes("AS author")) {
    return groupBy(events, (event) => event.author)
      .map(([author, group]) => ({
        author,
        quality_score: round(average(group.map((event) => event.score)), 2),
        reviewed_prs: group.length,
        pass_rate: passRate(group),
      }))
      .sort((a, b) => b.quality_score - a.quality_score)
      .slice(0, 10);
  }

  if (sql.includes("AS day")) {
    return groupBy(events, (event) => event.day)
      .map(([day, group]) => ({
        day,
        average_score: round(average(group.map((event) => event.score)), 2),
        lowest_score: Math.min(...group.map((event) => event.score)),
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  if (sql.includes("AS outcome")) {
    return groupBy(events, (event) => (event.passed ? "Passed" : "Below threshold"))
      .map(([outcome, group]) => ({ outcome, reviews: group.length }))
      .sort((a, b) => b.reviews - a.reviews);
  }

  if (sql.includes("AS quality_score")) {
    return groupBy(events, (event) => event.repository)
      .map(([repository, group]) => ({
        repository,
        quality_score: round(average(group.map((event) => event.score)), 2),
        reviewed_prs: group.length,
      }))
      .sort((a, b) => b.quality_score - a.quality_score);
  }

  if (sql.includes("AS reviews")) {
    return groupBy(events, (event) => event.repository)
      .map(([repository, group]) => ({ repository, reviews: group.length }))
      .sort((a, b) => b.reviews - a.reviews);
  }

  return [];
}

export async function runDemoQuery(sql: string): Promise<QueryResult> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const data = rows(sql);
  return { meta: [], data, rows: data.length, statistics: { elapsed: 0, rows_read: 0, bytes_read: 0 } };
}
