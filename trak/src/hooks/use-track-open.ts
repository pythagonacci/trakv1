"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

type EntityType = "project" | "doc";

type TrackOpenOptions = {
  tabId?: string | null;
};

export function useTrackOpen(entityType: EntityType, entityId: string | null | undefined, options?: TrackOpenOptions) {
  const queryClient = useQueryClient();
  const tabId = options?.tabId ?? null;

  useEffect(() => {
    if (!entityId) return;

    const payload = JSON.stringify({ entityType, entityId, ...(tabId ? { tabId } : {}) });
    const url = "/api/navigation/open";
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
        if (!cancelled && res.ok) {
          // Sidebar query uses staleTime 5m + refetchOnMount false; invalidate so Recent lists update.
          await queryClient.invalidateQueries({ queryKey: ["sidebar-sections"], refetchType: "active" });
        }
      } catch {
        // Navigation must not depend on telemetry.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId, entityType, queryClient, tabId]);
}
