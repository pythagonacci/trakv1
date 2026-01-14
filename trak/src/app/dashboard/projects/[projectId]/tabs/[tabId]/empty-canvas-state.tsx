import type { ReactNode } from "react";

interface EmptyCanvasStateProps {
  actions?: ReactNode;
}

export default function EmptyCanvasState({ actions }: EmptyCanvasStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      {actions}
      <p className="text-xs text-[var(--muted-foreground)]">
        Click to start typing
      </p>
    </div>
  );
}
