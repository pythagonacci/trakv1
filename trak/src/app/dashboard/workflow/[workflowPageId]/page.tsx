import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { getTabBlocks, type Block } from "@/app/actions/block";
import { getBatchFileUrls } from "@/app/actions/file";
import WorkflowPageLayout from "./workflow-page-layout";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ workflowPageId: string }>;
}) {
  const supabase = await createClient();
  const { workflowPageId } = await params;

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/dashboard");

  const authResult = await requireWorkspaceAccess(workspaceId);
  if ("error" in authResult) redirect("/login");

  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("id, name, project_id, is_workflow_page, workflow_metadata, projects!inner(id, workspace_id)")
    .eq("id", workflowPageId)
    .eq("projects.workspace_id", workspaceId)
    .single();

  if (tabError || !tab || !tab.is_workflow_page) {
    notFound();
  }

  const blocksResult = await getTabBlocks(tab.id);
  const blocks = (blocksResult.data || []) as Block[];

  // Prefetch file URLs similar to tab pages
  const fileIds: string[] = [];
  for (const block of blocks) {
    const content = (block.content || {}) as Record<string, unknown>;
    const fileId = content.fileId;
    if ((block.type === "image" || block.type === "pdf" || block.type === "video") && typeof fileId === "string") {
      fileIds.push(fileId);
    }

    if (block.type === "gallery") {
      const items = content.items;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const maybe = (item as Record<string, unknown>).fileId;
          if (typeof maybe === "string") fileIds.push(maybe);
        }
      }
    }
  }

  // For file blocks, fetch attachments to get file IDs
  const fileBlockIds = blocks.filter((b) => b.type === "file").map((b) => b.id);
  if (fileBlockIds.length > 0) {
    const { data: fileAttachments } = await supabase
      .from("file_attachments")
      .select("file:files(id)")
      .in("block_id", fileBlockIds);

    if (fileAttachments) {
      for (const attachment of fileAttachments as Array<Record<string, unknown>>) {
        const file = attachment.file as { id?: string } | Array<{ id?: string }> | null;
        const normalized = Array.isArray(file) ? file[0] : file;
        if (normalized?.id) fileIds.push(normalized.id);
      }
    }
  }

  const fileUrlsResult = fileIds.length > 0 ? await getBatchFileUrls(fileIds) : { data: {} };
  const initialFileUrls = fileUrlsResult.data || {};

  return (
    <WorkflowPageLayout
      tabId={tab.id}
      projectId={tab.project_id}
      workspaceId={workspaceId}
      title={tab.name}
      blocks={blocks}
      initialFileUrls={initialFileUrls}
    />
  );
}
