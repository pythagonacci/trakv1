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
  timeEnd?: string;
  type: "task" | "project" | "google";
  projectId?: string;
  tabId?: string;
  taskId?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  projectName?: string;
  tabName?: string;
  externalUrl?: string;
  location?: string;
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

  // Fetch tasks with due dates from task items
  const { data: taskItems } = await supabase
    .from("task_items")
    .select(`
      id,
      title,
      due_date,
      due_time,
      due_time_end,
      priority,
      task_block_id,
      tab:tabs!task_items_tab_id_fkey(
        id,
        name,
        project:projects!tabs_project_id_fkey(
          id,
          name,
          workspace_id
        )
      )
    `)
    .eq("workspace_id", workspaceId)
    .not("due_date", "is", null)
    .order("updated_at", { ascending: false });

  // Fetch projects with due dates
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, due_date_date, due_date_text, workspace_id")
    .eq("workspace_id", workspaceId)
    .not("due_date_date", "is", null);

  // Extract events from tasks
  const taskEvents: CalendarEvent[] = [];
  taskItems?.forEach((task: any) => {
    if (task.due_date) {
      const dueTime = task.due_time ? String(task.due_time).slice(0, 5) : undefined;
      const dueTimeEnd = task.due_time_end ? String(task.due_time_end).slice(0, 5) : undefined;
      taskEvents.push({
        id: `task-${task.task_block_id}-${task.id}`,
        title: task.title || "Untitled Task",
        date: task.due_date,
        time: dueTime,
        timeEnd: dueTimeEnd,
        type: "task",
        projectId: task.tab?.project?.id,
        tabId: task.tab?.id,
        taskId: String(task.id),
        priority: task.priority,
        projectName: task.tab?.project?.name || "Unknown",
        tabName: task.tab?.name || "Unknown",
      });
    }
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
