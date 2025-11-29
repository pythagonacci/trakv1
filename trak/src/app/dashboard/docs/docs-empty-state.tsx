"use client";

import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface DocsEmptyStateProps {
  onCreateClick: () => void;
}

export default function DocsEmptyState({ onCreateClick }: DocsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[2px] border border-[var(--tram-yellow)]/20 bg-[var(--tram-yellow)]/10 mb-4">
        <FileText className="h-8 w-8 text-[var(--tram-yellow)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No Documents Yet</h3>
      <p className="text-sm text-[var(--muted-foreground)] mb-6 max-w-md">
        Create your first document to start writing. Documents can be added to projects and tabs for easy reference.
      </p>
      <button 
        onClick={onCreateClick}
        className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-[2px] transition-colors"
      >
        Create New Document
      </button>
    </div>
  );
}




