"use server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { getWorkspaceEverything } from "@/app/actions/everything-view";
import { getDueDateEnd } from "@/lib/due-date";
import type { BlockComment } from "@/types/block-comment";
import type { DashboardInsight } from "@/app/actions/dashboard-insights";

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardProject {
    id: string;
    name: string;
    status: string;
    project_type: string;
    updated_at: string;
}

export interface DashboardDoc {
    id: string;
    title: string;
    updated_at: string;
}

export interface DashboardTask {
    id: string;
    text: string;
    projectName: string;
    tabName: string;
    projectId?: string | null;
    tabId?: string | null;
    priority?: "urgent" | "high" | "medium" | "low" | "none";
    dueDate?: string;
    dueTime?: string;
    sourceUrl?: string;
}

export interface DashboardDueAwareItem {
    id: string;
    text: string;
    projectName: string;
    tabName: string;
    projectId: string | null;
    tabId: string | null;
    priority: string | null;
    dueDate: string;
    sourceUrl: string;
    type: string;
}

export interface DashboardClientFeedback {
    id: string;
    text: string;
    author: string;
    projectName: string;
    tabName: string;
    projectId?: string | null;
    tabId?: string | null;
    blockId: string;
    timestamp?: string;
}

export interface DashboardData {
    projects: DashboardProject[];
    docs: DashboardDoc[];
    tasks: DashboardTask[];
    dueAwareItems: DashboardDueAwareItem[];
    clientFeedback: DashboardClientFeedback[];
    teamUpdates: DashboardClientFeedback[];
    aiInsights: DashboardInsight | null;
    workspaceId: string;
    userId: string;
    userName?: string;
}

// ============================================================================
// SERVER ACTION
// ============================================================================

/**
 * Consolidated dashboard data fetch.
 * Runs ALL queries in a single Promise.allSettled (including getWorkspaceEverything
 * which was previously run serially after the other queries).
 * Returns a single typed response for client-side caching via React Query.
 */
