import { NextRequest, NextResponse } from "next/server";
import { getAllProjects } from "@/app/actions/project";
import { getProjectTabs } from "@/app/actions/tab";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
    }

    const projectsResult = await getAllProjects(workspaceId);
    if (projectsResult.error) {
      return NextResponse.json({ error: projectsResult.error }, { status: 400 });
    }

    // Fetch tabs for each project
    const projectsWithTabs = await Promise.all(
      (projectsResult.data || []).map(async (project: any) => {
        const tabsResult = await getProjectTabs(project.id);
        return {
          ...project,
          tabs: tabsResult.data || [],
        };
      })
    );

    return NextResponse.json({ projects: projectsWithTabs });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

