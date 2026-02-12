"use client";

import { useEffect, useState } from "react";
import { File, Download, X, Upload } from "lucide-react";
import { type TableField } from "@/types/table";
import { formatFileSize } from "@/lib/field-utils";

interface FileInfo {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  url?: string;
}

interface Props {
  field: TableField;
  value: unknown;
  editing: boolean;
  saving?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
  files?: FileInfo[];
  onUpload?: (files: File[]) => Promise<string[]>;
}

export function FilesCell({
  value,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
  saving,
  files = [],
  onUpload,
}: Props) {
  const [fileIds, setFileIds] = useState<string[]>(
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
  );
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setFileIds(Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
  }, [value]);

  const selectedFiles = files.filter((f) => fileIds.includes(f.id));

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !onUpload) return;

    const filesToUpload = Array.from(e.target.files);
    setUploading(true);

    try {
      const uploadedIds = await onUpload(filesToUpload);
      const newFileIds = [...fileIds, ...uploadedIds];
      setFileIds(newFileIds);
      onCommit(newFileIds);
    } catch (error) {
      console.error("File upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFileIds = fileIds.filter((id) => id !== fileId);
    setFileIds(newFileIds);
    onCommit(newFileIds);
  };

  if (editing) {
    return (
      <div className="w-full space-y-2">
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedFiles.map((file) => (
              <div
                key={file.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[4px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--foreground)]"
              >
                <File className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{file.file_name}</span>
                <button
                  onClick={(e) => removeFile(file.id, e)}
                  className="hover:text-[var(--error)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] cursor-pointer transition-colors">
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading..." : "Add files"}
          <input
            type="file"
            multiple
            onChange={handleFileInput}
            disabled={uploading || !onUpload}
            className="hidden"
          />
        </label>
      </div>
    );
  }

  if (selectedFiles.length === 0) {
    return (
      <button
        className="w-full text-left text-xs text-[var(--muted-foreground)] truncate min-h-[18px] hover:text-[var(--primary)] transition-colors duration-150"
        onClick={onStartEdit}
        disabled={saving}
      >
        Empty
      </button>
    );
  }

  const displayLimit = 2;
  const visibleFiles = selectedFiles.slice(0, displayLimit);
  const remainingCount = selectedFiles.length - displayLimit;

  return (
    <button
      className="w-full text-left min-h-[18px] hover:opacity-80 transition-opacity group"
      onClick={onStartEdit}
      disabled={saving}
    >
      <div className="flex flex-wrap gap-1">
        {visibleFiles.map((file) => (
          <div
            key={file.id}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[4px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--foreground)]"
          >
            <File className="h-3 w-3" />
            <a
              href={file.url}
              download={file.file_name}
              className="truncate max-w-[100px] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {file.file_name}
            </a>
            <span className="text-[var(--muted-foreground)]">
              ({formatFileSize(file.file_size)})
            </span>
            {file.url && (
              <a
                href={file.url}
                download={file.file_name}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-[var(--primary)]"
                title="Download"
              >
                <Download className="h-3 w-3" />
              </a>
            )}
            <button
              onClick={(e) => removeFile(file.id, e)}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--error)]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {remainingCount > 0 && (
          <span className="inline-flex items-center px-2 py-1 rounded-[4px] text-xs bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--muted-foreground)]">
            +{remainingCount} more
          </span>
        )}
      </div>
    </button>
  );
}
