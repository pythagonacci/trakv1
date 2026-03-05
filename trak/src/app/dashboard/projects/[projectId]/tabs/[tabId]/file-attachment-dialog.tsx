"use client";

import { useState } from "react";
import FileUploadZone from "./file-upload-zone";
import { DrivePickerModal } from "@/components/integrations/google-drive/drive-picker-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FileAttachmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
  blockId: string;
  onUploadComplete?: () => void;
}

export default function FileAttachmentDialog({
  isOpen,
  onClose,
  workspaceId,
  projectId,
  blockId,
  onUploadComplete,
}: FileAttachmentDialogProps) {
  const [mode, setMode] = useState<"upload" | "drive">("upload");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = () => {
    onUploadComplete?.();
    // Close dialog after a short delay to show success
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const handleDriveSelect = async (items: Array<{ providerItemId: string }>) => {
    if (!items.length) return;
    setLinking(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/google-drive/assets/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          entityType: "block",
          entityId: blockId,
          itemIds: items.map((item) => item.providerItemId),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to link Google Drive items");
      }

      onUploadComplete?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to link Google Drive items");
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Attach Files</DialogTitle>
          <DialogDescription>
            Upload files to attach to this block. You can drag and drop files or click to browse.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex items-center gap-2">
          <button
            className={`rounded px-2 py-1 text-xs ${mode === "upload" ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface-hover)]"}`}
            onClick={() => setMode("upload")}
            type="button"
          >
            Upload
          </button>
          <button
            className={`rounded px-2 py-1 text-xs ${mode === "drive" ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface-hover)]"}`}
            onClick={() => setMode("drive")}
            type="button"
          >
            Link from Google Drive
          </button>
        </div>
        <div className="mt-4">
          {mode === "upload" ? (
            <FileUploadZone
              workspaceId={workspaceId}
              projectId={projectId}
              blockId={blockId}
              onUploadComplete={handleUploadComplete}
              compact={true}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted-foreground)]">
                Link Drive files as external assets. Trak will keep links and previews while Drive remains the source of truth.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={linking}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)] disabled:opacity-60"
              >
                {linking ? "Linking..." : "Open Google Drive Picker"}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
      <DrivePickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        workspaceId={workspaceId}
        title="Link from Google Drive"
        onSelect={handleDriveSelect}
      />
    </Dialog>
  );
}
