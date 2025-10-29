"use client";

import { FolderOpen, Plus } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="mb-4 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-neutral-100 flex items-center justify-center">
            <FolderOpen className="w-10 h-10 text-neutral-400" />
          </div>
        </div>
        
        <h3 className="text-lg font-medium text-neutral-900 mb-2">
          No projects yet
        </h3>
        <p className="text-sm text-neutral-500 mb-6">
          Get started by creating your first project to organize your work and collaborate with your team.
        </p>
        
        <button className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl flex items-center gap-2 mx-auto transition-colors">
          <Plus className="w-4 h-4" />
          Create your first project
        </button>
      </div>
    </div>
  );
}