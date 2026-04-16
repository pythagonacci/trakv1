"use client";

import { useMemo } from "react";
import { useTabNavigation } from "./tab-navigation-context";
import TabCanvasWrapper from "./tabs/[tabId]/tab-canvas-wrapper";
import { TabContentsProvider } from "./tabs/[tabId]/tab-contents-context";

interface TabInfo {
  id: string;
  name: string;
  position: number;
  is_client_visible?: boolean;
  client_title?: string | null;
  is_workflow_page?: boolean;
  children?: TabInfo[];
}

interface ClientTabShellProps {
  projectId: string;
  projectName: string;
  workspaceId: string;
  tabs: TabInfo[];
  lockedBlockIds: string[];
  children: React.ReactNode;
}

function computeSubtabConfig(tabId: string, tabs: TabInfo[]) {
  for (const parentTab of tabs) {
    if (parentTab.children && parentTab.children.length > 0) {
      if (parentTab.children.some((child) => child.id === tabId) || parentTab.id === tabId) {
        return {
          parentTabId: parentTab.id,
          parentTabName: parentTab.name,
          subtabs: parentTab.children.map((c) => ({ id: c.id, name: c.name, position: c.position })),
        };
      }
    }
  }
  return null;
}

export default function ClientTabShell({
  projectId,
  projectName,
  workspaceId,
  tabs,
  lockedBlockIds,
  children,
}: ClientTabShellProps) {
  const tabNav = useTabNavigation();
  const isClientSideNav = tabNav?.isClientSideNav ?? false;
  const clientTabId = tabNav?.clientTabId ?? null;

  const subtabConfig = useMemo(
    () => (clientTabId ? computeSubtabConfig(clientTabId, tabs) : null),
    [clientTabId, tabs],
  );

  if (isClientSideNav && clientTabId) {
    return (
      <TabContentsProvider blocks={[]} tabId={clientTabId} subtabConfig={subtabConfig}>
        <div className="flex flex-col flex-1 min-h-0">
          <TabCanvasWrapper
            tabId={clientTabId}
            projectId={projectId}
            projectName={projectName}
            workspaceId={workspaceId}
            lockedBlockIds={lockedBlockIds}
          />
        </div>
      </TabContentsProvider>
    );
  }

  return <>{children}</>;
}
