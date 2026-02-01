
import { NextRequest, NextResponse } from "next/server";
import { searchProjects, resolveEntityByName } from "@/app/actions/ai-search";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";

export async function GET(request: NextRequest) {
    const workspaceId = await getCurrentWorkspaceId();

    const searchResult = await searchProjects({ searchText: "Byblos" });
    const resolveResult = await resolveEntityByName({ entityType: "project", name: "Byblos" });
    const allProjects = await searchProjects({ limit: 100 });

    return NextResponse.json({
        workspaceId,
        searchResult,
        resolveResult,
        allProjectsSummary: allProjects.data?.map(p => p.name)
    });
}
