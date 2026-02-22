"use client";

import type { SavedEverythingView, EverythingViewConfig } from "@/types/everything";

const STORAGE_KEY_PREFIX = "everything-saved-views";

function storageKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}-${workspaceId}`;
}

export function getSavedViews(workspaceId: string): SavedEverythingView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedEverythingView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setSavedViews(
  workspaceId: string,
  views: SavedEverythingView[]
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(workspaceId),
      JSON.stringify(views)
    );
  } catch {
    // ignore
  }
}

export function addSavedView(
  workspaceId: string,
  name: string,
  config: EverythingViewConfig
): SavedEverythingView {
  const views = getSavedViews(workspaceId);
  const view: SavedEverythingView = {
    id: crypto.randomUUID(),
    name,
    config,
    updatedAt: new Date().toISOString(),
  };
  views.push(view);
  setSavedViews(workspaceId, views);
  return view;
}

export function updateSavedView(
  workspaceId: string,
  id: string,
  updates: { name?: string; config?: EverythingViewConfig }
): SavedEverythingView | null {
  const views = getSavedViews(workspaceId);
  const index = views.findIndex((v) => v.id === id);
  if (index === -1) return null;
  views[index] = {
    ...views[index],
    ...(updates.name !== undefined && { name: updates.name }),
    ...(updates.config !== undefined && { config: updates.config }),
    updatedAt: new Date().toISOString(),
  };
  setSavedViews(workspaceId, views);
  return views[index];
}

export function deleteSavedView(
  workspaceId: string,
  id: string
): boolean {
  const views = getSavedViews(workspaceId).filter((v) => v.id !== id);
  if (views.length === getSavedViews(workspaceId).length) return false;
  setSavedViews(workspaceId, views);
  return true;
}
