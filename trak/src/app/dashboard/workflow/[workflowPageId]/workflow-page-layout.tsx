"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Share2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import TabCanvasWrapper from "@/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas-wrapper";
import type { Block } from "@/app/actions/block";
import { AIPanel } from "@/components/ai";
import { enableWorkflowPageSharing, createWorkflowPage } from "@/app/actions/workflow-page";

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
  const [chatOpen, setChatOpen] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [newPageLoading, setNewPageLoading] = useState(false);
  const inProject = Boolean(props.inProjectContext);

  // In a project tab, use the same AI as other tabs: dashboard layout's AICommandPalette
  // (full-height column beside the main content via ⌘K / Ask AI), not an embedded narrow sidebar.
  if (inProject) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
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
    );
  }

  const onCreate = async () => {
    if (newPageLoading) return;
    setNewPageLoading(true);
    try {
      const result = await createWorkflowPage({ isWorkspaceLevel: true });
      if ("error" in result) {
        alert(result.error);
        return;
      }
      router.push(`/dashboard/workflow/${result.data.tabId}`);
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

        <div className="flex min-h-0 flex-1 relative overflow-hidden">
          <div className={cn("min-w-0 flex-1 min-h-0", chatOpen && "border-r border-[var(--primary)]/20")}>
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
        </div>
      </div>
    </div>
  );
}
