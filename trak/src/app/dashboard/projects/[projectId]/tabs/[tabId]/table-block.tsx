"use client";

import { useEffect, useRef, useState } from "react";
import { type Block, updateBlock } from "@/app/actions/block";
import { TableView } from "@/components/tables/table-view";

interface TableBlockProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
  previewMode?: boolean;
}

export default function TableBlock({ block, onUpdate, previewMode = false }: TableBlockProps) {
  const content = (block.content || {}) as Record<string, any>;
  const connectedTableId = content?.tableId;
  const initialHeightPx =
    typeof content.heightPx === "number" && content.heightPx > 0 ? content.heightPx : null;
  const [maxHeightPx, setMaxHeightPx] = useState<number | null>(previewMode ? 280 : initialHeightPx);
  const heightRef = useRef<number | null>(previewMode ? 280 : initialHeightPx);
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    heightRef.current = maxHeightPx;
  }, [maxHeightPx]);

  const MIN_HEIGHT = 240;
  const MAX_HEIGHT = 1400;

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const startHeight = (heightRef.current && heightRef.current > 0 ? heightRef.current : 480) as number;
    resizeStateRef.current = {
      startY: e.clientY,
      startHeight,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeStateRef.current) return;
      const delta = ev.clientY - resizeStateRef.current.startY;
      const nextHeight = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, resizeStateRef.current.startHeight + delta),
      );
      setMaxHeightPx(nextHeight);
    };

    const handleMouseUp = async () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (!resizeStateRef.current) return;

      const finalHeight = heightRef.current ?? resizeStateRef.current.startHeight;
      const clamped = Math.round(
        Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, finalHeight)),
      );
      setMaxHeightPx(clamped);
      heightRef.current = clamped;

      if (!block.id.startsWith("temp-")) {
        const result = await updateBlock({
          blockId: block.id,
          content: {
            ...content,
            heightPx: clamped,
          },
        });
        if ("data" in result && result.data) {
          onUpdate?.(result.data);
        } else if ("error" in result && result.error) {
          console.error("Failed to update table block height:", result.error);
        }
      }

      resizeStateRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // New Supabase-backed table path: render the dedicated table view.
  // Bootstrap data is already in the React Query cache via HydrationBoundary
  // (server-side prefetch in page.tsx) — no client-side prefetch needed.
  if (connectedTableId) {
    return (
      <div className="space-y-1">
        <TableView tableId={connectedTableId} maxHeightPx={maxHeightPx ?? undefined} currentBlockId={block.id} />
        {!previewMode && (
          <div
            className="flex justify-end pt-1 cursor-row-resize select-none"
            onMouseDown={handleResizeMouseDown}
          >
            <div className="h-1 w-10 rounded-full bg-[var(--border)] hover:bg-[var(--foreground)]" />
          </div>
        )}
      </div>
    );
  }

  // No tableId yet — should not happen since add-block-button seeds an optimistic
  // tableId + bootstrap cache entry before rendering the optimistic block.
  return null;
}        
