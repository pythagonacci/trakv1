"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";

export default function ClientPageBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              Want to keep this shared project?{" "}
              <span className="font-medium text-[var(--foreground)]">
                Create a free account with the email it was shared to and it will appear in Shared with me
              </span>
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Link
              href="/signup"
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              Sign in
            </Link>
            
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 rounded hover:bg-[var(--surface-hover)] transition-colors text-[var(--muted-foreground)]"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
