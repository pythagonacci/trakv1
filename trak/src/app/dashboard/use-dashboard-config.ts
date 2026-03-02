"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  type DashboardLayoutConfig,
  getDefaultDashboardConfig,
  getDashboardConfigStorageKey,
} from "./dashboard-config-types";

function readConfig(workspaceId: string): DashboardLayoutConfig {
  if (typeof window === "undefined") return getDefaultDashboardConfig();
  try {
    const raw = localStorage.getItem(getDashboardConfigStorageKey(workspaceId));
    if (!raw) return getDefaultDashboardConfig();
    const parsed = JSON.parse(raw) as DashboardLayoutConfig;
    if (!parsed?.widgets || !Array.isArray(parsed.widgets)) {
      return getDefaultDashboardConfig();
    }
    return { version: parsed.version ?? 1, widgets: parsed.widgets };
  } catch {
    return getDefaultDashboardConfig();
  }
}

const cache = new Map<string, DashboardLayoutConfig>();
const listeners = new Set<() => void>();

function getCachedOrRead(workspaceId: string): DashboardLayoutConfig {
  const key = getDashboardConfigStorageKey(workspaceId);
  const existing = cache.get(key);
  const next = readConfig(workspaceId);
  if (existing && JSON.stringify(existing) === JSON.stringify(next)) {
    return existing;
  }
  cache.set(key, next);
  return next;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notify() {
  listeners.forEach((cb) => cb());
}

export function useDashboardConfig(workspaceId: string | undefined) {
  const wsId = workspaceId ?? "";

  const config = useSyncExternalStore(
    subscribe,
    () => getCachedOrRead(wsId),
    () => getDefaultDashboardConfig(),
    () => getCachedOrRead(wsId)
  );

  const setConfig = useCallback(
    (next: DashboardLayoutConfig) => {
      if (!workspaceId) return;
      try {
        const key = getDashboardConfigStorageKey(workspaceId);
        localStorage.setItem(key, JSON.stringify(next));
        cache.set(key, next);
        notify();
      } catch {
        // ignore
      }
    },
    [workspaceId]
  );

  return { config, setConfig };
}
