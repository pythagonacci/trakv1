"use client";

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
              Working with multiple providers?{" "}
              <span className="font-medium text-[var(--foreground)]">
                Save all your projects to a free TWOD dashboard
              </span>
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors">
              Learn more →
            </button>
            
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

