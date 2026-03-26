"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
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
  const lastGeneratedAt = useRef<string | null>(
    initialInsights?.generatedAt ?? null
  );
  const intervalMs = 15 * 60 * 1000; // 15 minutes
  const staleThresholdMs = 5 * 60 * 1000; // consider stale after 5 min for visibility refresh

  const cardClassName =
    "border border-[var(--border)] bg-[var(--surface)] shadow-none rounded-[var(--radius-xl)]";

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
          lastGeneratedAt.current = result.data.generatedAt;
        }
      } catch (err) {
        setError(String(err));
      } finally {
        refreshInFlight.current = false;
      }
    });
  }, [startTransition, userId, userName, workspaceId]);

  // Keep last generated time in sync with state
  useEffect(() => {
    if (insights?.generatedAt) lastGeneratedAt.current = insights.generatedAt;
  }, [insights?.generatedAt]);

  // Periodic refresh every 15 min (only when tab is visible)
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      handleRegenerate();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs, handleRegenerate]);

  // Refresh when user returns to the tab if data is older than 5 min
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const at = lastGeneratedAt.current;
      if (!at) {
        handleRegenerate();
        return;
      }
      const age = Date.now() - new Date(at).getTime();
      if (age >= staleThresholdMs) handleRegenerate();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [handleRegenerate, staleThresholdMs]);

  // Loading state during regeneration
  if (isPending) {
    return (
      <Card className={`${cardClassName} animate-pulse`}>
        <CardHeader
          className="cursor-pointer px-4 pt-4 pb-3"
          onClick={() => setIsExpanded((e) => !e)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 20,
                  height: 20,
                  background: "var(--primary-pale)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "var(--primary)",
                }}
              >
                ✦
              </div>
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                }}
              >
                AI Overview
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-[var(--tertiary-foreground)] transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="px-4 pb-4 pt-0">
            <div className="space-y-4">
              <div className="h-16 rounded bg-[var(--muted)]/10" />
              <div className="h-16 rounded bg-[var(--muted)]/10" />
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  // No data yet (e.g. new workspace) — friendly empty state
  if (!insights && !error) {
    return (
      <Card className={cardClassName}>
        <CardHeader
          className="cursor-pointer px-4 pt-4 pb-3"
          onClick={() => setIsExpanded((e) => !e)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 20,
                  height: 20,
                  background: "var(--primary-pale)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "var(--primary)",
                }}
              >
                ✦
              </div>
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                }}
              >
                AI Overview
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-[var(--tertiary-foreground)] transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="px-4 pb-4 pt-0">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Sparkles className="h-8 w-8 text-[var(--muted-foreground)] mb-4" />
              <p className="mb-4 max-w-sm text-sm leading-relaxed font-[380] text-[var(--foreground)]">
                Your workspace is new. Add some projects and tasks, then we&apos;ll generate an AI overview here.
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
                Try again
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  // Error state (something went wrong)
  if (error || !insights) {
    return (
      <Card className={cardClassName}>
        <CardHeader
          className="cursor-pointer px-4 pt-4 pb-3"
          onClick={() => setIsExpanded((e) => !e)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 20,
                  height: 20,
                  background: "var(--primary-pale)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "var(--primary)",
                }}
              >
                ✦
              </div>
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                }}
              >
                AI Overview
              </span>
            </div>
            <ChevronDown className={`h-4 w-4 text-[var(--tertiary-foreground)] transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="px-4 pb-4 pt-0">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-[var(--muted-foreground)] mb-4" />
              <p className="mb-4 text-sm leading-relaxed font-[380] text-[var(--foreground)]">
                {error ?? "Something went wrong. Try again."}
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
    <Card className={cardClassName}>
      <CardHeader
        className="cursor-pointer px-4 pt-4 pb-3"
        onClick={() => setIsExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 20,
                height: 20,
                background: "var(--primary-pale)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                color: "var(--primary)",
              }}
            >
              ✦
            </div>
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                fontWeight: 500,
                color: "var(--muted-foreground)",
              }}
            >
              AI Overview
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRegenerate();
              }}
              disabled={isPending}
              className="h-auto px-2 py-1 text-[11.5px] text-[var(--tertiary-foreground)]"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Regenerate
            </Button>
            <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--tertiary-foreground)] transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="px-4 pb-0 pt-0">
          <p className="text-sm leading-relaxed font-[380] text-[var(--foreground)]">
            {insights.summary}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 0",
              marginTop: 12,
              borderTop: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10.5,
                color: "var(--faint-foreground)",
              }}
            >
              <Info className="h-3 w-3" />
              Generated by AI
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: stale ? "var(--warning)" : "var(--faint-foreground)",
              }}
            >
              {formatRelativeTime(insights.generatedAt)}
              {stale && " (stale)"}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
