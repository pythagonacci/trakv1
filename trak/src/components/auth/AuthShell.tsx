import React from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="mb-8 text-center">
            <div className="text-sm font-semibold text-neutral-600 mb-3">Track</div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">{title}</h1>
            {subtitle && <p className="text-base text-neutral-600">{subtitle}</p>}
          </div>
          <div className="bg-white rounded-lg shadow-lg border border-neutral-200">
            <div className="p-8">{children}</div>
          </div>
        </div>
      </div>
    );
  }