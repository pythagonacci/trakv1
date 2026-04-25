import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";

type SidebarProject = {
  id: string;
  name: string;
  last_opened_at: string | null;
  pinned_at?: string | null;
};

type PinnedProjectRow = {
  pinned_at: string | null;
  project_id: string;
  projects: { id: string; name: string; last_opened_at: string | null } | { id: string; name: string; last_opened_at: string | null }[];
};

const relativeTime = (value: string | null) => {
  if (!value) return "";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(seconds);
  if (absSeconds < 60) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absSeconds < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (absSeconds < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
};

export async function GET(request: NextRequest) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: pinnedRows, error: pinnedError } = await supabase
    .from("user_pinned_projects")
    .select("pinned_at, project_id, projects!inner(id, name, last_opened_at, workspace_id, project_type)")
    .eq("user_id", user.id)
    .eq("projects.workspace_id", workspaceId)
    .eq("projects.project_type", "project")
    .order("pinned_at", { ascending: true });

  if (pinnedError) {
    return NextResponse.json({ error: pinnedError.message }, { status: 500 });
  }

  const pinnedProjects: SidebarProject[] = ((pinnedRows ?? []) as PinnedProjectRow[]).map((row) => {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    return {
      id: project.id,
      name: project.name,
      last_opened_at: project.last_opened_at ?? null,
      pinned_at: row.pinned_at ?? null,
    };
  });
  const pinnedProjectIds = new Set(pinnedProjects.map((project) => project.id));

  const { data: recentProjectRows, error: recentProjectsError } = await supabase
    .from("projects")
    .select("id, name, last_opened_at")
    .eq("workspace_id", workspaceId)
    .eq("project_type", "project")
    .not("last_opened_at", "is", null)
    .order("last_opened_at", { ascending: false })
    .limit(10);

  if (recentProjectsError) {
    return NextResponse.json({ error: recentProjectsError.message }, { status: 500 });
  }

  const recentProjects: SidebarProject[] = (recentProjectRows ?? [])
    .filter((project) => !pinnedProjectIds.has(project.id))
    .slice(0, 3);

  const { data: recentDocsRows, error: recentDocsError } = await supabase
    .from("docs")
    .select("id, title, last_opened_at")
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false)
    .not("last_opened_at", "is", null)
    .order("last_opened_at", { ascending: false })
    .limit(3);

  if (recentDocsError) {
    return NextResponse.json({ error: recentDocsError.message }, { status: 500 });
  }

  const { data: taskRows, error: taskError } =
    pinnedProjectIds.size === 0
      ? {
          data: [] as Array<{ project_id: string | null; statuses: Array<{ value?: string }> | null; status: string | null }>,
          error: null as PostgrestError | null,
        }
      : await supabase
          .from("task_items")
          .select("project_id, statuses, status")
          .eq("workspace_id", workspaceId)
          .eq("is_placeholder", false)
          .in("project_id", [...pinnedProjectIds]);

  if (taskError) {
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

  const doneStatuses = new Set(["done", "complete", "completed"]);
  const isDone = (task: { statuses: Array<{ value?: string }> | null; status: string | null }) => {
    const legacy = typeof task?.status === "string" ? task.status.toLowerCase() : "";
    if (doneStatuses.has(legacy)) return true;
    const statuses = Array.isArray(task?.statuses) ? task.statuses : [];
    return statuses.some((entry) => {
      const value = typeof entry?.value === "string" ? entry.value.toLowerCase() : "";
      return doneStatuses.has(value);
    });
  };

  const openTaskCountByProjectId: Record<string, number> = {};
  for (const task of taskRows ?? []) {
    if (!task.project_id || isDone(task)) continue;
    openTaskCountByProjectId[task.project_id] = (openTaskCountByProjectId[task.project_id] ?? 0) + 1;
  }

  return NextResponse.json({
    data: {
      pinnedProjects,
      recentProjects: recentProjects.map((project) => ({ ...project, relative_last_opened: relativeTime(project.last_opened_at) })),
      recentDocs: (recentDocsRows ?? []).map((doc) => ({
        id: doc.id,
        title: doc.title,
        last_opened_at: doc.last_opened_at,
        relative_last_opened: relativeTime(doc.last_opened_at),
      })),
      pinnedProjectsWithMeta: pinnedProjects.map((project) => ({ ...project, relative_last_opened: relativeTime(project.last_opened_at) })),
      openTaskCountByProjectId,
    },
  });
}
