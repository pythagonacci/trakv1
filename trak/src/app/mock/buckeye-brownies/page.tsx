import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Play, Instagram, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import TabContent from "./tab-content";

export const metadata: Metadata = {
  title: "Buckeye Brownies Launch · Mock Project",
};

const statusBadge = (text: string) => (
  <span className="inline-flex items-center gap-1 rounded-[999px] bg-[var(--surface-hover)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
    <span className="h-1.5 w-1.5 rounded-full bg-[var(--foreground)]" />
    {text}
  </span>
);

export default function BuckeyeBrowniesLaunchMock() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 pb-16 pt-8 text-[var(--foreground)] md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-[var(--tertiary-foreground)]">
            <span>Mock Workspace</span>
            <span className="text-[var(--border-strong)]">/</span>
            <span>Launch Playbook</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Link href="/dashboard/projects" className="inline-flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <ArrowLeft className="h-3 w-3" />
                  Back to projects
                </Link>
                <span className="text-[var(--border-strong)]">•</span>
                <span>Buckeye Brownies</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">December Brownie Launch</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                {statusBadge("In production")}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Launch window: Dec 12–15
                </span>
                <span className="inline-flex items-center gap-1">
                  <Play className="h-3.5 w-3.5" />
                  Goal: 5,000 units sold
                </span>
              </div>
            </div>

            <div className="hidden gap-2 md:flex">
              <Button variant="outline" size="sm">Preview customer journey</Button>
              <Button size="sm">Share launch hub</Button>
            </div>
          </div>
        </div>

        <TabContent />

        <footer className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)] md:flex-row md:items-center md:justify-between">
          <span>Built with Trak building blocks</span>
          <div className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Instagram className="h-3 w-3" /> Buckeye Brownies
            </span>
            <span className="inline-flex items-center gap-1">
              <Package className="h-3 w-3" /> Holiday Batch 2025
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
