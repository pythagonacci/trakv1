import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import DashboardClient from "./dashboard-client";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const workspaceId = await getCurrentWorkspaceId();

  // Auth check
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-[var(--tertiary-foreground)]">No workspace selected</p>
        </div>
      </div>
    );
  }

  return <DashboardClient workspaceId={workspaceId} />;
}
