"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalAssetCard } from "@/components/integrations/google-drive/external-asset-card";
import { DrivePreviewModal } from "@/components/integrations/google-drive/preview-modal";

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
      }
    | Array<{
        id: string;
        provider_item_id: string;
        name: string;
        web_view_link?: string | null;
      }>
    | null;
};

type DriveListItem = {
  id: string;
  provider_item_id: string;
  item_kind: "file" | "folder";
  name: string;
  mime_type?: string | null;
  web_view_link?: string | null;
  thumbnail_link?: string | null;
  icon_link?: string | null;
  modified_time?: string | null;
  owner_display?: string | null;
  stale_state?: "active" | "not_found" | "trashed";
};

interface ProjectDriveClientProps {
  workspaceId: string;
  projectId: string;
  mapping: Mapping | null;
}

export default function ProjectDriveClient({ workspaceId, projectId, mapping }: ProjectDriveClientProps) {
  const [items, setItems] = useState<DriveListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<{ id: string; name: string; web_view_link?: string | null } | null>(null);

  const mappedFolder = useMemo(
    () => (mapping?.asset ? (Array.isArray(mapping.asset) ? mapping.asset[0] : mapping.asset) : null),
    [mapping]
  );

  useEffect(() => {
    if (!mappedFolder) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/integrations/google-drive/projects/${projectId}/list`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load folder contents");
        }
        setItems(payload.data || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load folder contents");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [mappedFolder, projectId]);

  if (!mappedFolder) {
    return (
      <div className="rounded-md border border-[var(--border)] p-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          No canonical Drive folder mapped yet for this project.
        </p>
        <Link
          href={`/dashboard/projects/${projectId}/integrations/google-drive`}
          className="mt-2 inline-flex text-sm text-[var(--foreground)] underline"
        >
          Set up folder mapping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--border)] p-4">
        <p className="text-sm font-medium">Mapped folder</p>
        <p className="text-sm text-[var(--muted-foreground)]">{mappedFolder.name}</p>
        {mappedFolder.web_view_link && (
          <a
            href={mappedFolder.web_view_link}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--foreground)] underline"
          >
            Open folder in Drive
          </a>
        )}
      </div>

      {loading && <p className="text-sm text-[var(--muted-foreground)]">Loading folder contents...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {items.map((item) => (
          <ExternalAssetCard
            key={item.provider_item_id}
            asset={{
              id: item.id,
              item_kind: item.item_kind,
              name: item.name,
              mime_type: item.mime_type,
              web_view_link: item.web_view_link,
              icon_link: item.icon_link,
              thumbnail_link: item.thumbnail_link,
              modified_time: item.modified_time,
              owner_display: item.owner_display,
              stale_state: item.stale_state,
            }}
            onPreview={() =>
              setPreviewAsset({
                id: item.id,
                name: item.name,
                web_view_link: item.web_view_link,
              })
            }
          />
        ))}
      </div>

      <DrivePreviewModal
        isOpen={!!previewAsset}
        onClose={() => setPreviewAsset(null)}
        workspaceId={workspaceId}
        asset={
          previewAsset
            ? {
                id: previewAsset.id,
                name: previewAsset.name,
                web_view_link: previewAsset.web_view_link,
              }
            : null
        }
      />
    </div>
  );
}
