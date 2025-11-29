"use client";

import React, { createContext, useContext, useState, useTransition } from "react";
import { updateCurrentWorkspace } from "@/app/actions/workspace";
import { useRouter } from "next/navigation";

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
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({
  children,
  initialWorkspaces,
  initialCurrentWorkspace,
}: {
  children: React.ReactNode;
  initialWorkspaces: Workspace[];
  initialCurrentWorkspace: Workspace | null;
}) {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    initialCurrentWorkspace
  );
  const [workspaces] = useState<Workspace[]>(initialWorkspaces);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const switchWorkspace = async (workspace: Workspace) => {
    // Update client state immediately for optimistic UI
    setCurrentWorkspace(workspace);
    
    // Update cookie on server
    const result = await updateCurrentWorkspace(workspace.id);
    
    if (result.error) {
      // Revert on error
      setCurrentWorkspace(currentWorkspace);
      console.error("Failed to switch workspace:", result.error);
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