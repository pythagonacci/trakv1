"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAI } from "./ai-context";
import { AIPanel } from "./ai-panel";

export function AICommandPalette() {
  const { isOpen, closeCommandPalette } = useAI();
  const pathname = usePathname();
  const [resolvedContext, setResolvedContext] = useState<{ projectId: string | null; tabId: string | null } | null>(null);

  const routeMatch = useMemo(() => {
    const projectMatch = pathname.match(/\/dashboard\/projects\/([^/]+)/);
    const tabMatch = pathname.match(/\/tabs\/([^/]+)/);
    const workflowMatch = pathname.match(/\/dashboard\/workflow\/([^/]+)/);

    return {
      projectParam: projectMatch ? projectMatch[1] : null,
      tabParam: tabMatch ? tabMatch[1] : null,
      workflowTabId: workflowMatch ? workflowMatch[1] : null,
    };
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const hasProjectParams = Boolean(routeMatch.projectParam);
    if (!hasProjectParams) {
      setResolvedContext({
        projectId: null,
        tabId: routeMatch.workflowTabId,
      });
      return;
    }

    let cancelled = false;
    setResolvedContext(null);

    const resolveContext = async () => {
      try {
        const response = await fetch(`/api/route-context?pathname=${encodeURIComponent(pathname)}`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to resolve route context");
        }

        const data = (await response.json()) as {
          projectId?: string | null;
          tabId?: string | null;
        };

        if (!cancelled) {
          setResolvedContext({
            projectId: data.projectId ?? null,
            tabId: data.tabId ?? null,
          });
        }
      } catch {
        if (!cancelled) {
          setResolvedContext({
            projectId: null,
            tabId: null,
          });
        }
      }
    };

    void resolveContext();

    return () => {
      cancelled = true;
    };
  }, [isOpen, pathname, routeMatch.projectParam, routeMatch.workflowTabId]);

  if (!isOpen) return null;
  if (!resolvedContext) return null;

  return (
    <AIPanel
      projectId={resolvedContext.projectId}
      tabId={resolvedContext.tabId}
      variant="modal"
      onClose={closeCommandPalette}
    />
  );
}
