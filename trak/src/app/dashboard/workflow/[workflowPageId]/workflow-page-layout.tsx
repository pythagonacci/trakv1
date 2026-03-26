"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Share2, X, Plus, PanelRightClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildProjectTabPath } from "@/lib/dashboard-routes";
import TabCanvasWrapper from "@/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas-wrapper";
import type { Block } from "@/app/actions/block";
import { AIPanel } from "@/components/ai";
import { enableWorkflowPageSharing, createWorkflowPage } from "@/app/actions/workflow-page";
import { useAI } from "@/components/ai";

export default function WorkflowPageLayout(props: {
  tabId: string;
  projectId: string;
  projectName?: string;
  workspaceId: string;
  title: string;
  blocks: Block[];
  initialFileUrls: Record<string, string>;
  /** When true, "New" creates a workflow page in this project and navigates to project tab. Otherwise creates workspace-level. */
  inProjectContext?: boolean;
}) {
  const router = useRouter();
  const { closeCommandPalette, setSuppressInlineSidebar } = useAI();
  const [chatOpen, setChatOpen] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [newPageLoading, setNewPageLoading] = useState(false);
  const inProject = Boolean(props.inProjectContext);

  // When in project context, ensure dashboard-content doesn't scroll
  // The workflow layout handles its own scrolling
  useEffect(() => {
    if (!inProject) return;
    const dashboardContent = document.getElementById("dashboard-content");
    if (dashboardContent) {
      dashboardContent.style.overflow = "hidden";
      return () => {
        dashboardContent.style.overflow = "";
      };
    }
  }, [inProject]);

  useEffect(() => {
    if (!inProject) return;
    setSuppressInlineSidebar(true);
    closeCommandPalette();
    return () => {
      setSuppressInlineSidebar(false);
    };
  }, [inProject, closeCommandPalette, setSuppressInlineSidebar]);

  const onCreate = async () => {
    if (newPageLoading) return;
    setNewPageLoading(true);
    try {
      const result = props.inProjectContext
        ? await createWorkflowPage({ projectId: props.projectId, isWorkspaceLevel: false })
        : await createWorkflowPage({ isWorkspaceLevel: true });
      if ("error" in result) {
        alert(result.error);
        return;
      }
      if (props.inProjectContext) {
        if (!props.projectName) {
          alert("Project name unavailable.");
          return;
        }
        router.push(
          buildProjectTabPath(
            props.projectId,
            result.data.tabId,
            props.projectName,
            result.data.tabName
          )
        );
      } else {
        router.push(`/dashboard/workflow/${result.data.tabId}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create workflow page";
      alert(message);
    } finally {
      setNewPageLoading(false);
    }
  };

  const onShare = async () => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      const result = await enableWorkflowPageSharing({ tabId: props.tabId });
      if ("error" in result) {
        alert(result.error);
        return;
      }
      const fullUrl = `${window.location.origin}${result.data.urlPath}`;
      await navigator.clipboard.writeText(fullUrl);
      alert("Share link copied to clipboard.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to enable sharing";
      alert(message);
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Header bar only for standalone workflow pages (not in project) */}
        {!inProject && (
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--primary)]/20 bg-[var(--surface)] px-4 py-3">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-[var(--foreground)]">
                {props.title}
              </h1>
              <p className="text-xs text-[var(--muted-foreground)]">Workflow Page</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onCreate()}
                disabled={newPageLoading}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-medium transition-colors",
                  "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-white hover:bg-[var(--primary)]/15 disabled:opacity-50"
                )}
                title="Create a new workflow page"
              >
                <Plus className="h-4 w-4" />
                New
              </button>
              <button
                type="button"
                onClick={() => void onShare()}
                disabled={shareLoading}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-medium transition-colors",
                  "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-white hover:bg-[var(--primary)]/15 disabled:opacity-50"
                )}
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button
                type="button"
                onClick={() => setChatOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-medium transition-colors",
                  "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-white hover:bg-[var(--primary)]/15"
                )}
              >
                {chatOpen ? <X className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                {chatOpen ? "Hide AI" : "Show AI"}
              </button>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 relative overflow-hidden">
          <div className={cn("min-w-0 flex-1 min-h-0", chatOpen && !inProject && "border-r border-[var(--primary)]/20", chatOpen && inProject && "border-r border-[var(--border)]")}>
            <div className="h-full min-h-0 overflow-auto px-2 md:px-3 lg:px-4 pt-3">
              <TabCanvasWrapper
                tabId={props.tabId}
              projectId={props.projectId}
              projectName={props.projectName}
              workspaceId={props.workspaceId}
                blocks={props.blocks}
                initialFileUrls={props.initialFileUrls}
                hidePageUndoButton
              />
            </div>
          </div>

          {/* AIPanel always mounted so streaming requests continue when collapsed */}
          <div
            className={cn(
              "shrink-0 flex min-h-0 h-full overflow-hidden transition-[width] duration-200",
              chatOpen ? "w-[420px] max-w-[45vw] min-w-[340px]" : "w-0 min-w-0"
            )}
          >
            <AIPanel
              projectId={props.projectId ?? null}
              tabId={props.tabId}
              variant="sidebar"
              showCollapseButton={false}
              onCollapse={undefined}
            />
          </div>
          {!chatOpen && inProject ? (
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="flex shrink-0 flex-col items-center justify-center gap-1 w-8 border-l border-[var(--border)] bg-[var(--surface)] py-3 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
              title="Show AI chat"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-[10px] font-medium">AI</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
