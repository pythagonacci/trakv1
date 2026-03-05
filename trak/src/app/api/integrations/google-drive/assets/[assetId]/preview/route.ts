import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { createServiceClient } from "@/lib/supabase/service";
import { requireWorkspaceMember } from "@/lib/google-drive/assets";
import { getErrorMessage } from "@/lib/google-drive/errors";

function inferPreviewUrl(item: {
  provider_item_id: string;
  mime_type: string | null;
  web_view_link: string | null;
}) {
  const fileId = item.provider_item_id;
  const mimeType = item.mime_type || "";

  if (mimeType === "application/vnd.google-apps.document") {
    return `https://docs.google.com/document/d/${fileId}/preview`;
  }
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
  }
  if (mimeType === "application/vnd.google-apps.presentation") {
    return `https://docs.google.com/presentation/d/${fileId}/preview`;
  }
  if (mimeType === "application/vnd.google-apps.folder") {
    return item.web_view_link;
  }
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { assetId } = await params;
    const workspaceId = request.nextUrl.searchParams.get("workspace_id");
    if (!workspaceId) return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });

    await requireWorkspaceMember(workspaceId, user.id);

    const supabase = await createServiceClient();
    const { data: asset, error } = await supabase
      .from("external_assets")
      .select("id, workspace_id, provider_item_id, mime_type, web_view_link, web_content_link, stale_state")
      .eq("id", assetId)
      .eq("workspace_id", workspaceId)
      .eq("provider", "google_drive")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    if (asset.stale_state === "not_found" || asset.stale_state === "trashed") {
      return NextResponse.json({
        state: asset.stale_state,
        previewUrl: null,
        openInDriveUrl: asset.web_view_link,
      });
    }

    return NextResponse.json({
      state: "ok",
      previewUrl: inferPreviewUrl(asset),
      openInDriveUrl: asset.web_view_link,
      webContentLink: asset.web_content_link,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}
