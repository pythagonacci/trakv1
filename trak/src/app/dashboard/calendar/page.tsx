import { redirect } from "next/navigation";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getServerUser } from "@/lib/auth/get-server-user";
import CalendarView from "./calendar-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: "task" | "project";
  projectId?: string;
  tabId?: string;
  taskId?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  projectName?: string;
  tabName?: string;
}

export default async function CalendarPage() {
  const workspaceId = await getCurrentWorkspaceId();

  // Auth check
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }
  const { supabase } = authResult;

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-neutral-500">No workspace selected</p>
        </div>
      </div>
    );
  }

  // Fetch tasks with due dates from task blocks
  const { data: taskBlocks } = await supabase
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
    .order("updated_at", { ascending: false });

  // Fetch projects with due dates
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, due_date_date, due_date_text, workspace_id")
    .eq("workspace_id", workspaceId)
    .not("due_date_date", "is", null);

  // Extract events from tasks
  const taskEvents: CalendarEvent[] = [];
  taskBlocks?.forEach((block: any) => {
    const tasks = block.content?.tasks || [];
    tasks.forEach((task: any) => {
      if (task.dueDate) {
        taskEvents.push({
          id: `task-${block.id}-${task.id}`,
          title: task.text || "Untitled Task",
          date: task.dueDate,
          time: task.dueTime,
          type: "task",
          projectId: block.tab?.project?.id,
          tabId: block.tab?.id,
          taskId: String(task.id),
          priority: task.priority,
          projectName: block.tab?.project?.name || "Unknown",
          tabName: block.tab?.name || "Unknown",
        });
      }
    });
  });

  // Extract events from projects
  const projectEvents: CalendarEvent[] = [];
  projects?.forEach((project: any) => {
    if (project.due_date_date) {
      projectEvents.push({
        id: `project-${project.id}`,
        title: project.name,
        date: project.due_date_date,
        type: "project",
        projectId: project.id,
      });
    }
  });

  const allEvents = [...taskEvents, ...projectEvents];

  return <CalendarView initialEvents={allEvents} workspaceId={workspaceId} />;
}

