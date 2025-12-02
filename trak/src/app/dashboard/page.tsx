import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import DashboardOverview from "./dashboard-overview";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getStandaloneTasks } from "@/app/actions/standalone-task";

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

  // Fetch dashboard data
  const [projectsResult, docsResult, tasksResult, standaloneTasksResult] = await Promise.all([
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

    // Get tasks from blocks
    supabase
      .from("blocks")
      .select(`
        id,
        content,
        tab:tabs!blocks_tab_id_fkey(
          id,
          name,
          project:projects!tabs_project_id_fkey(
            id,
            name,
            workspace_id
          )
        )
      `)
      .eq("type", "task")
      .eq("tab.project.workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(20),
    
    // Get standalone tasks
    getStandaloneTasks(workspaceId),
  ]);

  const projects = projectsResult.data || [];
  const docs = docsResult.data || [];
  const taskBlocks = tasksResult.data || [];
  const standaloneTasks = standaloneTasksResult.data || [];

  // Extract uncompleted tasks from project blocks
  const projectTasks = taskBlocks
    .map((block: any) => {
      const tasks = Array.isArray(block.content?.tasks) ? block.content.tasks : [];
      return tasks
        .filter((task: any) => {
          const status = typeof task.status === "string" ? task.status.toLowerCase() : "";
          const isDoneStatus = status === "done" || status === "complete" || status === "completed";
          const isDoneFlag = task.completed || task.done;
          return !(isDoneStatus || isDoneFlag);
        })
        .map((task: any) => ({
          id: `${block.id}-${task.id}`,
          text: task.text,
          projectName: block.tab?.project?.name || "Unknown",
          tabName: block.tab?.name || "Unknown",
          projectId: block.tab?.project?.id,
          tabId: block.tab?.id,
          priority: task.priority,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          status: task.status ?? (task.completed || task.done ? "done" : "todo"),
        }));
    })
    .flat();

  // Transform standalone tasks to match format
  const standaloneTasksFormatted = standaloneTasks
    .filter((task: any) => task.status !== "done")
    .map((task: any) => ({
      id: `standalone-${task.id}`,
      text: task.text,
      projectName: "Miscellaneous",
      tabName: "Tasks",
      projectId: null,
      tabId: null,
      priority: task.priority,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
    }));

  // Combine and limit to 10
  const tasks = [...projectTasks, ...standaloneTasksFormatted].slice(0, 10);

  return (
    <DashboardOverview
      projects={projects}
      docs={docs}
      tasks={tasks}
      workspaceId={workspaceId}
    />
  );
}
