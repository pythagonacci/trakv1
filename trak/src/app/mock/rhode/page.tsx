import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Sparkles, Instagram, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import TabContent from "./tab-content";

export const metadata: Metadata = {
  title: "Peptide Lip Shape · Rhode Mock Project",
};

const statusBadge = (text: string) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF6F0] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-[#9C7B6E]">
    <span className="h-1.5 w-1.5 rounded-full bg-[#C9A38B]" />
    {text}
  </span>
);

export default function RhodePeptideLipShapeMock() {
  return (
    <div className="min-h-screen bg-[#FDFCFA] px-4 pb-16 pt-8 text-[#3D3937] md:px-6 lg:px-8">
      {/* Rhode brand gradient overlay */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-br from-[#FEF7F4] via-transparent to-[#F8F4F0] opacity-60" />
      
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        {/* Breadcrumb */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-[#A69690]">
            <span className="font-medium">Rhode</span>
            <span className="text-[#D4C8C3]">/</span>
            <span>Product Launch</span>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs text-[#8A7E79]">
                <Link href="/dashboard/projects" className="inline-flex items-center gap-1 text-[#8A7E79] hover:text-[#5D534F] transition-colors">
                  <ArrowLeft className="h-3 w-3" />
                  Back to projects
                </Link>
                <span className="text-[#D4C8C3]">•</span>
                <span>Lip Category</span>
              </div>
              <h1 className="text-[32px] font-light tracking-tight text-[#3D3937]">
                Peptide Lip Shape
              </h1>
              <p className="text-sm text-[#8A7E79] max-w-xl">
                The next evolution of lip care. Plumping peptides meet the Rhode glaze.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {statusBadge("In development")}
                <span className="inline-flex items-center gap-1.5 text-xs text-[#8A7E79]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Launch: Q1 2025
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-[#8A7E79]">
                  <Sparkles className="h-3.5 w-3.5" />
                  6 shade range
                </span>
              </div>
            </div>

            <div className="hidden gap-2 md:flex">
              <Button 
                variant="outline" 
                size="sm"
                className="border-[#E8DED8] text-[#6B5F5A] hover:bg-[#FDF6F0] hover:border-[#D4C8C3] rounded-full px-5"
              >
                Preview launch assets
              </Button>
              <Button 
                size="sm"
                className="bg-[#3D3937] text-white hover:bg-[#2A2725] rounded-full px-5"
              >
                Share with team
              </Button>
            </div>
          </div>
        </div>

        <TabContent />

        {/* Footer */}
        <footer className="flex flex-col gap-3 border-t border-[#EBE5E0] pt-6 text-[10px] uppercase tracking-[0.3em] text-[#B5AAA4] md:flex-row md:items-center md:justify-between">
          <span>Built with Trak</span>
          <div className="inline-flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Instagram className="h-3 w-3" /> @rhode
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-3 w-3" /> rhodeskin.com
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

