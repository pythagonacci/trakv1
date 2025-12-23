"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAddRowAbove?: () => void;
  onAddRowBelow?: () => void;
  onAddColumnLeft?: () => void;
  onAddColumnRight?: () => void;
  type: "cell" | "column";
}

export function TableContextMenu({
  x,
  y,
  onClose,
  onAddRowAbove,
  onAddRowBelow,
  onAddColumnLeft,
  onAddColumnRight,
  type,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      if (x + rect.width > viewportWidth) {
        newX = viewportWidth - rect.width - 10;
      }
      if (y + rect.height > viewportHeight) {
        newY = viewportHeight - rect.height - 10;
      }
      if (newX < 10) newX = 10;
      if (newY < 10) newY = 10;

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[300] rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-popover py-1 min-w-[180px]"
      style={{ left: `${adjustedPosition.x}px`, top: `${adjustedPosition.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {type === "cell" && (
        <>
          {onAddRowAbove && (
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors duration-150"
              onClick={() => {
                onAddRowAbove();
                onClose();
              }}
            >
              <ArrowUp className="h-3 w-3" />
              Add row above
            </button>
          )}
          {onAddRowBelow && (
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors duration-150"
              onClick={() => {
                onAddRowBelow();
                onClose();
              }}
            >
              <ArrowDown className="h-3 w-3" />
              Add row below
            </button>
          )}
        </>
      )}
      {type === "column" && (
        <>
          {onAddColumnLeft && (
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors duration-150"
              onClick={() => {
                onAddColumnLeft();
                onClose();
              }}
            >
              <ArrowLeft className="h-3 w-3" />
              Add column left
            </button>
          )}
          {onAddColumnRight && (
            <button
              className="w-full px-3 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center gap-2 transition-colors duration-150"
              onClick={() => {
                onAddColumnRight();
                onClose();
              }}
            >
              <ArrowRight className="h-3 w-3" />
              Add column right
            </button>
          )}
        </>
      )}
    </div>
  );
}

