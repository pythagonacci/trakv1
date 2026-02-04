"use client";

import { useState } from "react";
import { MessageSquare, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import TabCanvasWrapper from "@/app/dashboard/projects/[projectId]/tabs/[tabId]/tab-canvas-wrapper";
import type { Block } from "@/app/actions/block";
import WorkflowAIChatPanel from "./workflow-ai-chat-panel";
import { enableWorkflowPageSharing } from "@/app/actions/workflow-page";

export default function WorkflowPageLayout(props: {
  tabId: string;
  projectId: string;
  workspaceId: string;
  title: string;
  blocks: Block[];
  initialFileUrls: Record<string, string>;
}) {
  const [chatOpen, setChatOpen] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);

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
    <div className="h-[calc(100vh-64px)] w-full">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[#265b52]/20 bg-[var(--surface)] px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-[var(--foreground)]">
              {props.title}
            </h1>
            <p className="text-xs text-[var(--muted-foreground)]">Workflow Page</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onShare()}
              disabled={shareLoading}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                "border-[#265b52]/30 bg-[#265b52]/10 text-white hover:bg-[#265b52]/15 disabled:opacity-50"
              )}
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                "border-[#265b52]/30 bg-[#265b52]/10 text-white hover:bg-[#265b52]/15"
              )}
            >
              {chatOpen ? <X className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
              {chatOpen ? "Hide AI" : "Show AI"}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className={cn("min-w-0 flex-1", chatOpen && "border-r border-[#265b52]/20")}>
            <div className="h-full overflow-auto px-2 md:px-3 lg:px-4 py-3">
              <TabCanvasWrapper
                tabId={props.tabId}
                projectId={props.projectId}
                workspaceId={props.workspaceId}
                blocks={props.blocks}
                initialFileUrls={props.initialFileUrls}
              />
            </div>
          </div>

          {chatOpen && (
            <div className="w-[420px] max-w-[45vw] min-w-[340px]">
              <WorkflowAIChatPanel tabId={props.tabId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
