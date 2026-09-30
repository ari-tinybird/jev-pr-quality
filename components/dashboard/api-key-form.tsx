"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { AnimatedLines } from "@/components/dashboard/animated-lines";
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
    <section className="relative isolate flex flex-1 items-center justify-center overflow-hidden bg-canvas px-4 py-12">
      <AnimatedLines />

      <div className="relative z-10 flex w-full max-w-[500px] flex-col gap-4">
        <div className="flex flex-col gap-2 px-6 pb-2">
          <p className="hidden text-subheading uppercase text-muted-foreground">Jev + RawTree</p>
          <h1 className="text-display-sm font-medium">Jev-Assisted Pull Request Quality</h1>
          <p className="text-body text-muted-foreground">
            Review complete pull request diffs with Jev, retain structured quality events in RawTree,
            and compare contributors and repositories without counting reruns twice.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-end gap-6 rounded-panel border bg-card p-6"
        >
          <div className="flex w-full flex-col gap-2">
            <h2 className="text-display-xs">Connect to RawTree</h2>
            <p className="text-body">
              Enter a read-only API key to load Jev pull request reviews and compare quality
              across contributors and repositories.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2">
            <label htmlFor="api-key" className="text-body text-muted-foreground">
              Read-only API key
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-12 w-full rounded-[10px] border bg-card px-3 text-[14px] text-muted-foreground outline-none transition-colors placeholder:text-[rgba(38,37,30,0.6)] hover:border-[#a1a1a1] focus:border-primary disabled:opacity-50"
              placeholder="rt_..."
              autoComplete="off"
              required
            />
            <p className="text-caption text-muted-foreground">
              Connecting to <span className="font-mono">{RAWTREE_API_URL.replace("https://", "")}</span>
              {process.env.NODE_ENV !== "production" && (
                <> · Local preview: type <span className="font-mono text-muted-foreground">demo</span> to load sample data</>
              )}
            </p>
          </div>

          <Button type="submit" className="px-4">
            Load dashboard
            <ChevronRight data-icon="inline-end" />
          </Button>
        </form>

        <div className="relative overflow-hidden rounded-panel border border-brand-light bg-card p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: "calc(50% - 46.91px)", top: "calc(50% + 0.29px)", width: 658.179, height: 658.573 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/card-lines.svg" alt="" className="absolute block max-w-none" style={{ inset: "0 0 0 -17.02%" }} />
          </div>
          <div className="relative flex flex-col gap-2 text-body">
            <p className="font-semibold">Your key never leaves this tab</p>
            <p className="text-muted-foreground">
              It stays in memory and is sent directly to{" "}
              <span className="text-foreground">RawTree</span>. It is never saved or sent to the
              dashboard server.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
