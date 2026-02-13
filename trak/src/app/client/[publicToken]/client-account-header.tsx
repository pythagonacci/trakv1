"use client";

import Link from "next/link";

export default function ClientAccountHeader() {
  return (
    <div className="w-full border-b border-[#3080a6]/30 bg-[#3080a6]/65 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5 py-2.5">
        <div className="flex items-center justify-center gap-3">
          <p className="text-xs text-white/90">
            Create a free account to manage your TWOD project.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md bg-white px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-white/90"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
