"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
});

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function toTheme(value: string | null | undefined, fallback: Theme): Theme {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : fallback;
}

function subscribeToThemeChanges(onChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener("rawtree-theme-change", onChange);
  return () => {
    mediaQuery.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener("rawtree-theme-change", onChange);
  };
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const activeTheme = useSyncExternalStore(
    subscribeToThemeChanges,
    () => toTheme(localStorage.getItem("theme"), "system"),
    () => "system" as Theme
  );
  const systemTheme = useSyncExternalStore<"light" | "dark">(
    subscribeToThemeChanges,
    getSystemTheme,
    () => "light"
  );
  const resolvedTheme: "light" | "dark" =
    activeTheme === "system" ? systemTheme : activeTheme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    localStorage.setItem("theme", nextTheme);
    window.dispatchEvent(new Event("rawtree-theme-change"));
  }, []);

  const value = useMemo(
    () => ({ theme: activeTheme, resolvedTheme, setTheme }),
    [activeTheme, resolvedTheme, setTheme]
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
