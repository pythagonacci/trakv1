import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser, getProjectMetadata } from "@/lib/auth-utils";
import type { Tab, TabWithChildren } from "@/app/actions/tab";

export const dynamic = "force-dynamic";

const TABS_PER_PROJECT_LIMIT = 1000;

export async function GET(request: NextRequest) {
  const t0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) {
      if (process.env.PERF_DEBUG === "1") {
        console.log(`[PERF] route getProjectTabs projectId=${projectId} error=Unauthorized ms=${Math.round(Date.now() - t0)}`);
      }
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const project = await getProjectMetadata(projectId);
    if (!project) {
      if (process.env.PERF_DEBUG === "1") {
        console.log(`[PERF] route getProjectTabs projectId=${projectId} error=ProjectNotFound ms=${Math.round(Date.now() - t0)}`);
      }
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const member = await checkWorkspaceMembership(project.workspace_id, user.id);
    if (!member) {
      if (process.env.PERF_DEBUG === "1") {
        console.log(`[PERF] route getProjectTabs projectId=${projectId} error=NotMember ms=${Math.round(Date.now() - t0)}`);
      }
      return NextResponse.json(
        { error: "Not a member of this workspace" },
        { status: 403 }
      );
    }

    const { data: tabs, error: tabsError } = await supabase
      .from("tabs")
      .select("id, project_id, parent_tab_id, name, position, is_client_visible, client_title, created_at, is_workflow_page")
      .eq("project_id", projectId)
      .order("position", { ascending: true })
      .limit(TABS_PER_PROJECT_LIMIT);

    if (tabsError) {
      console.error("Get tabs error:", tabsError);
      if (process.env.PERF_DEBUG === "1") {
        console.log(`[PERF] route getProjectTabs projectId=${projectId} error=Query ms=${Math.round(Date.now() - t0)}`);
      }
      return NextResponse.json(
        { error: "Failed to fetch tabs" },
        { status: 500 }
      );
    }

    const tabsWithChildren = buildTabHierarchy(tabs || []);
    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getProjectTabs projectId=${projectId} tabs=${tabsWithChildren.length} totalMs=${Math.round(Date.now() - t0)}`);
    }
    return NextResponse.json({ data: tabsWithChildren });
  } catch (error) {
    console.error("Get project tabs exception:", error);
    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getProjectTabs projectId=${projectId} error=Exception ms=${Math.round(Date.now() - t0)}`);
    }
    return NextResponse.json(
      { error: "Failed to fetch tabs" },
      { status: 500 }
    );
  }
}

function buildTabHierarchy(tabs: Tab[]): TabWithChildren[] {
  const tabMap = new Map<string, TabWithChildren>();
  const rootTabs: TabWithChildren[] = [];

  tabs.forEach((tab) => {
    tabMap.set(tab.id, { ...tab, children: [] });
  });

  tabs.forEach((tab) => {
    const tabWithChildren = tabMap.get(tab.id)!;
    if (tab.parent_tab_id === null) {
      rootTabs.push(tabWithChildren);
    } else {
      const parent = tabMap.get(tab.parent_tab_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(tabWithChildren);
      } else {
        rootTabs.push(tabWithChildren);
      }
    }
  });

  return rootTabs;
}
