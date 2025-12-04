import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Flame, Activity, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import TabContent from "./tab-content";

export const metadata: Metadata = {
  title: "Summer Shred · Fitness Coach Mock Project",
};

const statusBadge = (text: string) => (
  <span className="inline-flex items-center gap-1 rounded-[999px] bg-[var(--surface-hover)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--tertiary-foreground)]">
    <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
    {text}
  </span>
);

export default function FitnessCoachMock() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 pb-16 pt-8 text-[var(--foreground)] md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-[var(--tertiary-foreground)]">
            <span>Mock Workspace</span>
            <span className="text-[var(--border-strong)]">/</span>
            <span>Client Program</span>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Link
                  href="/dashboard/projects"
                  className="inline-flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to clients
                </Link>
                <span className="text-[var(--border-strong)]">•</span>
                <span>Marcus Carter</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Summer Shred Program</h1>
              <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">
                12-week hybrid strength + conditioning plan for a product leader balancing travel, late-night launches, and
                recovery work. Everything syncs from Trainerize, Cronometer, and Whoop into one launch board.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                {statusBadge("Week 4 of 12")}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Apr 7 – Jun 29
                </span>
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5" /> Target: -12 lb / -4% BF
                </span>
                <span className="inline-flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" /> HRV trend +6 ms
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Share client hub
              </Button>
              <Button size="sm">Log check-in</Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted-foreground)] md:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--tertiary-foreground)]">Weight change</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">-5.8 lb</p>
            <p>Loss pace: 0.9 lb/week</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--tertiary-foreground)]">Training compliance</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">92%</p>
            <p>23 / 25 sessions completed</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--tertiary-foreground)]">Macro accuracy</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">87%</p>
            <p>Average 2 deviations/week</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-[var(--tertiary-foreground)]">Recovery score</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">78</p>
            <p>Sleep is trending up, ready to push</p>
          </div>
        </div>

        <TabContent />

        <footer className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-[11px] uppercase tracking-[0.35em] text-[var(--tertiary-foreground)] md:flex-row md:items-center md:justify-between">
          <span>Built with Trak coaching blocks</span>
          <div className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> Coach Lila · Client Marcus
            </span>
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3" /> Trainerize · Cronometer · Whoop synced
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
