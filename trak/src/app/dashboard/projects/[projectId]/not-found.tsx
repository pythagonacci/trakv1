"use client";

import { FileQuestion } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProjectNotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--background)] dark:bg-neutral-950 flex items-center justify-center p-6">
      <div className="text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-[var(--surface-muted)] dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-10 h-10 text-[var(--tertiary-foreground)] dark:text-[var(--muted-foreground)]" />
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          Project Not Found
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] dark:text-[var(--tertiary-foreground)] mb-6 max-w-md">
          The project you're looking for doesn't exist or you don't have access
          to it.
        </p>

        {/* Back Button */}
        <button
          onClick={() => router.push("/dashboard/projects")}
          className="px-6 py-3 bg-neutral-900 dark:bg-[var(--surface)] text-white dark:text-neutral-900 rounded-[var(--radius-lg)] hover:bg-neutral-800 dark:hover:bg-[var(--surface-muted)] transition-colors font-medium"
        >
          Back to Projects
        </button>
      </div>
    </div>
  );
}