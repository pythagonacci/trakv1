"use client";

import { useState } from "react";
import { FileText, ExternalLink, Trash2, Edit } from "lucide-react";
import { updateBlock, deleteBlock, type Block } from "@/app/actions/block";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface DocReferenceBlockProps {
  block: Block;
  onDelete?: () => void;
  onOpenDoc?: (docId: string) => void;
  isEditing?: boolean;
}

export default function DocReferenceBlock({ block, onDelete, onOpenDoc, isEditing }: DocReferenceBlockProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { doc_id, doc_title } = block.content as { doc_id: string; doc_title: string };

  const handleOpenDoc = () => {
    if (isEditing) return;
    if (onOpenDoc) {
      onOpenDoc(doc_id);
    } else {
      router.push(`/dashboard/docs/${doc_id}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remove this doc reference?")) return;

    setIsDeleting(true);
    const result = await deleteBlock(block.id);
    if (!result.error && onDelete) {
      onDelete();
    }
    setIsDeleting(false);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleOpenDoc}
      className={cn(
        "group relative border border-[var(--border)] rounded-lg p-4 transition-all",
        isEditing ? "cursor-default" : "cursor-pointer hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
        isDeleting && "opacity-50 pointer-events-none"
      )}
    >
      {/* Delete button (only in edit mode) */}
      {isEditing && isHovered && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors z-10"
          title="Remove reference"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Content */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <FileText className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-[var(--foreground)] truncate">
              {doc_title}
            </h4>
            {!isEditing && (
              <ExternalLink className="h-3.5 w-3.5 text-[var(--muted-foreground)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            {isEditing ? "Document reference" : "Click to view in sidebar"}
          </p>
        </div>
      </div>
    </div>
  );
}

