export interface DashboardStat {
  label: string;
  sqlExpression: string;
  key: string;
}

export interface DashboardConfig {
  table: string;
  dateExpression: string;
  dedupIdColumn: string;
  dedupTsColumn: string;
  stats: DashboardStat[];
}

export interface TableColumn {
  key: string;
  label: string;
  format?: "text" | "number" | "score" | "percent";
  width?: number;
}

export interface Headline {
  value: string;
  unit?: string;
  suffix?: string;
}

export interface DashboardQuery {
  id: string;
  title: string;
  description: string;
  sql: string;
  chartType: "area" | "bar" | "horizontal-bar" | "line" | "pie" | "table";
  chartConfig: {
    xKey: string;
    yKeys: string[];
    colors?: string[];
    seriesLabels?: Record<string, string>;
    categoryColors?: Record<string, string>;
  };
  columns?: TableColumn[];
  threshold?: { value: number; label: string };
  headline?: (rows: Record<string, unknown>[]) => Headline | null;
  skipDateFilter?: boolean;
  colSpan?: 1 | 2 | 3 | 4;
  groupKey?: string;
  showLegend?: boolean;
  chartHeight?: number;
  stacked?: boolean;
}
