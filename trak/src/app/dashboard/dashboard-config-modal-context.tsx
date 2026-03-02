"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

interface DashboardConfigModalContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const DashboardConfigModalContext = createContext<DashboardConfigModalContextValue | null>(null);

export function DashboardConfigModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <DashboardConfigModalContext.Provider value={{ isOpen, open, close }}>
      {children}
    </DashboardConfigModalContext.Provider>
  );
}

export function useDashboardConfigModal() {
  const ctx = useContext(DashboardConfigModalContext);
  return ctx;
}
