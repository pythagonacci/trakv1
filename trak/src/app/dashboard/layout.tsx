import { getUserWorkspaces, getCurrentWorkspaceId, updateCurrentWorkspace } from "@/app/actions/workspace";
import { getCurrentUser } from "@/app/actions/auth";
import DashboardLayoutClient from "./layout-client";
import { WorkspaceProvider } from "./workspace-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch user's workspaces
  const workspacesResult = await getUserWorkspaces();
  const workspacesData = workspacesResult.data || [];
  
  // Transform workspace data to match expected format
  const workspaces = workspacesData.map((w: any) => ({
    id: w.workspace_id,
    name: w.workspace_name,
    role: w.role,
  }));

  // Get current workspace from cookie
  let currentWorkspaceId = await getCurrentWorkspaceId();
  
  // If no cookie set and user has workspaces, set cookie to first workspace
  if (!currentWorkspaceId && workspaces.length > 0) {
    await updateCurrentWorkspace(workspaces[0].id);
    currentWorkspaceId = workspaces[0].id;
  }
  
  // Find the current workspace object
  const currentWorkspace = workspaces.find((w: any) => w.id === currentWorkspaceId) || workspaces[0] || null;

  // Fetch current user
  const userResult = await getCurrentUser();
  const user = userResult.data || null;

  return (
    <WorkspaceProvider
      initialWorkspaces={workspaces}
      initialCurrentWorkspace={currentWorkspace}
    >
      <DashboardLayoutClient currentUser={user}>
        {children}
      </DashboardLayoutClient>
    </WorkspaceProvider>
  );
}