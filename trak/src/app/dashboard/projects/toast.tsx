"use client";

import React, { useEffect } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
  duration?: number;
  className?: string;
  /** Optional text link shown below the message (e.g. “View upload”). */
  action?: { label: string; href: string };
}

export default function Toast({
  message,
  type,
  onClose,
  duration = 3000,
  className,
  action,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={cn(
        "fixed right-4 top-4 z-[100] animate-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <div
        className={`flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-popover backdrop-blur-sm ${
          type === "success"
            ? "border-green-600/20 bg-green-500/10 text-green-600"
            : "border-red-600/20 bg-red-500/10 text-red-600"
        }`}
      >
        {type === "success" ? (
          <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium leading-snug break-words">{message}</p>
          {action ? (
            <a
              href={action.href}
              className="inline-block text-sm font-semibold underline decoration-2 underline-offset-2 opacity-90 transition-opacity hover:opacity-100"
              onClick={(e) => {
                if (action.href === "#") e.preventDefault();
              }}
            >
              {action.label}
            </a>
          ) : null}
        </div>
        <button
          onClick={onClose}
          className="-mr-1 -mt-0.5 shrink-0 rounded-[var(--radius-md)] p-1 text-[var(--tertiary-foreground)] transition-colors hover:bg-surface-hover hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
