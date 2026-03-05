"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DrivePickerModal } from "@/components/integrations/google-drive/drive-picker-modal";
import { ExternalAssetCard } from "@/components/integrations/google-drive/external-asset-card";

type Mapping = {
  id: string;
  project_id: string;
  workspace_id: string;
  drive_folder_asset_id: string;
  asset:
    | {
        id: string;
        provider_item_id: string;
        name: string;
        web_view_link?: string | null;
        mime_type?: string | null;
        modified_time?: string | null;
        owner_display?: string | null;
      }
    | Array<{
        id: string;
        provider_item_id: string;
        name: string;
        web_view_link?: string | null;
        mime_type?: string | null;
        modified_time?: string | null;
        owner_display?: string | null;
      }>
    | null;
};

interface ProjectGoogleDriveSettingsClientProps {
  workspaceId: string;
  projectId: string;
  projectName: string;
  initialMapping: Mapping | null;
}

export default function ProjectGoogleDriveSettingsClient({
  workspaceId,
  projectId,
  projectName,
  initialMapping,
}: ProjectGoogleDriveSettingsClientProps) {
  const [mapping, setMapping] = useState<Mapping | null>(initialMapping);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);

  const asset = mapping?.asset ? (Array.isArray(mapping.asset) ? mapping.asset[0] : mapping.asset) : null;

  const refresh = async () => {
    const response = await fetch(`/api/integrations/google-drive/projects/${projectId}/folder`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) setMapping(payload.data || null);
  };

  const mapExistingFolder = async (folderId: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/google-drive/projects/${projectId}/folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "attach_existing",
          folderId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to map folder");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to map folder");
    } finally {
      setBusy(false);
    }
  };

  const createFolderInParent = async (parentFolderId?: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/integrations/google-drive/projects/${projectId}/folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "create_new",
          parentFolderId,
          projectName,
          name: projectName,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to create folder");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Canonical Project Folder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {asset ? (
          <ExternalAssetCard
            asset={{
              id: asset.id,
              item_kind: "folder",
              name: asset.name,
              mime_type: asset.mime_type,
              web_view_link: asset.web_view_link,
              modified_time: asset.modified_time,
              owner_display: asset.owner_display,
            }}
          />
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">No folder mapped yet.</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setAttachOpen(true)} disabled={busy}>
            Attach existing folder
          </Button>
          <Button variant="outline" onClick={() => createFolderInParent(undefined)} disabled={busy}>
            {busy ? "Working..." : "Create new folder"}
          </Button>
          <Button variant="outline" onClick={() => setParentPickerOpen(true)} disabled={busy}>
            Create in selected parent
          </Button>
        </div>

        <DrivePickerModal
          isOpen={attachOpen}
          onClose={() => setAttachOpen(false)}
          workspaceId={workspaceId}
          foldersOnly
          multiSelect={false}
          title="Attach Existing Drive Folder"
          onSelect={(items) => {
            const folder = items[0];
            if (folder) {
              void mapExistingFolder(folder.providerItemId);
            }
          }}
        />

        <DrivePickerModal
          isOpen={parentPickerOpen}
          onClose={() => setParentPickerOpen(false)}
          workspaceId={workspaceId}
          foldersOnly
          multiSelect={false}
          title="Choose Parent Folder"
          onSelect={(items) => {
            const folder = items[0];
            void createFolderInParent(folder?.providerItemId);
          }}
        />
      </CardContent>
    </Card>
  );
}
