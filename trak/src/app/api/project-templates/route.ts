import { NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getAvailableProjectTemplates } from "@/app/actions/project-templates";

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
  }

  const result = await getAvailableProjectTemplates(workspaceId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ data: result.data });
}
