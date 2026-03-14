import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { isUnauthorizedApiError, requireUser } from "@/lib/auth/require-user";
import { resolveRouteContextFromPathname } from "@/lib/route-context";

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireUser();
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: "No workspace selected" }, { status: 400 });
    }

    const pathname = request.nextUrl.searchParams.get("pathname")?.trim();
    if (!pathname) {
      return NextResponse.json({ error: "Missing pathname" }, { status: 400 });
    }

    const resolved = await resolveRouteContextFromPathname({
      supabase,
      workspaceId,
      pathname,
    });

    return NextResponse.json(resolved);
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[route-context] Failed to resolve route context", error);
    return NextResponse.json({ error: "Failed to resolve route context" }, { status: 500 });
  }
}
