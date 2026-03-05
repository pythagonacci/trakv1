import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { DriveAuthError, fetchDriveItemsByIds } from "@/lib/google-drive/client";
import {
  linkAssetsToEntity,
  logDriveAuditEvent,
  requireEntityAccess,
  upsertExternalAssets,
} from "@/lib/google-drive/assets";
import { getErrorMessage } from "@/lib/google-drive/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body.workspaceId || "");
    const entityType = String(body.entityType || "");
    const entityId = String(body.entityId || "");
    const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map(String).filter(Boolean) : [];

    if (!workspaceId || !entityType || !entityId || itemIds.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await requireEntityAccess({ workspaceId, userId: user.id, entityType, entityId });

    const metadata = await fetchDriveItemsByIds(workspaceId, itemIds);
    const assets = await upsertExternalAssets({ workspaceId, userId: user.id, assets: metadata });
    const links = await linkAssetsToEntity({
      workspaceId,
      userId: user.id,
      entityType,
      entityId,
      assetIds: assets.map((asset) => asset.id),
    });

    await logDriveAuditEvent({
      workspaceId,
      userId: user.id,
      eventType: "asset_linked",
      metadata: { entityType, entityId, itemCount: itemIds.length },
    });

    return NextResponse.json({ assets, links });
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
