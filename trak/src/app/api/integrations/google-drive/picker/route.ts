import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { DriveAuthError, searchDriveItems } from "@/lib/google-drive/client";
import { requireWorkspaceMember } from "@/lib/google-drive/assets";
import { getErrorMessage } from "@/lib/google-drive/errors";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get("workspace_id");
    if (!workspaceId) return NextResponse.json({ error: "Missing workspace_id" }, { status: 400 });

    await requireWorkspaceMember(workspaceId, user.id);

    const q = searchParams.get("q") || undefined;
    const parentId = searchParams.get("parentId") || undefined;
    const pageToken = searchParams.get("pageToken") || undefined;
    const foldersOnly = searchParams.get("foldersOnly") === "1";
    const sourceParam = searchParams.get("source");
    const source =
      sourceParam === "my_drive" || sourceParam === "shared_drives" ? sourceParam : "all";

    const data = await searchDriveItems({
      workspaceId,
      query: q,
      parentId,
      pageToken,
      foldersOnly,
      source,
    });

    return NextResponse.json(data);
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
