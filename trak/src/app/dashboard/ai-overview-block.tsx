"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Target,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  ChevronDown,
} from "lucide-react";
import { refreshDashboardInsights } from "@/app/actions/dashboard-insights";
import type { DashboardInsight } from "@/app/actions/dashboard-insights";

// ============================================================================
// TYPES
// ============================================================================

interface AIOverviewBlockProps {
  insights: DashboardInsight | null;
  workspaceId: string;
  userId: string;
  userName?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isStale(isoDate: string): boolean {
  const date = new Date(isoDate);
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return hours > 6;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AIOverviewBlock({
  insights: initialInsights,
  workspaceId,
  userId,
  userName,
}: AIOverviewBlockProps) {
  const [insights, setInsights] = useState(initialInsights);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(true);
  const refreshInFlight = useRef(false);
  const autoRefreshMs = 3 * 60 * 60 * 1000;

  // Handle regenerate button click
  const handleRegenerate = useCallback(() => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await refreshDashboardInsights(
          workspaceId,
          userId,
          userName
        );

        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          setInsights(result.data);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        refreshInFlight.current = false;
      }
    });
  }, [startTransition, userId, userName, workspaceId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      handleRegenerate();
    }, autoRefreshMs);

    return () => window.clearInterval(interval);
  }, [autoRefreshMs, handleRegenerate]);

  // Loading state during regeneration
  if (isPending) {
    return (
      <Card className="border border-[var(--border)] bg-[var(--surface)] animate-pulse">
        <CardHeader className="cursor-pointer" onClick={() => setIsExpanded((e) => !e)}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Sparkles className="h-5 w-5" />
              AI Overview
            </CardTitle>
            <ChevronDown className={`h-5 w-5 text-[var(--muted-foreground)] transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent>
            <div className="space-y-4">
              <div className="h-16 bg-[var(--muted)]/10 rounded" />
              <div className="h-24 bg-[var(--muted)]/10 rounded" />
              <div className="h-24 bg-[var(--muted)]/10 rounded" />
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  // Error state
  if (error || !insights) {
    return (
      <Card className="border border-[var(--border)] bg-[var(--surface)]">
        <CardHeader className="cursor-pointer" onClick={() => setIsExpanded((e) => !e)}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Sparkles className="h-5 w-5" />
              AI Overview
            </CardTitle>
            <ChevronDown className={`h-5 w-5 text-[var(--muted-foreground)] transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-[var(--muted-foreground)] mb-4" />
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                {error || "Unable to generate insights. Try again."}
              </p>
              <Button
                variant="outline"
                onClick={(ev) => {
                  ev.stopPropagation();
                  handleRegenerate();
                }}
                disabled={isPending}
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  const stale = isStale(insights.generatedAt);

  return (
    <Card className="border border-[var(--border)] bg-[var(--surface)]">
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Sparkles className="h-5 w-5 text-[var(--tile-orange)]" />
            AI Overview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRegenerate();
              }}
              disabled={isPending}
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Regenerate
            </Button>
            <ChevronDown className={`h-5 w-5 text-[var(--muted-foreground)] transition-transform shrink-0 ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
      <CardContent className="space-y-6">
        {/* Summary Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1 w-1 rounded-full bg-[var(--river-indigo)]" />
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Summary
            </h3>
          </div>
          <p className="text-sm text-[var(--foreground)] leading-relaxed pl-3">
            {insights.summary}
          </p>
        </div>

        {/* Top Priorities Section */}
        {insights.priorities.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-[var(--tile-orange)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Top Priorities
              </h3>
            </div>
            <ul className="space-y-2 pl-3">
              {insights.priorities.map((priority, index) => (
                <li
                  key={index}
                  className="text-sm text-[var(--foreground)] flex items-start gap-2"
                >
                  <span className="text-[var(--tile-orange)] mt-0.5">•</span>
                  <span className="flex-1">{priority}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items Section */}
        {insights.actionItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-[var(--dome-teal)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Action Items
              </h3>
            </div>
            <ul className="space-y-2 pl-3">
              {insights.actionItems.map((item, index) => (
                <li
                  key={index}
                  className="text-sm text-[var(--foreground)] flex items-start gap-2"
                >
                  <span className="text-[var(--dome-teal)] mt-0.5">✓</span>
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Blockers Section */}
        {insights.blockers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-[var(--tram-yellow)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Blockers & Risks
              </h3>
            </div>
            <ul className="space-y-2 pl-3">
              {insights.blockers.map((blocker, index) => (
                <li
                  key={index}
                  className="text-sm text-[var(--foreground)] flex items-start gap-2"
                >
                  <span className="text-[var(--tram-yellow)] mt-0.5">⚠</span>
                  <span className="flex-1">{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer with timestamp */}
        <div className="pt-4 border-t border-[var(--border)]">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Generated by AI
            </span>
            <span className={stale ? "text-[var(--tram-yellow)]" : ""}>
              {formatRelativeTime(insights.generatedAt)}
              {stale && " (stale)"}
            </span>
          </div>
        </div>
      </CardContent>
      )}
    </Card>
  );
}
