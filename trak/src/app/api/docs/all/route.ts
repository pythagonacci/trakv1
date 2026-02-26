import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const search = url.searchParams.get("search") || undefined;
  const isArchivedParam = url.searchParams.get("is_archived");
  const sortBy = url.searchParams.get("sort_by") || "updated_at";
  const sortOrder = url.searchParams.get("sort_order") || "desc";

  if (!workspaceId) {
    return NextResponse.json({ data: null, error: "Missing workspaceId" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return NextResponse.json({ data: null, error: "You don't have access to this workspace" }, { status: 403 });
    }

    let query = supabase
      .from("docs")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (isArchivedParam !== null) {
      query = query.eq("is_archived", isArchivedParam === "true");
    } else {
      query = query.eq("is_archived", false);
    }

    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error?.message || "Failed to fetch docs" }, { status: 500 });
  }
}
