"use client";

import { useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  onDisconnect: () => void;
}

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
  onDisconnect,
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
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-2">
      <span className="font-mono text-[10px] text-muted-foreground">{endpoint}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <select
          aria-label="Repository"
          value={repository}
          onChange={(event) => onRepositoryChange(event.target.value)}
          className="h-8 max-w-64 rounded-md border bg-background px-2 text-xs"
        >
          <option value="">All repositories</option>
          {repositories.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <label className="text-xs text-muted-foreground" htmlFor="date-from">From</label>
        <input
          id="date-from"
          type="date"
          value={localFrom}
          onChange={(event) => setLocalFrom(event.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        />
        <label className="text-xs text-muted-foreground" htmlFor="date-to">To</label>
        <input
          id="date-to"
          type="date"
          value={localTo}
          onChange={(event) => setLocalTo(event.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        />
        <Button variant="ghost" size="sm" className="h-8" onClick={() => onDateChange(localFrom, localTo)}>
          Apply
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={autoRefresh} onChange={onAutoRefreshToggle} /> 30s
        </label>
        <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={onRefresh}>
          <RefreshCw className="size-3" /> Refresh
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={onDisconnect}>
          <LogOut className="size-3" /> Disconnect
        </Button>
      </div>
    </div>
  );
}
