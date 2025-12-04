import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Mail, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TabContent from "./tab-content";

export const metadata: Metadata = {
  title: "Q1 Outbound Campaign · Apex Outreach",
};

const statusBadge = (text: string, variant: "active" | "warning" | "default" = "default") => {
  const colors = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    default: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ${colors[variant]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${variant === "active" ? "bg-emerald-400 animate-pulse" : variant === "warning" ? "bg-amber-400" : "bg-slate-400"}`} />
      {text}
    </span>
  );
};

export default function ColdEmailAgencyMock() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] px-4 pb-16 pt-8 text-slate-100 md:px-6 lg:px-8">
      {/* Subtle grid background */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      {/* Gradient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-violet-600/10 via-transparent to-transparent blur-3xl pointer-events-none" />
      
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        {/* Breadcrumb */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-slate-500">
            <span className="font-semibold text-violet-400">Apex Outreach</span>
            <span className="text-slate-700">/</span>
            <span>Client Campaigns</span>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <Link href="/dashboard/projects" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors">
                  <ArrowLeft className="h-3 w-3" />
                  Back to projects
                </Link>
                <span className="text-slate-700">•</span>
                <span>TechFlow SaaS</span>
              </div>
              <h1 className="text-[32px] font-semibold tracking-tight text-white">
                Q1 Outbound Campaign
              </h1>
              <p className="text-sm text-slate-400 max-w-xl">
                Series A SaaS targeting VP Engineering & CTOs at 100-500 employee companies.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {statusBadge("Sequences live", "active")}
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Jan 6 – Mar 31, 2025
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Mail className="h-3.5 w-3.5" />
                  15,000 prospects
                </span>
              </div>
            </div>

            <div className="hidden gap-2 md:flex">
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg px-4"
              >
                View analytics
              </Button>
              <Button 
                size="sm"
                className="bg-violet-600 text-white hover:bg-violet-500 rounded-lg px-4"
              >
                Export report
              </Button>
            </div>
          </div>
        </div>

        <TabContent />

        {/* Footer */}
        <footer className="flex flex-col gap-3 border-t border-slate-800 pt-6 text-[10px] uppercase tracking-[0.3em] text-slate-600 md:flex-row md:items-center md:justify-between">
          <span>Built with Trak</span>
          <div className="inline-flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-violet-500" /> Apex Outreach
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3" /> Real-time tracking
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

