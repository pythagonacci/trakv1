"use client";

import React, { createContext, useContext, useState } from "react";

interface Workspace {
  id: string;
  name: string;
  role: string;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  setCurrentWorkspace: (workspace: Workspace) => void;
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

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        setCurrentWorkspace,
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