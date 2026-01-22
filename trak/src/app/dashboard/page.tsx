import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import DashboardOverview from "./dashboard-overview";
import { getServerUser } from "@/lib/auth/get-server-user";
import { BlockComment } from "@/types/block-comment";

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
  const [projectsResult, docsResult, tasksResult, commentBlocksResult] = await Promise.allSettled([
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

    // Get tasks from task items - optimized with better filtering
    supabase
      .from("task_items")
      .select(`
        id,
        title,
        status,
        priority,
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
      .order("updated_at", { ascending: false })
      .limit(20),

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

  const commentBlocks = commentBlocksResult.status === 'fulfilled' && !commentBlocksResult.value.error
    ? commentBlocksResult.value.data || []
    : [];

  // Extract uncompleted tasks from project blocks
  const tasks = taskItems
    .filter((task: any) => {
      const status = typeof task.status === "string" ? task.status.toLowerCase() : "";
      const isDoneStatus = status === "done" || status === "complete" || status === "completed";
      return !isDoneStatus;
    })
    .map((task: any) => ({
      id: `${task.task_block_id}-${task.id}`,
      text: task.title,
      projectName: task.tab?.project?.name || "Unknown",
      tabName: task.tab?.name || "Unknown",
      projectId: task.tab?.project?.id,
      tabId: task.tab?.id,
      priority: task.priority,
      dueDate: task.due_date,
      dueTime: task.due_time,
      status: task.status ?? "todo",
    }))
    .slice(0, 10);

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

  return (
    <DashboardOverview
      projects={projects}
      docs={docs}
      tasks={tasks}
      workspaceId={workspaceId}
      clientFeedback={clientFeedback}
    />
  );
}
