"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAI } from "./ai-context";
import { AIPanel } from "./ai-panel";

export function AICommandPalette() {
  const { isOpen, closeCommandPalette } = useAI();
  const pathname = usePathname();

  const pathMatch = useMemo(() => {
    const projectMatch = pathname.match(/\/dashboard\/projects\/([^/]+)/);
    const tabMatch = pathname.match(/\/tabs\/([^/]+)/);
    const workflowMatch = pathname.match(/\/dashboard\/workflow\/([^/]+)/);

    return {
      projectId: projectMatch ? projectMatch[1] : null,
      tabId: tabMatch ? tabMatch[1] : workflowMatch ? workflowMatch[1] : null,
    };
  }, [pathname]);

  if (!isOpen) return null;

  return (
    <AIPanel
      projectId={pathMatch.projectId}
      tabId={pathMatch.tabId}
      variant="modal"
      onClose={closeCommandPalette}
    />
  );
}
