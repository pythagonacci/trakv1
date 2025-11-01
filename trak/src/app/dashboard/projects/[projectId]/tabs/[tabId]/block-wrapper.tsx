"use client";

import { useState } from "react";
import { GripVertical, Trash2, MoreHorizontal, FileText, CheckSquare, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BlockWrapperProps {
  block: Block;
  children: React.ReactNode;
  onDelete?: (blockId: string) => void;
  onConvert?: (blockId: string, newType: "text" | "task" | "link" | "divider") => void;
  isDragging?: boolean;
}

export default function BlockWrapper({ block, children, onDelete, onConvert, isDragging }: BlockWrapperProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Don't show hover UI if it's a divider
  const showHoverUI = block.type !== "divider" && hovered && !isDragging;

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {block.type !== "divider" ? (
        <div
          className={cn(
            "relative",
            isDragging && "opacity-75"
          )}
        >
          <div className="flex gap-4">
            <div
              className={cn(
                "flex-1 rounded-lg border transition-all",
                hovered
                  ? "border-neutral-300 dark:border-neutral-600 shadow-sm"
                  : "border-neutral-200 dark:border-neutral-800"
              )}
            >
              {/* Hover Actions */}
              <div
                className={cn(
                  "absolute -top-3 right-2 flex items-center gap-1 opacity-0 transition-opacity",
                  showHoverUI ? "opacity-100" : "opacity-0",
                  isDragging && "pointer-events-none"
                )}
              >
                {/* Drag Handle */}
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500 bg-white/80 dark:bg-neutral-900/80 backdrop-blur rounded-full border border-neutral-200 dark:border-neutral-700 px-2 py-1 shadow-sm">
                  <GripVertical className="w-3.5 h-3.5" /> drag
                </span>

                {/* Three-dot Menu */}
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/90 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <div className="px-3 py-2 text-xs text-neutral-500 border-b border-neutral-200 dark:border-neutral-700">
                      Convert
                    </div>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "text");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Text
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "task");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <CheckSquare className="w-4 h-4" />
                      Task
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        onConvert?.(block.id, "link");
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Link2 className="w-4 h-4" />
                      Link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        onDelete?.(block.id);
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(block.id);
                  }}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/90 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Block Content */}
              {children}
            </div>
          </div>
        </div>
      ) : (
        // Divider blocks render without wrapper
        children
      )}
    </div>
  );
}

