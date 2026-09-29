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

export interface DashboardQuery {
  id: string;
  title: string;
  description: string;
  sql: string;
  chartType: "area" | "bar" | "horizontal-bar" | "line" | "pie";
  chartConfig: {
    xKey: string;
    yKeys: string[];
    colors?: string[];
  };
  skipDateFilter?: boolean;
  colSpan?: 1 | 2 | 3 | 4;
  groupKey?: string;
  showLegend?: boolean;
  chartHeight?: number;
  stacked?: boolean;
}
