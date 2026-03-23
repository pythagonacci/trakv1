import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const blockId = url.searchParams.get("blockId");
  const publicToken = url.searchParams.get("publicToken");

  if (!blockId || !publicToken) {
    return NextResponse.json(
      { error: "Missing blockId or publicToken" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, tab_id, type")
    .eq("id", blockId)
    .single();

  if (blockError || !block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  const { data: tab, error: tabError } = await supabase
    .from("tabs")
    .select("id, project_id, is_client_visible")
    .eq("id", block.tab_id)
    .single();

  if (tabError || !tab || !tab.is_client_visible) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, workspace_id, public_token, client_page_enabled")
    .eq("id", tab.project_id)
    .single();

  if (
    projectError ||
    !project ||
    !project.client_page_enabled ||
    project.public_token !== publicToken
  ) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const { data: attachments, error: attachmentsError } = await supabase
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

  if (attachmentsError) {
    return NextResponse.json(
      { error: attachmentsError.message },
      { status: 500 }
    );
  }

  const normalizedAttachments = (attachments || []).map((attachment) => {
    const file = "file" in attachment ? attachment.file : null;
    return {
      ...attachment,
      file: Array.isArray(file) ? file[0] : file,
    };
  });

  const urlPairs = await Promise.all(
    normalizedAttachments.map(async (attachment) => {
      const file = attachment.file;
      if (!file?.id || !file.storage_path) {
        return null;
      }

      const { data: signedUrl } = await supabase.storage
        .from("files")
        .createSignedUrl(file.storage_path, 3600);

      return signedUrl?.signedUrl
        ? [file.id, signedUrl.signedUrl]
        : null;
    })
  );

  const urls = Object.fromEntries(
    urlPairs.filter((entry): entry is [string, string] => Boolean(entry))
  );

  return NextResponse.json({
    data: normalizedAttachments,
    urls,
  });
}
