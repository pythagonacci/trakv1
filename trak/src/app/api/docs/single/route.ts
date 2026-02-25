import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const docId = url.searchParams.get("docId");

  if (!docId) {
    return NextResponse.json({ data: null, error: "Missing docId" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { data: doc, error } = await supabase
      .from("docs")
      .select("*")
      .eq("id", docId)
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    if (!doc) {
      return NextResponse.json({ data: null, error: "Document not found" }, { status: 404 });
    }

    const { data: membership, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", doc.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return NextResponse.json({ data: null, error: "You don't have access to this document" }, { status: 403 });
    }

    return NextResponse.json({ data: doc, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error?.message || "Failed to fetch doc" }, { status: 500 });
  }
}
