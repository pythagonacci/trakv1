"use client";

import AddBlockButton from "./add-block-button";

interface EmptyCanvasStateProps {
  tabId: string;
  projectId: string;
}

export default function EmptyCanvasState({ tabId, projectId }: EmptyCanvasStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <AddBlockButton tabId={tabId} projectId={projectId} variant="default" />
      <p className="text-xs text-[var(--muted-foreground)]">
        Click to start typing
      </p>
    </div>
  );
}