export async function getDashboardData(
    workspaceId: string
): Promise<{ data: DashboardData } | { error: string }> {
    const authResult = await getServerUser();
    if (!authResult) {
        return { error: "Not authenticated" };
    }
    const { supabase, user } = authResult;
    const doneStatuses = new Set(["done", "complete", "completed"]);
    const isTaskDone = (task: any): boolean => {
        const legacyStatus =
            typeof task?.status === "string" ? task.status.toLowerCase() : "";
        if (doneStatuses.has(legacyStatus)) return true;

        const statuses = Array.isArray(task?.statuses) ? task.statuses : [];
        for (const entry of statuses) {
            const value =
                typeof entry?.value === "string" ? entry.value.toLowerCase() : "";
            if (doneStatuses.has(value)) return true;
        }
        return false;
    };

    // Run ALL queries in parallel — including getWorkspaceEverything which was
    // previously serial (the main perf bottleneck).
    const [
        projectsResult,
        docsResult,
        tasksResult,
        commentBlocksResult,
        aiInsightsResult,
        everythingResult,
    ] = await Promise.allSettled([
        // 1. Projects
        supabase
            .from("projects")
            .select("id, name, status, project_type, updated_at")
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false })
            .limit(5),

        // 2. Recent docs
        supabase
            .from("docs")
            .select("id, title, updated_at")
            .eq("workspace_id", workspaceId)
            .eq("is_archived", false)
            .order("updated_at", { ascending: false })
            .limit(5),

        // 3. Open tasks
        supabase
            .from("task_items")
            .select(`
        id,
        title,
        statuses,
        priorities,
        due_date,
        due_time,
        task_block_id,
        tab_id,
        tab:tabs(
          id,
          name,
          project_id,
          project:projects(
            id,
            name
          )
        )
      `)
            .eq("workspace_id", workspaceId)
            .eq("is_placeholder", false)
            .order("due_date", { ascending: true, nullsFirst: false })
            .order("updated_at", { ascending: false })
            .limit(100),

        // 4. Comment blocks
        supabase
            .from("blocks")
            .select(`
        id,
        content,
        updated_at,
        tab_id,
        tabs!inner(
          id,
          name,
          project_id,
          projects!inner(
            id,
            name
          )
        )
      `)
            .eq("tabs.projects.workspace_id", workspaceId)
            .not("content->>_blockComments", "is", null)
            .order("updated_at", { ascending: false })
            .limit(40),

        // 5. AI insights (cached from DB)
        (async () => {
            const { getDashboardInsights } = await import(
                "@/app/actions/dashboard-insights"
            );
            return getDashboardInsights(workspaceId);
        })(),

        // 6. Everything view — NOW IN PARALLEL instead of serial
        getWorkspaceEverything(workspaceId, { limit: 500 }),
    ]);

    // ---- Extract results with graceful degradation ----

    const projects =
        projectsResult.status === "fulfilled" && !projectsResult.value.error
            ? projectsResult.value.data || []
            : [];

    const docs =
        docsResult.status === "fulfilled" && !docsResult.value.error
            ? docsResult.value.data || []
            : [];

    const taskItems =
        tasksResult.status === "fulfilled" && !tasksResult.value.error
            ? tasksResult.value.data || []
            : [];

    const commentBlocks =
        commentBlocksResult.status === "fulfilled" &&
            !commentBlocksResult.value.error
            ? commentBlocksResult.value.data || []
            : [];

    const aiInsights =
        aiInsightsResult.status === "fulfilled" && !aiInsightsResult.value.error
            ? aiInsightsResult.value.data
            : null;

    // ---- Build due-aware items from everything view ----

    const dueAwareItems: DashboardDueAwareItem[] = [];
    if (
        everythingResult.status === "fulfilled" &&
        !("error" in everythingResult.value) &&
        everythingResult.value.data.items.length > 0
    ) {
        for (const item of everythingResult.value.data.items) {
            const dueDateStr = getDueDateEnd(item.properties.due_date ?? null);
            const status = (item.properties.status ?? "").toString().toLowerCase();
            if (doneStatuses.has(status)) continue;
            if (!dueDateStr) continue;
            const dateOnly = dueDateStr.slice(0, 10);
            if (!dateOnly || dateOnly.length < 10) continue;
            dueAwareItems.push({
                id: item.type === "task" ? `task-${item.id}` : item.id,
                text: item.name,
                projectName: item.source.projectName,
                tabName: item.source.tabName,
                projectId: item.source.projectId,
                tabId: item.source.tabId,
                priority: item.properties.priority ?? null,
                dueDate: dateOnly,
                sourceUrl: item.source.url,
                type: item.type,
            });
        }
        dueAwareItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }

    // ---- Transform tasks ----

    const tasks: DashboardTask[] = taskItems
        .filter((task: any) => !isTaskDone(task))
        .map((task: any) => {
            const taskPriorities = Array.isArray(task.priorities)
                ? task.priorities
                : [];
            const firstPriority = taskPriorities[0]?.value ?? null;
            return {
                id: `${task.task_block_id}-${task.id}`,
                text: task.title,
                projectName: task.tab?.project?.name || "Unknown",
                tabName: task.tab?.name || "Unknown",
                projectId: task.tab?.project?.id,
                tabId: task.tab?.id,
                priority: firstPriority,
                dueDate: task.due_date ?? undefined,
                dueTime: task.due_time ?? undefined,
                status: task.status ?? "todo",
            };
        });

    // ---- Extract comments ----

    const teamUpdates: DashboardClientFeedback[] = commentBlocks
        .flatMap((block: any) => {
            const comments: BlockComment[] = Array.isArray(
                block.content?._blockComments
            )
                ? block.content._blockComments
                : [];
            return comments
                .filter(
                    (c) =>
                        c && c.source !== "external" && c.author_id && c.author_id !== user.id
                )
                .map((c) => ({
                    id: c.id ?? `${block.id}-${c.timestamp}`,
                    text: c.text,
                    author:
                        c.author_name || c.author_email?.split("@")[0] || "Teammate",
                    projectName: block.tabs?.projects?.name || "Unknown project",
                    tabName: block.tabs?.name || "Untitled tab",
                    projectId: block.tabs?.projects?.id || null,
                    tabId: block.tabs?.id || null,
                    blockId: block.id,
                    timestamp: c.timestamp,
                }));
        })
        .sort((a, b) => {
            const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return bTime - aTime;
        })
        .slice(0, 6);

    const clientFeedback: DashboardClientFeedback[] = commentBlocks
        .flatMap((block: any) => {
            const comments: BlockComment[] = Array.isArray(
                block.content?._blockComments
            )
                ? block.content._blockComments
                : [];
            return comments
                .filter((comment) => comment?.source === "external")
                .map((comment) => ({
                    id: comment.id ?? `${block.id}-${comment.timestamp}`,
                    text: comment.text,
                    author:
                        comment.author_name ||
                        comment.author_email?.split("@")[0] ||
                        "Client",
                    projectName: block.tabs?.projects?.name || "Unknown project",
                    tabName: block.tabs?.name || "Untitled tab",
                    projectId: block.tabs?.projects?.id || null,
                    tabId: block.tabs?.id || null,
                    blockId: block.id,
                    timestamp: comment.timestamp,
                }));
        })
        .sort((a, b) => {
            const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return bTime - aTime;
        })
        .slice(0, 10);

    return {
        data: {
            projects,
            docs,
            tasks,
            dueAwareItems,
            clientFeedback,
            teamUpdates,
            aiInsights,
            workspaceId,
            userId: user.id,
            userName: user.email,
        },
    };
}
