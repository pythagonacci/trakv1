"use client";

import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onCreateClick: () => void;
}

export default function InternalEmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-[var(--border)] rounded-[4px] p-12 bg-[var(--surface)]/50">
      <div className="flex flex-col items-center max-w-md text-center space-y-4">
        {/* Velvet Purple for internal/admin spaces */}
        <div className="rounded-[2px] border border-[var(--velvet-purple)]/20 bg-[var(--velvet-purple)]/10 p-4">
          <BookOpen className="h-8 w-8 text-[var(--velvet-purple)]" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">No internal spaces yet</h3>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            Create your first space to organize company knowledge, SOPs, guidelines, templates, and documentation.
          </p>
        </div>
        <Button onClick={onCreateClick} className="mt-2">
          Create your first space
        </Button>
      </div>
    </div>
  );
}




