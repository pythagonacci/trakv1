interface EmptyStateProps {
  onCreateClick: () => void;
}

export default function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[4px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-8 py-14 text-center">
      {/* Dome Teal for projects/folders */}
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[2px] border border-[var(--dome-teal)]/20 bg-[var(--dome-teal)]/10 text-[var(--dome-teal)]">
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>

      <h3 className="mb-1.5 text-[15px] font-semibold text-[var(--foreground)]">No projects yet</h3>
      <p className="mb-4 max-w-sm text-[12px] text-[var(--muted-foreground)]">
        Create your first project to set plans, timelines, and deliverables for your clients.
      </p>

      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 rounded-[2px] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)]"
      >
        Create your first project
      </button>
    </div>
  );
}