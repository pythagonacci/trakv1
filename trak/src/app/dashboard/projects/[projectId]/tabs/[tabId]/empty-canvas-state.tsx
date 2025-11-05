"use client";

import { Plus, FileText } from "lucide-react";
import AddBlockButton from "./add-block-button";

interface EmptyCanvasStateProps {
  tabId: string;
  projectId: string;
}

export default function EmptyCanvasState({ tabId, projectId }: EmptyCanvasStateProps) {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          <FileText className="w-8 h-8 text-neutral-400 dark:text-neutral-500" />
        </div>
      </div>
      <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
        Click to start typing
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
        Click anywhere on this page to create a text block and start writing
      </p>
      <AddBlockButton tabId={tabId} projectId={projectId} variant="large" />
    </div>
  );
}

