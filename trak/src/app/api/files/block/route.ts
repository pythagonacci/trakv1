import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatPerfContext, getPerfRequestContext } from "@/lib/perf/perf-trace";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const t0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;
  const perfContext = getPerfRequestContext(request);
  const url = new URL(request.url);
  const blockId = url.searchParams.get("blockId");

  if (!blockId) {
    return NextResponse.json({ error: "Missing blockId" }, { status: 400 });
  }

  const supabase = await createClient();
  const tQuery0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;
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

  if (process.env.PERF_DEBUG === "1") {
    const payloadBytes = Buffer.byteLength(JSON.stringify(files ?? []), "utf8");
    console.log(
      `[PERF] route getBlockFiles blockId=${blockId} attachments=${files?.length ?? 0} queryMs=${Math.round(Date.now() - tQuery0)} payloadBytes=${payloadBytes} totalMs=${Math.round(Date.now() - t0)}${formatPerfContext(perfContext)}`
    );
  }

  return NextResponse.json({ data: files || [] });
}
