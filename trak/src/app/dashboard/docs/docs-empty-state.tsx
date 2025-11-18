"use client";

import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface DocsEmptyStateProps {
  onCreateClick: () => void;
}

export default function DocsEmptyState({ onCreateClick }: DocsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No Documents Yet</h3>
      <p className="text-sm text-[var(--muted-foreground)] mb-6 max-w-md">
        Create your first document to start writing. Documents can be added to projects and tabs for easy reference.
      </p>
      <Button onClick={onCreateClick}>Create New Document</Button>
    </div>
  );
}




