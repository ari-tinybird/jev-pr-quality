"use client";

import { useState } from "react";
import { Code2, BarChart3 } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { SqlHighlight } from "@/components/dashboard/sql-highlight";
import type { DashboardQuery } from "@/lib/types";
import type { QueryResult } from "@/lib/rawtree-api";

const PIE_COLORS = [
  "oklch(0.6 0.2 265)",
  "oklch(0.65 0.18 150)",
  "oklch(0.7 0.18 85)",
  "oklch(0.65 0.15 30)",
  "oklch(0.6 0.15 200)",
  "oklch(0.55 0.2 330)",
  "oklch(0.7 0.12 120)",
  "oklch(0.6 0.18 50)",
  "oklch(0.55 0.15 280)",
  "oklch(0.65 0.12 170)",
];

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: 11,
};

function formatTick(value: string) {
  if (!value) return "";
  if (value.includes("T") || value.includes(" ")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  }
  if (typeof value === "string" && value.length > 32) {
    return value.slice(0, 30) + "…";
  }
  return value;
}

/**
 * Pivots grouped rows into one column per unique group value.
 * Input:  [{bucket:"10:00", rule:"A", blocks:5}, {bucket:"10:00", rule:"B", blocks:3}]
 * Output: [{bucket:"10:00", A:5, B:3}]
 * Returns { data, seriesKeys } where seriesKeys are the discovered group names.
 */
function pivotByGroup(
  rows: Record<string, unknown>[],
  xKey: string,
  groupKey: string,
  valueKey: string
): { data: Record<string, unknown>[]; seriesKeys: string[] } {
  const bucketMap = new Map<string, Record<string, unknown>>();
  const groupSet = new Set<string>();
  for (const row of rows) {
    const x = String(row[xKey] ?? "");
    const g = String(row[groupKey] ?? "");
    const v = row[valueKey];
    if (!g) continue;
    groupSet.add(g);
    let bucket = bucketMap.get(x);
    if (!bucket) {
      bucket = { [xKey]: row[xKey] };
      bucketMap.set(x, bucket);
    }
    bucket[g] = v;
  }
  return { data: Array.from(bucketMap.values()), seriesKeys: Array.from(groupSet) };
}

