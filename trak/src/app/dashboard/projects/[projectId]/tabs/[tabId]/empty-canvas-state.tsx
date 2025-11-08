"use client";

import { Plus, FileText } from "lucide-react";
import AddBlockButton from "./add-block-button";

interface EmptyCanvasStateProps {
  tabId: string;
  projectId: string;
}

export default function EmptyCanvasState({ tabId, projectId }: EmptyCanvasStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center shadow-card">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--foreground)]">
        <FileText className="h-5 w-5" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-[var(--foreground)]">Create your first block</h3>
      <p className="mb-5 max-w-sm text-sm text-[var(--muted-foreground)]">
        Click anywhere inside the canvas or use the button below to add content instantly.
      </p>
      <AddBlockButton tabId={tabId} projectId={projectId} variant="large" />
      <div className="mt-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--tertiary-foreground)]">
        <Plus className="h-3 w-3" /> Tip: Press <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 font-medium text-[var(--foreground)]">/</span> to open the block menu
      </div>
    </div>
  );
}

