"use client";

import React, { createContext, useContext, useCallback, useState, useMemo } from "react";

type CardCountMap = Record<string, number>;

interface CardCountContextValue {
  cardCounts: CardCountMap;
  setCardCount: (blockId: string, count: number) => void;
}

const CardCountContext = createContext<CardCountContextValue | null>(null);

export function CardCountProvider({ children }: { children: React.ReactNode }) {
  const [cardCounts, setCardCounts] = useState<CardCountMap>({});

  const setCardCount = useCallback((blockId: string, count: number) => {
    setCardCounts((prev) => {
      if (prev[blockId] === count) return prev;
      return { ...prev, [blockId]: count };
    });
  }, []);

  const value = useMemo(
    () => ({ cardCounts, setCardCount }),
    [cardCounts, setCardCount]
  );

  return (
    <CardCountContext.Provider value={value}>
      {children}
    </CardCountContext.Provider>
  );
}

export function useCardCountContext() {
  return useContext(CardCountContext);
}
