import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const t0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;
  const url = new URL(request.url);
  const ids = url.searchParams.getAll("ids");
  const idsParam = url.searchParams.get("ids");
  const fileIdsRaw = ids.length > 0 ? ids : (idsParam ? idsParam.split(",") : []);
  const fileIds = fileIdsRaw.map((id) => id.trim()).filter(Boolean);

  if (fileIds.length === 0) {
    return NextResponse.json(
      { error: "Missing ids" },
      { status: 400 }
    );
  }

  const uniqueFileIds = Array.from(new Set(fileIds));
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data: files, error: filesError } = await supabase
    .from("files")
    .select("id, storage_path, workspace_id")
    .in("id", uniqueFileIds);

  if (filesError || !files || files.length === 0) {
    return NextResponse.json({ data: {} });
  }

  const workspaceId = files[0].workspace_id;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "No workspace access" },
      { status: 403 }
    );
  }

  const urlPromises = files.map(async (file) => {
    try {
      const { data: urlData, error: urlError } = await supabase.storage
        .from("files")
        .createSignedUrl(file.storage_path, 3600);

      if (urlError) {
        logger.error(`Failed to generate signed URL for file ${file.id}:`, urlError);
        return { fileId: file.id, url: null };
      }

      return {
        fileId: file.id,
        url: urlData?.signedUrl || null,
      };
    } catch (error) {
      logger.error(`Error generating signed URL for file ${file.id}:`, error);
      return { fileId: file.id, url: null };
    }
  });

  const urlResults = await Promise.all(urlPromises);

  const urlMap: Record<string, string> = {};
  urlResults.forEach((result) => {
    if (result.url) {
      urlMap[result.fileId] = result.url;
    }
  });

  if (process.env.PERF_DEBUG === "1") {
    console.log(
      `[PERF] route getBatchFileUrls ids=${uniqueFileIds.length} ms=${Math.round(Date.now() - t0)}`
    );
  }

  return NextResponse.json({ data: urlMap });
}
