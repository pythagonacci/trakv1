"use client";

import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface DocsEmptyStateProps {
  onCreateClick: () => void;
}

export default function DocsEmptyState({ onCreateClick }: DocsEmptyStateProps) {
  const templates = [
    {
      title: "Launch brief",
      description: "Goals, timeline, responsibilities.",
    },
    {
      title: "Weekly update",
      description: "Progress, blockers, next steps.",
    },
    {
      title: "Decision log",
      description: "What changed and why.",
    },
    {
      title: "Meeting notes",
      description: "Notes that stay linked to work.",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-8 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[2px] border border-[var(--tram-yellow)]/20 bg-[var(--tram-yellow)]/10">
              <FileText className="h-6 w-6 text-[var(--tram-yellow)]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">No documents yet</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Create your first document to keep decisions, launch plans, and notes next to the work.
              </p>
            </div>
          </div>

          <button
            onClick={onCreateClick}
            className="inline-flex items-center justify-center rounded-[2px] border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-1.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary)]/15 hover:border-[var(--primary)] transition-colors"
          >
            Create document
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tertiary-foreground)]">
            Suggested starting points
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => (
              <button
                key={template.title}
                onClick={onCreateClick}
                className="flex flex-col items-start rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-colors"
              >
                <span className="font-medium text-[var(--foreground)]">{template.title}</span>
                <span className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {template.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}




