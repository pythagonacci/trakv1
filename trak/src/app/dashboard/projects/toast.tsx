"use client";

import React, { useEffect } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 duration-300">
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-popover backdrop-blur-sm ${
          type === "success"
            ? "border-green-600/20 bg-green-500/10 text-green-600"
            : "border-red-600/20 bg-red-500/10 text-red-600"
        }`}
      >
        {type === "success" ? (
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 flex-shrink-0" />
        )}
        <p className="text-sm font-medium leading-tight">{message}</p>
        <button
          onClick={onClose}
          className="ml-2 rounded-md p-1 text-[var(--tertiary-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}