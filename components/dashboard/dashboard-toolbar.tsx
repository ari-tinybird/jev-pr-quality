"use client";

import { useState } from "react";
import { Check, ChevronDown, RefreshCw } from "lucide-react";

interface DashboardToolbarProps {
  endpoint: string;
  repositories: string[];
  repository: string;
  dateFrom: string;
  dateTo: string;
  autoRefresh: boolean;
  onRepositoryChange: (repository: string) => void;
  onDateChange: (from: string, to: string) => void;
  onAutoRefreshToggle: () => void;
  onRefresh: () => void;
}

const PILL_BASE = "flex h-9 shrink-0 items-center gap-2.5 rounded-full border bg-card px-4 text-body font-semibold transition-colors";
const FIELD = `${PILL_BASE} hover:border-primary active:border-brand-dark`;
const BUTTON = `${PILL_BASE} hover:border-primary active:border-primary active:bg-primary active:text-primary-foreground`;

export function DashboardToolbar({
  endpoint,
  repositories,
  repository,
  dateFrom,
  dateTo,
  autoRefresh,
  onRepositoryChange,
  onDateChange,
  onAutoRefreshToggle,
  onRefresh,
}: DashboardToolbarProps) {
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo, setLocalTo] = useState(dateTo);
  const [previousFrom, setPreviousFrom] = useState(dateFrom);
  const [previousTo, setPreviousTo] = useState(dateTo);

  if (dateFrom !== previousFrom) {
    setPreviousFrom(dateFrom);
    setLocalFrom(dateFrom);
  }
  if (dateTo !== previousTo) {
    setPreviousTo(dateTo);
    setLocalTo(dateTo);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-panel border bg-surface-01 p-2 xl:flex-nowrap">
      <span className="min-w-0 flex-1 truncate pl-3 font-mono text-code text-muted-foreground">{endpoint}</span>
      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2 xl:flex-nowrap">
        <label className={`${FIELD} relative cursor-pointer pr-3`}>
          <span className="sr-only">Repository</span>
          <select
            value={repository}
            onChange={(event) => onRepositoryChange(event.target.value)}
            className="max-w-56 cursor-pointer appearance-none truncate bg-transparent pr-6 outline-none"
          >
            <option value="">All repositories</option>
            {repositories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 size-4" />
        </label>
        <label className="text-body text-muted-foreground" htmlFor="date-from">From</label>
        <input
          id="date-from"
          type="date"
          value={localFrom}
          onChange={(event) => setLocalFrom(event.target.value)}
          className={`${FIELD} outline-none`}
        />
        <label className="text-body text-muted-foreground" htmlFor="date-to">To</label>
        <input
          id="date-to"
          type="date"
          value={localTo}
          onChange={(event) => setLocalTo(event.target.value)}
          className={`${FIELD} outline-none`}
        />
        <button type="button" onClick={() => onDateChange(localFrom, localTo)} className={BUTTON}>
          Apply
        </button>
        <label className="group flex cursor-pointer items-center gap-2 px-2 text-body">
          <input type="checkbox" checked={autoRefresh} onChange={onAutoRefreshToggle} className="peer sr-only" />
          <span
            aria-hidden
            className="flex size-4 items-center justify-center rounded-[6px] border border-input bg-card transition-colors group-hover:border-high-contrast-border peer-checked:border-primary peer-checked:bg-primary group-hover:peer-checked:border-primary-hover group-hover:peer-checked:bg-primary-hover peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50"
          >
            {autoRefresh && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
          </span>
          30s
        </label>
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-card transition-colors hover:border-primary active:border-brand-dark"
        >
          <RefreshCw className="size-4" />
          <span className="sr-only">Refresh</span>
        </button>
      </div>
    </div>
  );
}
