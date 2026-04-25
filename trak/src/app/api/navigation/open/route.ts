import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type OpenEntityType = "project" | "doc";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json().catch(() => null);
  const entityType = body?.entityType as OpenEntityType | undefined;
  const entityId = body?.entityId as string | undefined;

  if (!entityType || !entityId || !["project", "doc"].includes(entityType)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const table = entityType === "project" ? "projects" : "docs";

  const { data: row, error: rowError } = await supabase
    .from(table)
    .select("id, workspace_id")
    .eq("id", entityId)
    .maybeSingle();

  if (rowError || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", row.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from(table)
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", entityId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to track open" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
