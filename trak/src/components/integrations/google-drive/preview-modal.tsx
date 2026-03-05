"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ExternalAsset = {
  id: string;
  name: string;
  web_view_link?: string | null;
};

interface DrivePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  asset: ExternalAsset | null;
}

export function DrivePreviewModal({ isOpen, onClose, workspaceId, asset }: DrivePreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<string>("ok");

  useEffect(() => {
    if (!isOpen || !asset) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/integrations/google-drive/assets/${asset.id}/preview?workspace_id=${encodeURIComponent(workspaceId)}`,
          { cache: "no-store" }
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load preview");
        }
        setPreviewUrl(payload.previewUrl || null);
        setState(payload.state || "ok");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load preview");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [asset, isOpen, workspaceId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{asset?.name || "Preview"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {loading && <p className="text-sm text-[var(--muted-foreground)]">Loading preview...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {state === "not_found" || state === "trashed" ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {state === "not_found" ? "File not found in Drive." : "File was moved to trash in Drive."}
            </div>
          ) : null}

          {previewUrl && state === "ok" && (
            <div className="h-[70vh] w-full overflow-hidden rounded border border-[var(--border)]">
              <iframe src={previewUrl} className="h-full w-full" title={asset?.name || "Drive preview"} />
            </div>
          )}

          <div className="flex justify-end">
            {asset?.web_view_link && (
              <Button
                variant="outline"
                onClick={() => window.open(asset.web_view_link!, "_blank", "noopener,noreferrer")}
              >
                Open in Drive
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
