import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { DriveAuthError, listDriveFolderContents } from "@/lib/google-drive/client";
import { getProjectDriveFolder, requireProjectAccess, upsertExternalAssets } from "@/lib/google-drive/assets";
import { getErrorMessage } from "@/lib/google-drive/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId } = await params;
    const project = await requireProjectAccess(projectId, user.id);
    const searchParams = request.nextUrl.searchParams;

    let folderId = searchParams.get("folderId") || undefined;
    const pageToken = searchParams.get("pageToken") || undefined;

    if (!folderId) {
      const mapping = await getProjectDriveFolder(projectId);
      const mappedAsset = Array.isArray(mapping?.asset) ? mapping?.asset?.[0] : mapping?.asset;
      folderId = mappedAsset?.provider_item_id;
    }

    if (!folderId) {
      return NextResponse.json({ data: [], nextPageToken: null, mappedFolderMissing: true });
    }

    const result = await listDriveFolderContents(project.workspace_id, folderId, pageToken);

    const assets = await upsertExternalAssets({
      workspaceId: project.workspace_id,
      userId: user.id,
      assets: result.files,
    });

    return NextResponse.json({
      data: assets,
      nextPageToken: result.nextPageToken || null,
      mappedFolderMissing: false,
    });
  } catch (error: unknown) {
    if (error instanceof DriveAuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "connection_missing" ? 404 : 428 }
      );
    }

    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}
