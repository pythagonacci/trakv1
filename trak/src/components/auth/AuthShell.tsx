import React from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-md mx-auto p-6">
          <div className="mb-6">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Track</div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">{title}</h1>
            {subtitle && <p className="text-sm text-neutral-600 dark:text-neutral-400">{subtitle}</p>}
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800">
            <div className="p-6">{children}</div>
          </div>
        </div>
      </div>
    );
  }