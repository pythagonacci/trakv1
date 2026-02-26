import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const blockId = url.searchParams.get("blockId");

  if (!blockId) {
    return NextResponse.json({ data: null, error: "Missing blockId" }, { status: 400 });
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
          project_id,
          project:projects!tabs_project_id_fkey(
            id,
            name,
            project_type
          )
        )
      `)
      .eq("id", blockId)
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error?.message || "Failed to fetch block" }, { status: 500 });
  }
}
