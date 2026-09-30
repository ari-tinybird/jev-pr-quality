"use client";

import { useState } from "react";
import { Code2, BarChart3 } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { SqlHighlight } from "@/components/dashboard/sql-highlight";
import type { DashboardQuery, TableColumn } from "@/lib/types";
import type { QueryResult } from "@/lib/rawtree-api";

const PIE_COLORS = [1, 2, 3, 4, 5].map((n) => `var(--chart-${n})`);

const TICK = {
  fontSize: 10,
  fontFamily: "var(--font-geist-mono)",
  fill: "var(--muted-foreground)",
};
const BASELINE = { stroke: "var(--input)" };
const SCORE_TICKS = [0, 2, 4, 6, 8, 10];
const CATEGORY_TICK = { fontSize: 12, fill: "var(--muted-foreground)" };
const BAR_SIZE = 10;
const BAR_GAP = 8;

function CategoryTick({ y, payload }: { y?: number | string; payload?: { value?: unknown } }) {
  return (
    <text x={0} y={y} dy={4} textAnchor="start" fontSize={12} fill="var(--muted-foreground)">
      {String(payload?.value ?? "")}
    </text>
  );
}

function shortName(value: string) {
  return String(value ?? "").split("/").pop() ?? "";
}

function formatTick(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" });
  }
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

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="flex min-w-60 flex-col gap-2 rounded-lg border border-input bg-card px-4 py-3 shadow-[0_4px_6px_rgba(0,0,0,0.08)]">
      <p className="text-caption text-extra-muted-foreground">{formatTick(String(label ?? ""))}</p>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center gap-2 text-body">
          <span className="size-2 shrink-0 rounded-[2px]" style={{ background: entry.color }} />
          <span className="flex-1">{entry.name}</span>
          <span className="font-semibold">{String(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
      <span className="flex size-4 items-center justify-center">
        {dashed ? (
          <span className="w-3 border-t border-dashed" style={{ borderColor: color }} />
        ) : (
          <span className="size-2 rounded-full" style={{ background: color }} />
        )}
      </span>
      {label}
    </span>
  );
}

function formatCell(value: unknown, format: TableColumn["format"]) {
  if (format === "percent") return `${Number(value).toLocaleString("en-US")}%`;
  if (format === "number") return Number(value).toLocaleString("en-US");
  if (format === "score") return Number(value).toFixed(2);
  return String(value ?? "");
}

const NUMBER_COLUMN = 140;
const SCORE_COLUMN = 200 + 16 + 40 + 32;

function columnWidth(column: TableColumn, index: number, count: number): number | undefined {
  if (index === 0) return undefined;
  const width = column.width ?? (column.format === "score" ? SCORE_COLUMN : NUMBER_COLUMN);
  return index === count - 1 ? width + 8 : width;
}

