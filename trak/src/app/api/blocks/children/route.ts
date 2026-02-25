import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parentBlockId = url.searchParams.get("parentBlockId");

  if (!parentBlockId) {
    return NextResponse.json({ error: "Missing parentBlockId" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: parentBlock, error: parentError } = await supabase
      .from("blocks")
      .select("id, tab_id, tabs!inner(id, project_id, projects!inner(workspace_id))")
      .eq("id", parentBlockId)
      .single();

    if (parentError || !parentBlock) {
      return NextResponse.json({ error: "Parent block not found" }, { status: 404 });
    }

    const workspaceId = (parentBlock.tabs as any)?.projects?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: "Invalid block structure" }, { status: 400 });
    }

    const membership = await checkWorkspaceMembership(workspaceId, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select("id, tab_id, parent_block_id, type, content, position, column, is_template, template_name, original_block_id, created_at, updated_at")
      .eq("parent_block_id", parentBlockId)
      .order("column", { ascending: true })
      .order("position", { ascending: true });

    if (blocksError) {
      return NextResponse.json({ error: "Failed to fetch child blocks" }, { status: 500 });
    }

    return NextResponse.json({ data: blocks || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch child blocks" }, { status: 500 });
  }
}
