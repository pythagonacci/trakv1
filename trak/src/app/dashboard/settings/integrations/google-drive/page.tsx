import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { getWorkspaceDriveConnection } from "@/app/actions/google-drive";
import GoogleDriveSettingsClient from "./settings-client";

export default async function GoogleDriveSettingsPage() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/dashboard");

  const access = await requireWorkspaceAccess(workspaceId);
  if ("error" in access) redirect("/login");

  const connectionResult = await getWorkspaceDriveConnection(workspaceId);
  const connection = "data" in connectionResult ? (connectionResult.data ?? null) : null;
  const canManage = "canManage" in connectionResult ? Boolean(connectionResult.canManage) : false;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/dashboard/settings"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        ← Back to Settings
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Google Drive Integration</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Connect one Google Drive account for this workspace. Trak remains the operational surface while Drive stays the storage provider.
        </p>
      </div>

      <GoogleDriveSettingsClient workspaceId={workspaceId} connection={connection} canManage={canManage} />
    </div>
  );
}
