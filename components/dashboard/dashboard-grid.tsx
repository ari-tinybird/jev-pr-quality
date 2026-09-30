"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiKeyForm } from "@/components/dashboard/api-key-form";
import { ChartPanel } from "@/components/dashboard/chart-panel";
import { DashboardToolbar } from "@/components/dashboard/dashboard-toolbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { useHeaderActions } from "@/components/layout/header-actions";
import {
  applyDashboardFilters,
  buildDateRangeQuery,
  buildStatsQuery,
  dashboardConfig,
  dashboardQueries,
  repositoryListQuery,
} from "@/lib/dashboard-queries";
import { runQuery, type QueryResult, type RawtreeConfig } from "@/lib/rawtree-api";

type Stats = Record<string, number>;

const LAYOUT = [
  "contributor-leaderboard",
  "quality-over-time",
  "quality-by-repository",
  "reviews-by-repository",
  "review-outcomes",
];
const FULL_WIDTH = new Set(["quality-over-time", "review-outcomes", "contributor-leaderboard"]);

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

function formatStat(key: string, value: number): string {
  const formatted = formatNumber(value);
  return key === "pass_rate" ? `${formatted}%` : formatted;
}

function dateInput(value: unknown): string {
  const text = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

export function DashboardGrid() {
  const [config, setConfig] = useState<RawtreeConfig | null>(null);
  const [repositories, setRepositories] = useState<string[]>([]);
  const [repository, setRepository] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [results, setResults] = useState<Record<string, QueryResult | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const executeQueries = useCallback(async (
    cfg: RawtreeConfig,
    selectedRepository: string,
    from?: string,
    to?: string,
  ) => {
    const filters = { repository: selectedRepository || undefined, dateFrom: from, dateTo: to };
    setLoading(Object.fromEntries(dashboardQueries.map((query) => [query.id, true])));
    setErrors({});

    try {
      const result = await runQuery(cfg.endpoint, cfg.apiKey, applyDashboardFilters(buildStatsQuery(), filters));
      const row = result.data[0] ?? {};
      setStats(Object.fromEntries(dashboardConfig.stats.map((stat) => [stat.key, Number(row[stat.key]) || 0])));
    } catch {
      setStats(null);
    }

    await Promise.all(dashboardQueries.map(async (query) => {
      try {
        const result = await runQuery(cfg.endpoint, cfg.apiKey, applyDashboardFilters(query.sql, filters));
        setResults((current) => ({ ...current, [query.id]: result }));
      } catch (error) {
        setErrors((current) => ({
          ...current,
          [query.id]: error instanceof Error ? error.message : "Query failed",
        }));
      } finally {
        setLoading((current) => ({ ...current, [query.id]: false }));
      }
    }));
  }, []);

  const initialize = useCallback(async (cfg: RawtreeConfig, selectedRepository: string) => {
    let from = "";
    let to = "";
    try {
      const range = await runQuery(
        cfg.endpoint,
        cfg.apiKey,
        applyDashboardFilters(buildDateRangeQuery(), { repository: selectedRepository || undefined }),
      );
      from = dateInput(range.data[0]?.min_date);
      to = dateInput(range.data[0]?.max_date);
      setDateFrom(from);
      setDateTo(to);
    } catch {
      setDateFrom("");
      setDateTo("");
    }
    await executeQueries(cfg, selectedRepository, from || undefined, to || undefined);
  }, [executeQueries]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (autoRefresh && config) {
      intervalRef.current = setInterval(
        () => executeQueries(config, repository, dateFrom || undefined, dateTo || undefined),
        30_000,
      );
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, config, dateFrom, dateTo, executeQueries, repository]);

  async function handleConnect(cfg: RawtreeConfig) {
    setConfig(cfg);
    try {
      const result = await runQuery(cfg.endpoint, cfg.apiKey, repositoryListQuery);
      setRepositories(result.data.map((row) => String(row.repository)).filter(Boolean));
    } catch {
      setRepositories([]);
    }
    await initialize(cfg, "");
  }

  const disconnect = useCallback(() => {
    setConfig(null);
    setRepositories([]);
    setRepository("");
    setDateFrom("");
    setDateTo("");
    setStats(null);
    setResults({});
    setErrors({});
    setAutoRefresh(false);
  }, []);

  const { setOnDisconnect } = useHeaderActions();
  const connected = config !== null;
  useEffect(() => {
    if (!connected) return;
    setOnDisconnect(disconnect);
    return () => setOnDisconnect(null);
  }, [connected, disconnect, setOnDisconnect]);

  if (!config) return <ApiKeyForm onConnect={handleConnect} />;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6">
      <section className="mb-6 flex max-w-3xl flex-col gap-2">
        <p className="text-subheading uppercase text-muted-foreground">Jev + RawTree</p>
        <h1 className="text-display-sm">Jev-Assisted Pull Request Quality</h1>
        <p className="text-body text-muted-foreground">
          Review complete pull request diffs with Jev, retain structured quality events in RawTree,
          and compare contributors and repositories without counting reruns twice.
        </p>
      </section>
      <DashboardToolbar
        endpoint={config.endpoint}
        repositories={repositories}
        repository={repository}
        dateFrom={dateFrom}
        dateTo={dateTo}
        autoRefresh={autoRefresh}
        onRepositoryChange={(value) => { setRepository(value); void initialize(config, value); }}
        onDateChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
          void executeQueries(config, repository, from || undefined, to || undefined);
        }}
        onAutoRefreshToggle={() => setAutoRefresh((value) => !value)}
        onRefresh={() => void executeQueries(config, repository, dateFrom || undefined, dateTo || undefined)}
      />

      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border bg-border sm:grid-cols-4">
          {dashboardConfig.stats.map((stat) => (
            <StatCard key={stat.key} label={stat.label} value={formatStat(stat.key, stats[stat.key] ?? 0)} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {LAYOUT.map((id) => dashboardQueries.find((query) => query.id === id)!).map((query) => (
          <div key={query.id} className={FULL_WIDTH.has(query.id) ? "lg:col-span-2" : undefined}>
            <ChartPanel
              query={query}
              result={results[query.id] ?? null}
              error={errors[query.id] ?? null}
              loading={loading[query.id] ?? false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
