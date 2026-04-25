"use client";

import { useEffect } from "react";

type EntityType = "project" | "doc";

export function useTrackOpen(entityType: EntityType, entityId: string | null | undefined) {
  useEffect(() => {
    if (!entityId) return;

    const payload = JSON.stringify({ entityType, entityId });
    const url = "/api/navigation/open";

    // Fire and forget: navigation should never wait on this.
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }, [entityId, entityType]);
}
