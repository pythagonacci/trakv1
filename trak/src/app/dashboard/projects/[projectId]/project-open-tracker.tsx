"use client";

import { useParams } from "next/navigation";
import { useTrackOpen } from "@/hooks/use-track-open";
import { matchesReadableEntity } from "@/lib/dashboard-routes";

type ProjectTabInfo = {
  id: string;
  name: string;
  children?: ProjectTabInfo[];
};

function resolveCanonicalTabId(tabParam: string | null, tabs: ProjectTabInfo[]): string | null {
  if (!tabParam) return null;

  const stack = [...tabs];
  while (stack.length > 0) {
    const current = stack.shift()!;
    if (matchesReadableEntity(tabParam, current.name, current.id)) {
      return current.id;
    }
    if (current.children?.length) {
      stack.push(...current.children);
    }
  }

  return null;
}

export default function ProjectOpenTracker({
  projectId,
  tabId,
  tabs,
}: {
  projectId: string;
  tabId?: string | null;
  tabs: ProjectTabInfo[];
}) {
  const params = useParams<{ tabId?: string }>();
  const routeTabParam = typeof params?.tabId === "string" ? params.tabId : null;
  const currentTabId = resolveCanonicalTabId(routeTabParam, tabs) ?? tabId ?? null;

  useTrackOpen("project", projectId, { tabId: currentTabId });
  return null;
}
