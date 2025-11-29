import React from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--tertiary-foreground)]">Trak</div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--muted-foreground)]">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-sm">
          <div className="px-8 py-10 space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
}