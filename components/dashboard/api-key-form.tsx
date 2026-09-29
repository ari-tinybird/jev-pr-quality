"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RAWTREE_API_URL, type RawtreeConfig } from "@/lib/rawtree-api";

export function ApiKeyForm({
  onConnect,
}: {
  onConnect: (config: RawtreeConfig) => void;
}) {
  const [apiKey, setApiKey] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const config = { endpoint: RAWTREE_API_URL, apiKey: apiKey.trim() };
    onConnect(config);
  }

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <div className="mb-6 inline-flex size-14 items-center justify-center rounded-xl border bg-card">
        <KeyRound className="size-7 text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">Connect to RawTree</h2>
      <p className="mb-8 text-sm text-muted-foreground">
        Enter a read-only API key to load Jev review events directly from RawTree.
        The key stays in this tab&apos;s memory and is never saved or sent to the
        dashboard server.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <label className="mb-1.5 block text-xs font-medium">
            Read-only API key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="rt_..."
            required
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Connecting to <span className="font-mono">{RAWTREE_API_URL}</span>
          </p>
        </div>
        <Button className="w-full" type="submit">
          Load Jev dashboard
        </Button>
      </form>
    </div>
  );
}
