"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import StatusBadge from "../../projects/status-badge";

interface SpaceHeaderProps {
  space: {
    id: string;
    name: string;
    status: "not_started" | "in_progress" | "complete";
  };
}

export default function SpaceHeader({ space }: SpaceHeaderProps) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <button
        onClick={() => router.push("/dashboard/internal")}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to internal
      </button>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          {/* Velvet Purple internal badge */}
          <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--velvet-purple)]/20 bg-[var(--velvet-purple)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--velvet-purple)]">
            Internal
          </span>
          <h1 className="text-2xl font-bold tracking-normal text-[var(--foreground)]">
            {space.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={space.status} />
          </div>
        </div>
      </div>
    </div>
  );
}




