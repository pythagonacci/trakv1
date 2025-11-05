"use client";

import { Plus, FileText } from "lucide-react";
import AddBlockButton from "./add-block-button";

interface EmptyCanvasStateProps {
  tabId: string;
  projectId: string;
}

export default function EmptyCanvasState({ tabId, projectId }: EmptyCanvasStateProps) {
  return (
    <div className="text-center py-20">
      <div className="flex justify-center mb-6">
        <div className="w-12 h-12 rounded-full bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
          <FileText className="w-6 h-6 text-neutral-300 dark:text-neutral-700" />
        </div>
      </div>
      <h3 className="text-base font-medium text-neutral-400 dark:text-neutral-600 mb-2">
        Click to start typing
      </h3>
      <p className="text-sm text-neutral-400 dark:text-neutral-600 mb-8 max-w-sm mx-auto">
        Click anywhere on this page to create a text block and start writing
      </p>
      <AddBlockButton tabId={tabId} projectId={projectId} variant="large" />
    </div>
  );
}

