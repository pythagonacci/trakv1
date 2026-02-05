import { notFound } from "next/navigation";
import ClientPageHeader from "../../client-page-header";
import ClientPageContent from "../../client-page-content";
import AutoRefresh from "../../auto-refresh";
import { getWorkflowTabBlocksPublic, type Block } from "@/app/actions/block";
import { getBatchFileUrlsPublic } from "@/app/actions/file";
import type { ClientPageProject } from "@/app/actions/client-page";

export const dynamic = "force-dynamic";

type PublicBlock = {
  id: string;
  type: string;
  content?: Record<string, unknown>;
};

function extractFileIdsFromBlocks(blocks: PublicBlock[]) {
  const ids: string[] = [];
  for (const block of blocks) {
    const content = block.content || {};
    const fileId = content.fileId;
    if ((block.type === "image" || block.type === "pdf" || block.type === "video") && typeof fileId === "string") {
      ids.push(fileId);
    }
    if (block.type === "gallery") {
      const items = content.items;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const maybe = (item as Record<string, unknown>).fileId;
          if (typeof maybe === "string") ids.push(maybe);
        }
      }
    }
  }
  return ids;
}

export default async function PublicWorkflowPage({
  params,
}: {
  params: Promise<{ publicToken: string; workflowPageId: string }>;
}) {
  const { publicToken, workflowPageId } = await params;

  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = await createServiceClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, name, status, due_date_date, due_date_text, client_page_enabled, client_comments_enabled, public_token, updated_at, client:clients(id, name, company)"
    )
    .eq("public_token", publicToken)
    .eq("client_page_enabled", true)
    .single();

  if (projectError || !project) {
    notFound();
  }

  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("id, name, project_id, is_workflow_page")
    .eq("id", workflowPageId)
    .eq("project_id", project.id)
    .eq("is_workflow_page", true)
    .single();

  if (tabError || !tab) {
    notFound();
  }

  const blocksResult = await getWorkflowTabBlocksPublic(tab.id, publicToken);
  if (blocksResult.error) {
    console.error("Failed to fetch workflow blocks:", blocksResult.error);
    notFound();
  }

  const blocks = (blocksResult.data || []) as PublicBlock[];
  const fileIds: string[] = extractFileIdsFromBlocks(blocks);
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

  const fileUrlsResult = fileIds.length > 0 ? await getBatchFileUrlsPublic(fileIds, publicToken) : { data: {} };
  const initialFileUrls = fileUrlsResult.data || {};

  const rawClient = (project as unknown as { client?: unknown }).client;
  const client = Array.isArray(rawClient) ? rawClient[0] : rawClient;

  const formattedProject: ClientPageProject = {
    ...(project as unknown as Omit<ClientPageProject, "client">),
    client: (client && typeof client === "object"
      ? (client as ClientPageProject["client"])
      : null),
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-3 md:px-4 lg:px-5">
        <div className="pt-4 pb-2">
          <ClientPageHeader project={formattedProject} tabId={tab.id} />
          <div className="mt-3 rounded-md border border-[#ba7b84]/20 bg-[#ba7b84]/5 px-3 py-2">
            <div className="text-[11px] uppercase tracking-widest text-[var(--muted-foreground)]">
              Workflow Page
            </div>
            <div className="text-sm font-semibold text-[var(--foreground)]">{tab.name}</div>
          </div>
        </div>

        <div className="py-3 md:py-4 lg:py-5">
          <ClientPageContent
            blocks={blocks as Block[]}
            publicToken={publicToken}
            allowComments={false}
            initialFileUrls={initialFileUrls}
          />
        </div>
      </div>

      <AutoRefresh />
    </div>
  );
}
