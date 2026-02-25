import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ data: null, error: "Missing workspaceId" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("blocks")
      .select(`
        *,
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
      .eq("is_template", true)
      .eq("tab.project.workspace_id", workspaceId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error?.message || "Failed to fetch template blocks" }, { status: 500 });
  }
}
