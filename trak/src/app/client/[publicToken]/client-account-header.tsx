"use client";

export default function ClientAccountHeader() {
  return (
    <div className="w-full border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5 py-2.5">
        <p className="text-xs text-[var(--muted-foreground)] text-center">
          Create a free account to manage your Trak project.
        </p>
      </div>
    </div>
  );
}
