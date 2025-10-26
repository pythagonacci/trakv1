import { getUserWorkspaces } from "@/app/actions/workspace";
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
  const workspaces = workspacesResult.data || [];
  const currentWorkspace = workspaces[0] || null;

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