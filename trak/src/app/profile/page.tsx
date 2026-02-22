import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getUserWorkspaces } from "@/app/actions/workspace";
import ProfileContent from "./profile-content";

export default async function ProfilePage() {
  const authResult = await getServerUser();

  if (!authResult) {
    redirect("/login");
  }

  const { user } = authResult;
  const workspacesResult = await getUserWorkspaces();

  if (workspacesResult.error || !workspacesResult.data) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            Error Loading Workspaces
          </h1>
          <p className="text-[var(--muted-foreground)]">
            {workspacesResult.error || "Failed to load your workspaces"}
          </p>
        </div>
      </div>
    );
  }

  const workspaces = workspacesResult.data.map((w: any) => ({
    id: w.id as string,
    name: w.name as string,
    role: w.role as string,
    owner_id: w.owner_id as string,
    created_at: w.created_at as string,
  }));

  return (
    <ProfileContent
      user={{ id: user.id, email: user.email || "" }}
      initialWorkspaces={workspaces}
    />
  );
}