function DataTable({ query, data }: { query: DashboardQuery; data: Record<string, unknown>[] }) {
  const columns = query.columns ?? [];
  return (
    <div className="-mx-6 -mb-5 overflow-x-auto border-t">
      <table className="w-full min-w-[720px] table-fixed text-body">
        <colgroup>
          {columns.map((column, i) => (
            <col key={column.key} style={{ width: columnWidth(column, i, columns.length) }} />
          ))}
        </colgroup>
        <thead className="bg-surface-01">
          <tr className="h-11 border-b">
            {columns.map((column, i) => (
              <th
                key={column.key}
                className={`px-4 whitespace-nowrap ${i === 0 ? "pl-6 text-left font-medium" : "text-right font-semibold"} ${i === columns.length - 1 ? "pr-6" : ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="h-11 border-b last:border-b-0">
              {columns.map((column, i) => {
                const text = formatCell(row[column.key], column.format);
                const edge = `${i === 0 ? "pl-6" : ""} ${i === columns.length - 1 ? "pr-6" : ""}`;
                if (i === 0) {
                  return <td key={column.key} className={`px-4 py-2.5 ${edge}`}>{text}</td>;
                }
                return (
                  <td key={column.key} className={`px-4 py-2.5 text-right font-mono text-code whitespace-nowrap ${edge}`}>
                    {column.format === "score" ? (
                      <span className="flex items-center justify-end gap-4">
                        <span className="h-1.5 w-[200px] min-w-24 overflow-hidden rounded-[4px] bg-surface-01">
                          <span
                            className="block h-full bg-primary"
                            style={{ width: `${Math.min(100, Number(row[column.key]) * 10)}%` }}
                          />
                        </span>
                        {text}
                      </span>
                    ) : text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartRenderer({
  query,
  data: rawData,
}: {
  query: DashboardQuery;
  data: Record<string, unknown>[];
}) {
  const { chartType, chartConfig } = query;
  const colors = chartConfig.colors ?? ["var(--color-primary)"];
  const colorAt = (i: number) => colors[i % colors.length];
  const labelOf = (key: string) => chartConfig.seriesLabels?.[key] ?? key;
  const h = query.chartHeight ?? 200;

  if (chartType === "table") return <DataTable query={query} data={rawData} />;

  let data = rawData;
  let effectiveYKeys = chartConfig.yKeys;
  if (query.groupKey && chartConfig.yKeys.length === 1) {
    const pivoted = pivotByGroup(rawData, chartConfig.xKey, query.groupKey, chartConfig.yKeys[0]);
    data = pivoted.data;
    effectiveYKeys = pivoted.seriesKeys;
  }

  const threshold = query.threshold;
  const legend = (query.showLegend || threshold) && chartType !== "horizontal-bar" && chartType !== "bar" && (
    <div className="mt-4 flex flex-wrap gap-4">
      {query.showLegend && effectiveYKeys.map((key, i) => (
        <LegendItem key={key} color={colorAt(i)} label={labelOf(key)} />
      ))}
      {threshold && <LegendItem color="var(--destructive)" label={threshold.label} dashed />}
    </div>
  );

  if (chartType === "area" || chartType === "line") {
    return (
      <>
        <ResponsiveContainer width="100%" height={h}>
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey={chartConfig.xKey}
              tickFormatter={formatTick}
              tick={TICK}
              tickLine={false}
              axisLine={BASELINE}
              minTickGap={24}
            />
            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={24}
              domain={threshold ? [0, 10] : undefined}
              ticks={threshold ? SCORE_TICKS : undefined}
            />
            <Tooltip content={ChartTooltip} cursor={{ stroke: "var(--input)" }} />
            {threshold && (
              <ReferenceLine y={threshold.value} stroke="var(--destructive)" strokeDasharray="2 3" />
            )}
            {effectiveYKeys.map((key, i) => (
              <Area
                key={key}
                type="linear"
                dataKey={key}
                name={labelOf(key)}
                stroke={colorAt(i)}
                fill={colorAt(i)}
                fillOpacity={i === 0 ? 0.08 : 0}
                strokeWidth={1.25}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        {legend}
      </>
    );
  }

  if (chartType === "horizontal-bar") {
    const labelKey = chartConfig.yKeys[0];
    const valueKey = chartConfig.xKey;
    const categoryColor = (row: Record<string, unknown>) =>
      chartConfig.categoryColors?.[String(row[labelKey])] ?? colorAt(0);
    const longest = Math.max(0, ...data.map((row) => String(row[labelKey] ?? "").length));
    const labelWidth = longest * 7 + 16;
    return (
      <ResponsiveContainer width="100%" height={data.length * (BAR_SIZE + BAR_GAP) + 20}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            type="number"
            height={20}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            domain={threshold ? [0, 10] : undefined}
            ticks={threshold ? SCORE_TICKS : undefined}
          />
          <YAxis
            dataKey={labelKey}
            type="category"
            tick={CategoryTick}
            tickLine={false}
            axisLine={BASELINE}
            interval={0}
            width={labelWidth}
          />
          <Tooltip content={ChartTooltip} cursor={{ fill: "var(--surface-01)" }} />
          {threshold && (
            <ReferenceLine x={threshold.value} stroke="var(--destructive)" strokeDasharray="2 3" />
          )}
          <Bar
            dataKey={valueKey}
            name={labelOf(valueKey)}
            barSize={BAR_SIZE}
            radius={[0, BAR_SIZE / 2, BAR_SIZE / 2, 0]}
          >
            {data.map((row, i) => (
              <Cell key={i} fill={categoryColor(row)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={BAR_GAP}>
          <XAxis
            dataKey={chartConfig.xKey}
            tickFormatter={shortName}
            tick={CATEGORY_TICK}
            tickLine={false}
            axisLine={BASELINE}
            interval={0}
            height={20}
          />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={24} tickCount={4} interval={0} />
          <Tooltip content={ChartTooltip} cursor={{ fill: "var(--surface-01)" }} />
          {effectiveYKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              name={labelOf(key)}
              stackId={query.stacked ? "s" : undefined}
              fill={colorAt(i)}
              radius={query.stacked ? undefined : [8, 8, 0, 0]}
            />
          ))}
        </BarChart>
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
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={ChartTooltip} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return <p className="text-body text-muted-foreground">Unsupported chart type</p>;
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
  const height = query.chartHeight ?? 200;
  const ready = !loading && !error && result;
  const headline = ready && !showSql ? query.headline?.(result.data) : null;

  function toggle() {
    setShowSql((v) => !v);
    setHasToggled(true);
    setAnimKey((k) => k + 1);
  }

  return (
    <div
      key={animKey}
      className={`flex h-full flex-col overflow-hidden rounded-card border bg-card px-6 pt-5 pb-5 ${hasToggled ? "chart-panel-animate" : ""}`}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="truncate text-display-xs">{query.title}</h3>
          <p className="truncate text-body text-muted-foreground">{query.description}</p>
        </div>
        <div className="flex h-6 shrink-0 items-center gap-3">
          {headline && (
            <p className="translate-y-px font-mono text-[16px] leading-6 font-medium whitespace-nowrap">
              {headline.value}
              {headline.unit && <span className="text-muted-foreground">{headline.unit}</span>}
              {headline.suffix}
            </p>
          )}
          <button
            onClick={toggle}
            className="flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground transition-colors hover:border-input hover:bg-surface-01 active:border-high-contrast-border active:bg-surface-02 active:opacity-80"
            title={showSql ? "Show chart" : "Show SQL"}
            aria-label={showSql ? "Show chart" : "Show SQL"}
          >
            {showSql ? <BarChart3 className="size-4" /> : <Code2 className="size-4" />}
          </button>
        </div>
      </div>

      {showSql ? (
        <div className="overflow-auto" style={{ maxHeight: `${height + 40}px` }}>
          <SqlHighlight sql={query.sql} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-end">
          {loading && (
            <div className="flex items-center justify-center" style={{ height }}>
              <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center px-3" style={{ height }}>
              <p className="text-center text-caption text-destructive">{error}</p>
            </div>
          )}
          {ready && <ChartRenderer query={query} data={result.data} />}
        </div>
      )}
    </div>
  );
}
