"use client";

import { useCallback } from "react";

export function useTimelineDrag(onMove: (eventId: string, nextStart: Date, nextEnd: Date) => void) {
  return useCallback(
    (eventId: string, nextStart: Date, nextEnd: Date) => {
      onMove(eventId, nextStart, nextEnd);
    },
    [onMove]
  );
}
