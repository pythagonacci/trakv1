import { getUserWorkspaces, getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getCurrentUser } from "@/app/actions/auth";
import DashboardLayoutClient from "./layout-client";
import { WorkspaceProvider } from "./workspace-context";
import { ThemeProvider } from "./theme-context";

// Remove force-dynamic from layout - let individual pages decide
// User data is cached per request with React.cache() so multiple calls are deduped
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  type Workspace = { id: string; name: string; role: string };
  // Fetch user's workspaces (cached with React.cache())
  const workspacesResult = await getUserWorkspaces();
  const workspacesData = workspacesResult.data || [];
  
  // Transform workspace data to expected format
  const workspaces: Workspace[] = ((workspacesData ?? []) as unknown as Workspace[]).map((w: Workspace) => ({
    id: w.id,
    name: w.name,
    role: w.role,
  }));

  // Get current workspace from cookie (READ ONLY - don't set)
  const currentWorkspaceId = await getCurrentWorkspaceId();
  
  // Find the current workspace object, or use first workspace if no cookie
  const currentWorkspace = 
    workspaces.find((w: Workspace) => w.id === currentWorkspaceId) || 
    workspaces[0] || 
    null;

  // Fetch current user (cached with React.cache())
  const userResult = await getCurrentUser();
  const user = userResult.data || null;

  return (
    <ThemeProvider>
      <WorkspaceProvider
        initialWorkspaces={workspaces}
        initialCurrentWorkspace={currentWorkspace}
      >
        <DashboardLayoutClient currentUser={user}>
          {children}
        </DashboardLayoutClient>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}