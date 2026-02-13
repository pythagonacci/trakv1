"use client";

import React, { createContext, useContext, useState, useTransition, useEffect } from "react";
import { updateCurrentWorkspace, getCurrentWorkspaceId } from "@/app/actions/workspace";
import { useRouter } from "next/navigation";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { logger } from "@/lib/logger";

interface Workspace {
  id: string;
  name: string;
  role: string;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  switchWorkspace: (workspace: Workspace) => Promise<void>;
  isSwitching: boolean;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Set current workspace from cookie when workspaces load
  useEffect(() => {
    if (workspaces.length > 0 && !currentWorkspace) {
      getCurrentWorkspaceId().then((workspaceId) => {
        const workspace = workspaces.find((w) => w.id === workspaceId) || workspaces[0];
        setCurrentWorkspace(workspace);

        // Keep server-rendered pages in sync when cookie is missing/stale.
        if (workspace && workspace.id !== workspaceId) {
          updateCurrentWorkspace(workspace.id).catch((error) => {
            logger.error("Failed to persist initial workspace:", error);
          });
        }
      });
    }
  }, [workspaces, currentWorkspace]);

  const switchWorkspace = async (workspace: Workspace) => {
    // Update client state immediately for optimistic UI
    setCurrentWorkspace(workspace);

    // Update cookie on server
    const result = await updateCurrentWorkspace(workspace.id);

    if (result.error) {
      // Revert on error
      setCurrentWorkspace(currentWorkspace);
      logger.error("Failed to switch workspace:", result.error);
      return;
    }

    // Refresh server data
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        switchWorkspace,
        isSwitching: isPending,
        isLoading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
