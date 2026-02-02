"use server";

import { createClient } from "@/lib/supabase/server";
import { IndexingQueue } from "@/lib/search/job-queue";
import { requireWorkspaceAccess, checkWorkspaceMembership } from "@/lib/auth-utils";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import type { AuthContext } from "@/lib/auth-context";

type ReindexWorkspaceParams = {
  workspaceId?: string;
  includeBlocks?: boolean;
  includeFiles?: boolean;
  maxItems?: number;
  authContext?: AuthContext;
};

type ReindexResult = {
  workspaceId: string;
  enqueued: number;
  blocks: number;
  files: number;
};

const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 100;
const JOB_BATCH_SIZE = 500;

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchIdsByField(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  field: string,
  value: string
) {
  const ids: string[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq(field, value)
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to load ${table} for reindex`);
    }
    const batch = (data || []).map((row: any) => row.id as string);
    ids.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return ids;
}

async function fetchIdsByIn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  field: string,
  values: string[]
) {
  const ids: string[] = [];
  const chunks = chunkArray(values, IN_CHUNK_SIZE);
  for (const chunk of chunks) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select("id")
        .in(field, chunk)
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        throw new Error(`Failed to load ${table} for reindex`);
      }
      const batch = (data || []).map((row: any) => row.id as string);
      ids.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return ids;
}

async function enqueueInBatches(queue: IndexingQueue, jobs: Array<{ workspaceId: string; resourceType: string; resourceId: string }>) {
  for (let i = 0; i < jobs.length; i += JOB_BATCH_SIZE) {
    const batch = jobs.slice(i, i + JOB_BATCH_SIZE);
    await queue.bulkEnqueue(batch);
  }
}

export async function reindexWorkspaceContent(params: ReindexWorkspaceParams = {}) {
  const workspaceId = params.workspaceId || (await getCurrentWorkspaceId());
  if (!workspaceId) {
    return { error: "Missing workspaceId" };
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  if (params.authContext) {
    supabase = params.authContext.supabase;
    const membership = await checkWorkspaceMembership(workspaceId, params.authContext.userId);
    if (!membership) {
      return { error: "Not a member of this workspace" };
    }
  } else {
    const access = await requireWorkspaceAccess(workspaceId);
    if ("error" in access) {
      return { error: access.error };
    }
    supabase = await createClient();
  }

  const queue = new IndexingQueue(supabase);

  const includeBlocks = params.includeBlocks !== false;
  const includeFiles = params.includeFiles !== false;
  const maxItems = typeof params.maxItems === "number" ? Math.max(0, params.maxItems) : null;

  const jobs: Array<{ workspaceId: string; resourceType: string; resourceId: string }> = [];

  let blockCount = 0;
  let fileCount = 0;

  if (includeFiles) {
    const fileIds = await fetchIdsByField(supabase, "files", "workspace_id", workspaceId);
    const limited = maxItems ? fileIds.slice(0, maxItems) : fileIds;
    fileCount = limited.length;
    limited.forEach((fileId) => {
      jobs.push({
        workspaceId,
        resourceType: "file",
        resourceId: fileId,
      });
    });
  }

  if (includeBlocks) {
    const projectIds = await fetchIdsByField(supabase, "projects", "workspace_id", workspaceId);
    if (projectIds.length > 0) {
      const tabIds = await fetchIdsByIn(supabase, "tabs", "project_id", projectIds);
      if (tabIds.length > 0) {
        const blockIds = await fetchIdsByIn(supabase, "blocks", "tab_id", tabIds);
        const remaining =
          maxItems && includeFiles ? Math.max(0, maxItems - fileCount) : maxItems;
        const limited = remaining != null ? blockIds.slice(0, remaining) : blockIds;
        blockCount = limited.length;
        limited.forEach((blockId) => {
          jobs.push({
            workspaceId,
            resourceType: "block",
            resourceId: blockId,
          });
        });
      }
    }
  }

  if (jobs.length > 0) {
    await enqueueInBatches(queue, jobs);
  }

  const result: ReindexResult = {
    workspaceId,
    enqueued: jobs.length,
    blocks: blockCount,
    files: fileCount,
  };

  return { data: result };
}
