"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  groupId: string;
  groupLabel: string;
  groupColor?: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  onDropRow?: (rowId: string) => void;
}

export function GroupHeader({
  groupId,
  groupLabel,
  groupColor,
  count,
  isCollapsed,
  onToggle,
  onDropRow,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!onDropRow) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    if (!onDropRow) return;
    e.preventDefault();
    setIsDragOver(false);
    const rowId = e.dataTransfer.getData("rowId");
    if (rowId) onDropRow(rowId);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-muted)] sticky top-0 z-10",
        isDragOver && "border-[var(--primary)]/60 bg-[var(--primary)]/5"
      )}
      onClick={onToggle}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center justify-center w-5 h-5">
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
        )}
      </div>
      {groupColor && (
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: groupColor }}
        />
      )}
      <span className="font-medium text-[var(--foreground)]">{groupLabel}</span>
      <span className="text-xs text-[var(--muted-foreground)]">({count})</span>
    </div>
  );
}
