"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ExternalAsset = {
  id: string;
  item_kind: "file" | "folder";
  name: string;
  mime_type?: string | null;
  web_view_link?: string | null;
  icon_link?: string | null;
  thumbnail_link?: string | null;
  modified_time?: string | null;
  owner_display?: string | null;
  stale_state?: "active" | "not_found" | "trashed";
};

interface ExternalAssetCardProps {
  asset: ExternalAsset;
  onPreview?: (asset: ExternalAsset) => void;
  onRemove?: (asset: ExternalAsset) => Promise<void> | void;
}

export function ExternalAssetCard({ asset, onPreview, onRemove }: ExternalAssetCardProps) {
  const [removing, setRemoving] = useState(false);

  const handleCopy = async () => {
    if (!asset.web_view_link) return;
    await navigator.clipboard.writeText(asset.web_view_link);
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove(asset);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="rounded-md border border-[var(--border)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{asset.name}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {asset.item_kind === "folder" ? "Folder" : asset.mime_type || "File"}
            {asset.owner_display ? ` • ${asset.owner_display}` : ""}
          </p>
          {asset.modified_time ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              Modified {new Date(asset.modified_time).toLocaleString()}
            </p>
          ) : null}
          {asset.stale_state && asset.stale_state !== "active" ? (
            <p className="text-xs text-red-600">
              {asset.stale_state === "not_found" ? "File not found" : "File is trashed"}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onPreview && (
            <Button variant="outline" size="sm" onClick={() => onPreview(asset)}>
              Preview
            </Button>
          )}
          {asset.web_view_link && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(asset.web_view_link!, "_blank", "noopener,noreferrer")}
            >
              Open in Drive
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleCopy}>
            Copy link
          </Button>
          {onRemove && (
            <Button variant="outline" size="sm" disabled={removing} onClick={handleRemove}>
              {removing ? "Removing..." : "Remove"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
