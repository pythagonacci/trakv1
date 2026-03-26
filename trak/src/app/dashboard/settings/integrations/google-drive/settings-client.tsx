"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DriveConnectionSummary = {
  id: string;
  workspace_id: string;
  google_account_email: string;
  scopes: string[];
  created_at: string;
  updated_at: string;
  token_expiry: string | null;
};

interface GoogleDriveSettingsClientProps {
  workspaceId: string;
  connection: DriveConnectionSummary | null;
  canManage: boolean;
}

export default function GoogleDriveSettingsClient({
  workspaceId,
  connection,
  canManage,
}: GoogleDriveSettingsClientProps) {
  const [busy, setBusy] = useState(false);
  const connectedAt = useMemo(
    () => (connection ? new Date(connection.created_at).toLocaleString() : null),
    [connection]
  );

  const handleConnect = (forceConsent = false) => {
    const url = new URL(`/api/integrations/google-drive/connect`, window.location.origin);
    url.searchParams.set("workspace_id", workspaceId);
    if (forceConsent) url.searchParams.set("force_consent", "1");
    window.location.href = url.toString();
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google Drive for this workspace?")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/integrations/google-drive", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || "Failed to disconnect");
      }
      window.location.reload();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Failed to disconnect Google Drive");
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Drive</CardTitle>
        <CardDescription>
          Link files and folders from Drive, map project folders, and preview assets inline without moving storage out of Drive.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {connection ? (
          <>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
              <p className="text-sm font-medium">Connected</p>
              <p className="text-sm text-[var(--muted-foreground)]">Account: {connection.google_account_email}</p>
              <p className="text-sm text-[var(--muted-foreground)]">Connected at: {connectedAt}</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                Scopes: {connection.scopes?.length ? connection.scopes.join(", ") : "None"}
              </p>
            </div>

            {canManage ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => handleConnect(true)} disabled={busy}>
                  Reconnect
                </Button>
                <Button variant="outline" onClick={handleDisconnect} disabled={busy}>
                  {busy ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                Only workspace admins can reconnect or disconnect the integration.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--muted-foreground)]">Google Drive is not connected for this workspace.</p>
            {canManage ? (
              <Button onClick={() => handleConnect(false)}>Connect Google Drive</Button>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                Only workspace admins can connect Google Drive.
              </p>
            )}
          </>
        )}

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-hover)] p-4 text-sm">
          <p className="font-medium">What Saria can access</p>
          <ul className="ml-4 mt-2 list-disc space-y-1 text-[var(--muted-foreground)]">
            <li>Read metadata for files and folders you link.</li>
            <li>Create folders/files only when you use mapped-folder creation features.</li>
            <li>Saria does not automatically change Google Drive sharing permissions.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
