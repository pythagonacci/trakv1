"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import CreateTabDialog from "./create-tab-dialog";

interface EmptyTabsStateProps {
  projectId: string;
}

export default function EmptyTabsState({ projectId }: EmptyTabsStateProps) {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleCreateFirstTab = () => {
    setIsCreateDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    // Refresh the page to show the new tab in the tab bar
    // Note: We don't navigate to the tab route yet since that's Task 2.5 (Page/Canvas Foundation)
    router.refresh();
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 mt-6">
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-neutral-400 dark:text-neutral-600" />
        </div>

        {/* Message */}
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
          No tabs yet
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 max-w-md">
          Tabs help you organize your project into sections like Overview,
          Design, Development, or Client Notes. Get started by creating your
          first tab.
        </p>

        {/* Create First Tab Button */}
        <button
          onClick={handleCreateFirstTab}
          className="flex items-center gap-2 px-6 py-3 bg-primary dark:bg-white text-white dark:text-neutral-900 rounded-lg hover:bg-primary/90 dark:hover:bg-neutral-100 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Your First Tab
        </button>

        {/* Helper Text */}
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-4">
          You can also create sub-tabs within tabs for deeper organization
        </p>
      </div>

      {/* Create Tab Dialog */}
      <CreateTabDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        projectId={projectId}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}