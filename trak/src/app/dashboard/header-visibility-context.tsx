"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface DashboardHeaderContextValue {
  headerHidden: boolean;
  setHeaderHidden: (hidden: boolean) => void;
}

const DashboardHeaderContext = createContext<DashboardHeaderContextValue | undefined>(undefined);

export function DashboardHeaderProvider({ children }: { children: React.ReactNode }) {
  const [headerHidden, setHeaderHidden] = useState(false);
  const value = useMemo(() => ({ headerHidden, setHeaderHidden }), [headerHidden]);

  return (
    <DashboardHeaderContext.Provider value={value}>
      {children}
    </DashboardHeaderContext.Provider>
  );
}

export function useDashboardHeader() {
  const context = useContext(DashboardHeaderContext);
  if (!context) {
    throw new Error("useDashboardHeader must be used within a DashboardHeaderProvider");
  }
  return context;
}