function ChartRenderer({
  query,
  data: rawData,
}: {
  query: DashboardQuery;
  data: Record<string, unknown>[];
}) {
  const { chartType, chartConfig } = query;
  const color = chartConfig.colors?.[0] ?? "var(--color-primary)";
  const h = query.chartHeight ?? 200;

  let data = rawData;
  let effectiveYKeys = chartConfig.yKeys;
  if (query.groupKey && chartConfig.yKeys.length === 1) {
    const pivoted = pivotByGroup(rawData, chartConfig.xKey, query.groupKey, chartConfig.yKeys[0]);
    data = pivoted.data;
    effectiveYKeys = pivoted.seriesKeys;
  }

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <AreaChart data={data} margin={query.showLegend ? { right: 120 } : undefined}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey={chartConfig.xKey}
            tickFormatter={formatTick}
            tick={{ fontSize: 9 }}
            className="text-muted-foreground"
          />
          <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {query.showLegend && (
            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 9, right: 0 }} />
          )}
          {effectiveYKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={chartConfig.colors?.[i % (chartConfig.colors?.length ?? 1)] ?? color}
              fill={chartConfig.colors?.[i % (chartConfig.colors?.length ?? 1)] ?? color}
              fillOpacity={0.15}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "horizontal-bar") {
    const labelKey = chartConfig.yKeys[0];
    const valueKey = chartConfig.xKey;
    const labelWidth = labelKey === "repository" ? 170 : 85;
    return (
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" tick={{ fontSize: 9 }} />
          <YAxis
            dataKey={labelKey}
            type="category"
            tick={{ fontSize: 9 }}
            width={labelWidth}
            tickFormatter={formatTick}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey={valueKey} fill={color} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "bar") {
    const hasCategoricalColors =
      effectiveYKeys.length === 1 &&
      (chartConfig.colors?.length ?? 0) > 1;

    return (
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={data} margin={query.showLegend ? { right: 120 } : undefined}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey={chartConfig.xKey}
            tickFormatter={formatTick}
            tick={{ fontSize: 9 }}
          />
          <YAxis tick={{ fontSize: 9 }} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {query.showLegend && !hasCategoricalColors && (
            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 9, right: 0 }} />
          )}
          {query.showLegend && hasCategoricalColors && (
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              wrapperStyle={{ fontSize: 9, right: 0 }}
              content={() => (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 9 }}>
                  {data.map((row, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: chartConfig.colors?.[i % (chartConfig.colors?.length ?? 1)] ?? color,
                          flexShrink: 0,
                        }}
                      />
                      {String(row[chartConfig.xKey] ?? "")}
                    </li>
                  ))}
                </ul>
              )}
            />
          )}
          {hasCategoricalColors ? (
            <Bar dataKey={effectiveYKeys[0]} radius={[3, 3, 0, 0]}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={chartConfig.colors?.[i % (chartConfig.colors?.length ?? 1)] ?? color}
                />
              ))}
            </Bar>
          ) : (
            effectiveYKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId={query.stacked ? "s" : undefined}
                fill={chartConfig.colors?.[i % (chartConfig.colors?.length ?? 1)] ?? color}
                radius={query.stacked ? undefined : [3, 3, 0, 0]}
              />
            ))
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <LineChart data={data} margin={query.showLegend ? { right: 120 } : undefined}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey={chartConfig.xKey}
            tickFormatter={formatTick}
            tick={{ fontSize: 9 }}
          />
          <YAxis tick={{ fontSize: 9 }} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {query.showLegend && (
            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 9, right: 0 }} />
          )}
          {effectiveYKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={chartConfig.colors?.[i % (chartConfig.colors?.length ?? 1)] ?? color}
              strokeWidth={1.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "pie") {
    const nameKey = chartConfig.yKeys[0];
    const valueKey = chartConfig.xKey;
    return (
      <ResponsiveContainer width="100%" height={h}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={2}
            label={(props) => {
              const percent = props.percent ?? 0;
              const name = props.name ?? "";
              return percent > 0.04 ? `${String(name).slice(0, 12)} ${(percent * 100).toFixed(0)}%` : "";
            }}
            labelLine={false}
            style={{ fontSize: 9 }}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return <p className="text-sm text-muted-foreground">Unsupported chart type</p>;
}

export function ChartPanel({
  query,
  result,
  error,
  loading,
}: {
  query: DashboardQuery;
  result: QueryResult | null;
  error: string | null;
  loading: boolean;
}) {
  const [showSql, setShowSql] = useState(false);
  const [hasToggled, setHasToggled] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  function toggle() {
    setShowSql((v) => !v);
    setHasToggled(true);
    setAnimKey((k) => k + 1);
  }

  return (
    <div key={animKey} className={`rounded-xl border bg-card ${hasToggled ? "chart-panel-animate" : ""}`}>
      <div className="flex items-start justify-between border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xs font-semibold">{query.title}</h3>
          {!showSql && (
            <p className="truncate text-[10px] text-muted-foreground">
              {query.description}
            </p>
          )}
        </div>
        <button
          onClick={toggle}
          className="ml-2 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={showSql ? "Show chart" : "Show SQL"}
        >
          {showSql ? (
            <BarChart3 className="size-3.5" />
          ) : (
            <Code2 className="size-3.5" />
          )}
        </button>
      </div>

      {showSql ? (
        <div className="overflow-auto p-2" style={{ maxHeight: `${(query.chartHeight ?? 200) + 40}px` }}>
          <SqlHighlight sql={query.sql} />
        </div>
      ) : (
        <div className="p-2">
          {loading && (
            <div className="flex items-center justify-center" style={{ height: query.chartHeight ?? 200 }}>
              <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center px-3" style={{ height: query.chartHeight ?? 200 }}>
              <p className="text-center text-xs text-destructive">{error}</p>
            </div>
          )}
          {!loading && !error && result && (
            <ChartRenderer query={query} data={result.data} />
          )}
        </div>
      )}
    </div>
  );
}
