"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";

type Disconnect = (() => void) | null;

const HeaderActionsContext = createContext<{
  onDisconnect: Disconnect;
  setOnDisconnect: (handler: Disconnect) => void;
}>({ onDisconnect: null, setOnDisconnect: () => {} });

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [onDisconnect, setHandler] = useState<Disconnect>(null);
  const setOnDisconnect = useCallback((handler: Disconnect) => setHandler(() => handler), []);
  const value = useMemo(() => ({ onDisconnect, setOnDisconnect }), [onDisconnect, setOnDisconnect]);
  return <HeaderActionsContext value={value}>{children}</HeaderActionsContext>;
}

export function useHeaderActions() {
  return useContext(HeaderActionsContext);
}

export function HeaderActions() {
  const { onDisconnect } = useHeaderActions();
  if (!onDisconnect) return null;
  return (
    <button
      type="button"
      onClick={onDisconnect}
      className="flex h-9 shrink-0 items-center gap-2.5 rounded-full border bg-card px-4 text-body font-semibold transition-colors hover:border-primary active:border-primary active:bg-primary active:text-primary-foreground"
    >
      <LogOut className="size-4" /> Disconnect
    </button>
  );
}
