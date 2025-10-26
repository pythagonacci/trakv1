import { getUserWorkspaces } from "@/app/actions/workspace";
import DashboardLayoutClient from "./layout-client";
import { WorkspaceProvider } from "./workspace-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch user's workspaces
  const workspacesResult = await getUserWorkspaces();
  
  const workspaces = workspacesResult.data || [];
  const currentWorkspace = workspaces[0] || null; // Use first workspace as current for now

  return (
    <WorkspaceProvider
      initialWorkspaces={workspaces}
      initialCurrentWorkspace={currentWorkspace}
    >
      <DashboardLayoutClient>
        {children}
      </DashboardLayoutClient>
    </WorkspaceProvider>
  );
}