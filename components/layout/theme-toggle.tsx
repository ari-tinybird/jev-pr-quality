"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useAppTheme } from "@/components/theme-provider";

const subscribeMounted = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useAppTheme();
  const mounted = useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false
  );
  const value = mounted ? resolvedTheme : null;

  return (
    <button
      className={cn(
        "inline-flex items-center rounded-full border p-1 *:rounded-full",
        className
      )}
      aria-label="Toggle Theme"
      onClick={() => setTheme(value === "light" ? "dark" : "light")}
    >
      <Sun
        fill="currentColor"
        className={cn(
          "size-6.5 p-1.5",
          value === "light"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground"
        )}
      />
      <Moon
        fill="currentColor"
        className={cn(
          "size-6.5 p-1.5",
          value === "dark"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground"
        )}
      />
    </button>
  );
}
