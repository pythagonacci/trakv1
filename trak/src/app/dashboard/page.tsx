import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import DashboardOverview from "./dashboard-overview";
import { getServerUser } from "@/lib/auth/get-server-user";
import { BlockComment } from "@/types/block-comment";
import { getWorkspaceEverything } from "@/app/actions/everything-view";
import { getDueDateEnd } from "@/lib/due-date";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const workspaceId = await getCurrentWorkspaceId();

  // Auth check
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }
  const { supabase, user } = authResult;

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-neutral-500">No workspace selected</p>
        </div>
      </div>
    );
  }

  // Fetch dashboard data with graceful degradation
  const [projectsResult, docsResult, tasksResult, completedTasksResult, commentBlocksResult, aiInsightsResult] = await Promise.allSettled([
    // Get projects
    supabase
      .from("projects")
      .select("id, name, status, project_type, updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(5),

    // Get recent docs
    supabase
      .from("docs")
      .select("id, title, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(5),

    // Get open tasks from task items — order by due_date so overdue/today/upcoming show in overview blocks
    supabase
      .from("task_items")
      .select(`
        id,
        title,
        status,
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
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(100),

    // Get recently completed tasks (status = done, ordered by updated_at)
    supabase
      .from("task_items")
      .select(`
        id,
        title,
        status,
        task_block_id,
        tab_id,
        updated_at,
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
      .in("status", ["done", "complete", "completed"])
      .order("updated_at", { ascending: false })
      .limit(6),

    // Blocks with potential client comments - optimized with inner joins
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

    // Get AI-generated dashboard insights
    (async () => {
      const { getDashboardInsights } = await import("@/app/actions/dashboard-insights");
      return getDashboardInsights(workspaceId);
    })(),
  ]);

  // Extract results with error handling for graceful degradation
  const projects = projectsResult.status === 'fulfilled' && !projectsResult.value.error
    ? projectsResult.value.data || []
    : [];

  const docs = docsResult.status === 'fulfilled' && !docsResult.value.error
    ? docsResult.value.data || []
    : [];

  const taskItems = tasksResult.status === 'fulfilled' && !tasksResult.value.error
    ? tasksResult.value.data || []
    : [];

  const completedTaskItems = completedTasksResult.status === 'fulfilled' && !completedTasksResult.value.error
    ? completedTasksResult.value.data || []
    : [];

  const commentBlocks = commentBlocksResult.status === 'fulfilled' && !commentBlocksResult.value.error
    ? commentBlocksResult.value.data || []
    : [];

  const aiInsights = aiInsightsResult.status === 'fulfilled' && !aiInsightsResult.value.error
    ? aiInsightsResult.value.data
    : null;

  // Items with due dates from entire workspace (tasks, timeline events, table rows, blocks) for Today/Upcoming/Past due blocks
  let dueAwareItems: Array<{
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
  }> = [];
  const everythingResult = await getWorkspaceEverything(workspaceId, { limit: 500 });
  if (!("error" in everythingResult) && everythingResult.data.items.length > 0) {
    const doneStatuses = new Set(["done", "complete", "completed"]);
    for (const item of everythingResult.data.items) {
      // Use end of range for bucketing (e.g. 10th–20th → categorize by 20th, not 10th)
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
    // Sort by due date then by updated
    dueAwareItems.sort((a, b) => {
      const c = a.dueDate.localeCompare(b.dueDate);
      return c !== 0 ? c : 0;
    });
  }

  // Team updates: internal comments left by other teammates (exclude current user)
  const teamUpdates = commentBlocks
    .flatMap((block: any) => {
      const comments: BlockComment[] = Array.isArray(block.content?._blockComments)
        ? block.content._blockComments
        : [];
      return comments
        .filter((c) => c && c.source !== "external" && c.author_id && c.author_id !== user.id)
        .map((c) => ({
          id: c.id ?? `${block.id}-${c.timestamp}`,
          text: c.text,
          author: c.author_name || c.author_email?.split("@")[0] || "Teammate",
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

  // Extract uncompleted tasks from project blocks (no slice — pass all so today/overdue/upcoming blocks have data)
  const tasks = taskItems
    .filter((task: any) => {
      const status = typeof task.status === "string" ? task.status.toLowerCase() : "";
      const isDoneStatus = status === "done" || status === "complete" || status === "completed";
      return !isDoneStatus;
    })
    .map((task: any) => {
      const taskPriorities = Array.isArray(task.priorities) ? task.priorities : [];
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

  const clientFeedback = commentBlocks
    .flatMap((block: any) => {
      const comments: BlockComment[] = Array.isArray(block.content?._blockComments)
        ? block.content._blockComments
        : [];
      return comments
        .filter((comment) => comment?.source === "external")
        .map((comment) => ({
          id: comment.id ?? `${block.id}-${comment.timestamp}`,
          text: comment.text,
          author: comment.author_name || comment.author_email?.split("@")[0] || "Client",
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

  // Recently completed: tasks marked done, ordered by updated_at
  const recentlyCompleted = completedTaskItems.map((task: any) => ({
    id: `${task.task_block_id}-${task.id}`,
    text: task.title,
    projectName: task.tab?.project?.name || "Unknown",
    tabName: task.tab?.name || "Unknown",
    projectId: task.tab?.project?.id,
    tabId: task.tab?.id,
    updatedAt: task.updated_at,
  }));

  return (
    <DashboardOverview
      projects={projects}
      docs={docs}
      tasks={tasks}
      dueAwareItems={dueAwareItems}
      workspaceId={workspaceId}
      clientFeedback={clientFeedback}
      teamUpdates={teamUpdates}
      recentlyCompleted={recentlyCompleted}
      aiInsights={aiInsights}
      userId={user.id}
      userName={user.email}
    />
  );
}
