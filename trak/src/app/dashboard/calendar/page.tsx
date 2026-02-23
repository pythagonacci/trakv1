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
  type: "task" | "project" | "google" | "timeline";
  projectId?: string;
  tabId?: string;
  taskId?: string;
  timelineEventId?: string;
  blockId?: string;
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  projectName?: string;
  tabName?: string;
  externalUrl?: string;
  location?: string;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const workspaceId = await getCurrentWorkspaceId();
  const params = await searchParams;
  const itemsView = params.view === "mine" ? "mine" : "all";

  // Auth check
  const authResult = await getServerUser();
  if (!authResult) {
    redirect("/login");
  }
  const { supabase, user } = authResult;
  const userId = user.id;

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-neutral-500">No workspace selected</p>
        </div>
      </div>
    );
  }

  // When "mine" view: get task IDs where user is assignee; and user's team IDs for timeline filter
  let myTaskIds: string[] | null = null;
  let myTeamIds: string[] = [];
  if (itemsView === "mine") {
    const [assigneesRes, legacyRes, teamRes] = await Promise.all([
      supabase.from("task_assignees").select("task_id").eq("assignee_id", userId),
      supabase
        .from("task_items")
        .select("id")
        .eq("workspace_id", workspaceId)
        .not("assignee_id", "is", null)
        .eq("assignee_id", userId),
      supabase
        .from("workspace_team_members")
        .select("team_id")
        .eq("user_id", userId),
    ]);
    const ids = new Set<string>();
    assigneesRes.data?.forEach((r) => ids.add(r.task_id));
    legacyRes.data?.forEach((r) => ids.add(r.id));
    myTaskIds = Array.from(ids);
    myTeamIds = (teamRes.data?.map((r) => r.team_id) ?? []).filter(Boolean);
  }

  // Build task items query
  let taskQuery = supabase
    .from("task_items")
    .select(`
      id,
      title,
      due_date,
      due_time,
      due_time_end,
      priorities,
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

  if (itemsView === "mine" && myTaskIds) {
    if (myTaskIds.length === 0) {
      taskQuery = taskQuery.in("id", ["00000000-0000-0000-0000-000000000000"]); // Empty filter - no matches
    } else {
      taskQuery = taskQuery.in("id", myTaskIds);
    }
  }

  const { data: taskItems } = await taskQuery;

  // Fetch projects with due dates
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, due_date_date, due_date_text, workspace_id")
    .eq("workspace_id", workspaceId)
    .not("due_date_date", "is", null);

  // Fetch timeline events (with block -> tab -> project for context)
  const { data: timelineEventsRaw } = await supabase
    .from("timeline_events")
    .select(
      `
      id,
      title,
      start_date,
      end_date,
      priorities,
      assignee_id,
      assignee_team_id,
      timeline_block_id,
      blocks:timeline_block_id(id, tab_id, tabs(id, name, project_id, projects(id, name)))
    `
    )
    .eq("workspace_id", workspaceId)
    .not("start_date", "is", null);

  // Filter timeline events for "mine" view: assigned to user or to a team user is in
  const timelineEvents =
    itemsView === "mine" && timelineEventsRaw
      ? timelineEventsRaw.filter((ev: any) => {
          if (ev.assignee_id === userId) return true;
          if (ev.assignee_team_id && myTeamIds.includes(ev.assignee_team_id)) return true;
          return false;
        })
      : timelineEventsRaw ?? [];

  // Extract events from tasks
  const taskEvents: CalendarEvent[] = [];
  taskItems?.forEach((task: any) => {
    if (task.due_date) {
      const taskPriorities = Array.isArray(task.priorities) ? task.priorities : [];
      const firstPriority = taskPriorities[0]?.value ?? null;
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
        priority: firstPriority,
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

  // Map timeline events to calendar events (use start_date for the calendar day; optional time from ISO)
  const timelineEventsList: CalendarEvent[] = [];
  const toDateOnly = (s: string) => s.slice(0, 10);
  const toTimeOnly = (s: string) => (s.includes("T") && s.length >= 16 ? s.slice(11, 16) : undefined);
  timelineEvents.forEach((ev: any) => {
    if (!ev.start_date) return;
    const block = ev.blocks;
    const tab = block?.tabs;
    const project = tab?.projects;
    const date = toDateOnly(ev.start_date);
    const time = toTimeOnly(ev.start_date);
    const timeEnd = ev.end_date ? toTimeOnly(ev.end_date) : undefined;
    const priorities = Array.isArray(ev.priorities) ? ev.priorities : [];
    const firstPriority = priorities[0]?.value ?? null;
    timelineEventsList.push({
      id: `timeline-${ev.id}`,
      title: ev.title || "Untitled",
      date,
      time,
      timeEnd,
      type: "timeline",
      projectId: project?.id,
      tabId: tab?.id,
      timelineEventId: ev.id,
      blockId: ev.timeline_block_id,
      priority: firstPriority,
      projectName: project?.name ?? "Unknown",
      tabName: tab?.name ?? "Unknown",
    });
  });

  // In "mine" view: only tasks + timeline events (no projects); in "all" view: tasks + projects + timeline
  const allEvents =
    itemsView === "mine"
      ? [...taskEvents, ...timelineEventsList]
      : [...taskEvents, ...projectEvents, ...timelineEventsList];

  return (
    <CalendarView
      initialEvents={allEvents}
      workspaceId={workspaceId}
      itemsView={itemsView}
    />
  );
}
