import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { EverythingView } from "@/components/everything/everything-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EverythingPage() {
  // Get current workspace
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/dashboard");

  // Verify access
  const authResult = await requireWorkspaceAccess(workspaceId);
  if ("error" in authResult) redirect("/login");

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full px-2 md:px-3 lg:px-4">
        <div className="max-w-[1600px] mx-auto pt-4 pb-8">
          <EverythingView workspaceId={workspaceId} />
        </div>
      </div>
    </div>
  );
}
