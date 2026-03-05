import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { DriveAuthError, createDriveFolder, fetchDriveItemsByIds } from "@/lib/google-drive/client";
import {
  getProjectDriveFolder,
  linkAssetsToEntity,
  logDriveAuditEvent,
  requireProjectAccess,
  setProjectDriveFolder,
  upsertExternalAssets,
} from "@/lib/google-drive/assets";
import { getErrorMessage } from "@/lib/google-drive/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId } = await params;
    await requireProjectAccess(projectId, user.id);

    const mapping = await getProjectDriveFolder(projectId);
    return NextResponse.json({ data: mapping || null });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId } = await params;
    const body = await request.json();

    const workspaceId = String(body.workspaceId || "");
    const action = String(body.action || "attach_existing");
    const folderId = body.folderId ? String(body.folderId) : undefined;
    const parentFolderId = body.parentFolderId ? String(body.parentFolderId) : undefined;
    const projectName = String(body.projectName || "Project");

    const project = await requireProjectAccess(projectId, user.id);
    if (project.workspace_id !== workspaceId) {
      return NextResponse.json({ error: "Workspace mismatch" }, { status: 400 });
    }

    let folderMetadata;

    if (action === "create_new") {
      folderMetadata = await createDriveFolder({
        workspaceId,
        name: body.name ? String(body.name) : projectName,
        parentId: parentFolderId,
      });
    } else {
      if (!folderId) {
        return NextResponse.json({ error: "Missing folderId" }, { status: 400 });
      }
      const [single] = await fetchDriveItemsByIds(workspaceId, [folderId]);
      folderMetadata = single;
    }

    if (folderMetadata.itemKind !== "folder") {
      return NextResponse.json({ error: "Selected item is not a folder" }, { status: 400 });
    }

    const [folderAsset] = await upsertExternalAssets({
      workspaceId,
      userId: user.id,
      assets: [folderMetadata],
    });

    const mapping = await setProjectDriveFolder({
      workspaceId,
      projectId,
      userId: user.id,
      driveFolderAssetId: folderAsset.id,
    });

    await linkAssetsToEntity({
      workspaceId,
      userId: user.id,
      entityType: "project",
      entityId: projectId,
      assetIds: [folderAsset.id],
    });

    await logDriveAuditEvent({
      workspaceId,
      userId: user.id,
      eventType: "project_folder_mapped",
      metadata: {
        projectId,
        folderId: folderMetadata.providerItemId,
        action,
      },
    });

    return NextResponse.json({ data: { mapping, folderAsset } });
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
