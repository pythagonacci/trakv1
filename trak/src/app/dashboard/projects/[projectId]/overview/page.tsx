import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getProjectTabs } from "@/app/actions/tab";
import { requireWorkspaceAccess } from "@/lib/auth-utils";
import { buildProjectOverviewPath, isCanonicalReadableParam } from "@/lib/dashboard-routes";
import { resolveProjectIdFromParam } from "@/lib/dashboard-route-resolvers";
import { BlockComment } from "@/types/block-comment";
import { parseDateSafe } from "@/lib/due-date";
import ProjectOverview from "./project-overview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const supabase = await createClient();
  const { projectId: projectIdParam } = await params;

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect("/dashboard");

  const authResult = await requireWorkspaceAccess(workspaceId);
  if ("error" in authResult) redirect("/login");

  const projectId = await resolveProjectIdFromParam(supabase, workspaceId, projectIdParam);
  if (!projectId) notFound();

  // Fetch project (includes tags assigned to the project)
  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select(
      `id, name, status, due_date_date, due_date_text, priority, tags, client_page_enabled, client_comments_enabled, client_editing_enabled, public_token, client:clients(id, name, company)`
    )
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .single();

  if (projectError || !projectRow) notFound();

  const project = {
    ...projectRow,
    client: Array.isArray(projectRow.client) ? projectRow.client[0] : projectRow.client,
    tags: projectRow.tags ?? [],
  };

  if (!isCanonicalReadableParam(projectIdParam, project.name, project.id)) {
    redirect(buildProjectOverviewPath(project.id, project.name));
  }

  // All tab IDs for this project (flat)
  const { data: projectTabs, error: tabsError } = await supabase
    .from("tabs")
    .select("id, name")
    .eq("project_id", projectId);

  const hierarchicalTabsResult = await getProjectTabs(projectId);
  const hierarchicalTabs = hierarchicalTabsResult.data || [];

  if (tabsError || !projectTabs?.length) {
    return (
      <div className="w-full px-2 md:px-3 lg:px-4">
        <div className="max-w-7xl mx-auto pt-2 pb-1">
          <ProjectOverview
            projectId={projectId}
            projectName={project.name}
            tasksDueToday={[]}
            tasksDueSoon={[]}
            tasksOverdue={[]}
            teamFeedback={[]}
            openTasksCount={0}
          />
        </div>
      </div>
    );
  }

  const tabIds = projectTabs.map((t) => t.id);
  const tabNameById = Object.fromEntries(projectTabs.map((t) => [t.id, t.name]));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const soonEnd = new Date(todayStart);
  soonEnd.setDate(soonEnd.getDate() + 8); // next 7 days

  const [tasksResult, commentBlocksResult] = await Promise.allSettled([
    supabase
      .from("task_items")
      .select(
        `
        id,
        title,
        statuses,
        priorities,
        due_date,
        due_time,
        task_block_id,
        tab_id,
        tab:tabs(id, name)
      `
      )
      .in("tab_id", tabIds)
      .eq("workspace_id", workspaceId)
      .eq("is_placeholder", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("blocks")
      .select(`
        id,
        content,
        updated_at,
        tab_id,
        tabs(id, name)
      `)
      .in("tab_id", tabIds)
      .not("content->>_blockComments", "is", null)
      .order("updated_at", { ascending: false })
      .limit(80),
  ]);

  const taskItems =
    tasksResult.status === "fulfilled" && !tasksResult.value.error
      ? tasksResult.value.data || []
      : [];
  const commentBlocks =
    commentBlocksResult.status === "fulfilled" && !commentBlocksResult.value.error
      ? commentBlocksResult.value.data || []
      : [];

  const doneStatuses = new Set(["done", "complete", "completed"]);
  const isTaskDone = (t: any): boolean => {
    const statuses = Array.isArray(t?.statuses) ? t.statuses : [];
    for (const entry of statuses) {
      const value =
        typeof entry?.value === "string" ? entry.value.toLowerCase() : "";
      if (doneStatuses.has(value)) return true;
    }
    return false;
  };
  const firstStatusFromStatuses = (statuses: unknown): string =>
    (Array.isArray(statuses) && statuses[0]?.value != null
      ? String((statuses[0] as any).value)
      : "todo") as string;

  const openTasks = taskItems
    .filter((t: any) => !isTaskDone(t))
    .map((t: any) => {
      const taskPriorities = Array.isArray(t.priorities) ? t.priorities : [];
      const firstPriority = taskPriorities[0]?.value ?? null;
      return {
        id: `${t.task_block_id}-${t.id}`,
        text: t.title,
        tabName: t.tab?.name ?? tabNameById[t.tab_id] ?? "Unknown",
        tabId: t.tab_id,
        priority: firstPriority,
        dueDate: t.due_date,
        dueTime: t.due_time,
        status: firstStatusFromStatuses(t.statuses),
      };
    });

  const tasksDueToday: typeof openTasks = [];
  const tasksDueSoon: typeof openTasks = [];
  const tasksOverdue: typeof openTasks = [];

  for (const task of openTasks) {
    if (!task.dueDate) continue;
    const d = parseDateSafe(task.dueDate);
    if (!d) continue;
    d.setHours(0, 0, 0, 0);
    if (d.getTime() < todayStart.getTime()) {
      tasksOverdue.push(task);
    } else if (d.getTime() < todayEnd.getTime()) {
      tasksDueToday.push(task);
    } else if (d.getTime() < soonEnd.getTime()) {
      tasksDueSoon.push(task);
    }
  }

  const teamFeedback = commentBlocks.flatMap((block: any) => {
    const comments: BlockComment[] = Array.isArray(block.content?._blockComments)
      ? block.content._blockComments
      : [];
    return comments
      .filter((c) => c && c.source !== "external")
      .map((c) => ({
        id: c.id ?? `${block.id}-${c.timestamp}`,
        text: c.text,
        author: c.author_name || c.author_email?.split("@")[0] || "Team",
        tabName: block.tabs?.name ?? tabNameById[block.tab_id] ?? "Untitled tab",
        tabId: block.tab_id,
        blockId: block.id,
        timestamp: c.timestamp,
      }));
  }).sort((a, b) => {
    const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bt - at;
  }).slice(0, 15);

  return (
    <div className="w-full px-2 md:px-3 lg:px-4">
      <div className="py-3 md:py-4 lg:py-5">
        <ProjectOverview
          projectId={projectId}
          projectName={project.name}
          tasksDueToday={tasksDueToday}
          tasksDueSoon={tasksDueSoon.slice(0, 10)}
          tasksOverdue={tasksOverdue.slice(0, 15)}
          teamFeedback={teamFeedback}
          openTasksCount={openTasks.length}
        />
      </div>
    </div>
  );
}
