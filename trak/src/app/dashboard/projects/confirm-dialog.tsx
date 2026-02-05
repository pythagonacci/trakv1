"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmButtonVariant?: "danger" | "primary";
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  confirmButtonVariant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm();
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D3236]/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-[2px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-[2px] bg-[var(--error)]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[var(--error)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-[var(--surface-hover)] rounded-[2px] transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] rounded-[2px] transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-[2px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              confirmButtonVariant === "danger"
                ? "bg-[var(--error)] hover:bg-[#A54F4F]"
                : "bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
            }`}
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}