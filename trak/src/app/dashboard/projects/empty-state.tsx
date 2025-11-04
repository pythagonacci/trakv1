interface EmptyStateProps {
  onCreateClick: () => void;
}

export default function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-white border border-neutral-200 rounded-lg p-12">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 mx-auto bg-neutral-100 rounded-2xl flex items-center justify-center">
          <svg
            className="w-8 h-8 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-neutral-900">No projects yet</h3>
          <p className="text-sm text-neutral-500">
            Get started by creating your first project. Projects help you organize work for your clients.
          </p>
        </div>

        <button
          onClick={onCreateClick}
          className="px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          Create Your First Project
        </button>
      </div>
    </div>
  );
}