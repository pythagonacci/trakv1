"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle } from "lucide-react";
import { deleteTab } from "@/app/actions/tab";

interface DeleteTabDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tab: { id: string; name: string } | null;
  onSuccess?: () => void;
  triggerRef?: React.RefObject<HTMLElement> | null;
}

export default function DeleteTabDialog({
  isOpen,
  onClose,
  tab,
  onSuccess,
  triggerRef,
}: DeleteTabDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes or tab changes
  useEffect(() => {
    if (isOpen) {
      // Reset state when opening for a new tab
      setIsDeleting(false);
      setError("");
    } else {
      // Reset state when closing
      setIsDeleting(false);
      setError("");
    }
  }, [isOpen, tab?.id]); // Reset when isOpen changes or when tab ID changes

  // Calculate position based on trigger element
  useEffect(() => {
    if (isOpen && triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 320; // w-80 = 320px
      // Position below the trigger, aligned to the right edge
      let left = rect.right - popoverWidth;
      // Ensure it doesn't go off the left edge
      if (left < 8) {
        left = 8;
      }
      // Ensure it doesn't go off the right edge
      if (rect.right > window.innerWidth - 8) {
        left = window.innerWidth - popoverWidth - 8;
      }
      setPosition({
        top: rect.bottom + 6,
        left: left,
      });
    }
  }, [isOpen, triggerRef]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if currently deleting
      if (isDeleting) return;
      
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef?.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isDeleting, onClose, triggerRef]);

  const handleDelete = async () => {
    if (!tab) return;

    setIsDeleting(true);
    setError("");

    try {
      const result = await deleteTab(tab.id);

      if (result.error) {
        setError(result.error);
        setIsDeleting(false);
        return;
      }

      // Success: reset state, close dialog and call success callback
      setIsDeleting(false);
      setError("");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete tab");
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setIsDeleting(false);
      setError("");
      onClose();
    }
  };

  if (!isOpen || !tab) return null;

  const popoverContent = (
    <div
      ref={popoverRef}
      className="fixed z-[9999] w-80 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      style={{
        top: `${position.top}px`,
        left: `${Math.max(8, Math.min(position.left, window.innerWidth - 328))}px`, // Keep within viewport
      }}
    >
      {/* Compact Header */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-[2px] bg-[var(--error)]/10 text-[var(--error)]">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Delete Tab
        </h3>
        <button
          onClick={handleClose}
          className="ml-auto rounded-[2px] p-1 text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          disabled={isDeleting}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Compact Body */}
      <div className="px-4 py-3">
        {error && (
          <div className="mb-3 rounded-[2px] border border-[var(--error)]/30 bg-[var(--error)]/10 px-3 py-2">
            <p className="text-xs text-[var(--error)]">{error}</p>
          </div>
        )}

        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
          Delete <span className="font-semibold text-[var(--foreground)]">&quot;{tab.name}&quot;</span>? This will permanently delete the tab and all its sub-tabs and content. This action cannot be undone.
        </p>
      </div>

      {/* Compact Actions */}
      <div className="flex gap-2 border-t border-[var(--border)] px-4 py-3">
        <button
          type="button"
          onClick={handleClose}
          className="flex-1 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]"
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="flex-1 rounded-[2px] bg-[var(--error)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#A54F4F] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );

  // Use portal to render popover at document body level to avoid stacking context issues
  if (typeof window !== "undefined") {
    return createPortal(popoverContent, document.body);
  }
  
  return popoverContent;
}

