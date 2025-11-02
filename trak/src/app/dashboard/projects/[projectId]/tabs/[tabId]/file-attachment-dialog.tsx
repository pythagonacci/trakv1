"use client";

import { useState } from "react";
import FileUploadZone from "./file-upload-zone";
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
  const [uploadComplete, setUploadComplete] = useState(false);

  const handleUploadComplete = () => {
    setUploadComplete(true);
    onUploadComplete?.();
    // Close dialog after a short delay to show success
    setTimeout(() => {
      onClose();
      setUploadComplete(false);
    }, 1000);
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
        <div className="mt-4">
          <FileUploadZone
            workspaceId={workspaceId}
            projectId={projectId}
            blockId={blockId}
            onUploadComplete={handleUploadComplete}
            compact={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

