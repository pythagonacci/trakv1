import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { getEntityAssets, removeAssetLink, requireEntityAccess } from "@/lib/google-drive/assets";
import { getErrorMessage } from "@/lib/google-drive/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const workspaceId = request.nextUrl.searchParams.get("workspace_id") || "";
    const entityType = request.nextUrl.searchParams.get("entity_type") || "";
    const entityId = request.nextUrl.searchParams.get("entity_id") || "";

    if (!workspaceId || !entityType || !entityId) {
      return NextResponse.json({ error: "Missing required params" }, { status: 400 });
    }

    await requireEntityAccess({ workspaceId, userId: user.id, entityType, entityId });
    const data = await getEntityAssets({ workspaceId, entityType, entityId });
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const workspaceId = String(body.workspaceId || "");
    const entityType = String(body.entityType || "");
    const entityId = String(body.entityId || "");
    const assetId = String(body.assetId || "");

    if (!workspaceId || !entityType || !entityId || !assetId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await requireEntityAccess({ workspaceId, userId: user.id, entityType, entityId });
    await removeAssetLink({ workspaceId, entityType, entityId, assetId });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, "Internal server error") }, { status: 500 });
  }
}
