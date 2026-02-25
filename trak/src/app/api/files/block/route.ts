import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const blockId = url.searchParams.get("blockId");

  if (!blockId) {
    return NextResponse.json({ error: "Missing blockId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: files, error } = await supabase
    .from("file_attachments")
    .select(
      `
      id,
      display_mode,
      file:files (
        id,
        file_name,
        file_size,
        file_type,
        storage_path,
        created_at
      )
    `
    )
    .eq("block_id", blockId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: files || [] });
}
