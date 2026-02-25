import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const CURRENT_WORKSPACE_COOKIE = "trak_current_workspace";

export async function GET(_request: NextRequest) {
  const t0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;

  try {
    const cookieStore = await cookies();
    const value = cookieStore.get(CURRENT_WORKSPACE_COOKIE)?.value || null;

    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getCurrentWorkspaceId hasValue=${Boolean(value)} ms=${Math.round(Date.now() - t0)}`);
    }

    return NextResponse.json({ data: { workspaceId: value } });
  } catch (error) {
    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getCurrentWorkspaceId error ms=${Math.round(Date.now() - t0)}`);
    }
    return NextResponse.json({ data: { workspaceId: null } }, { status: 200 });
  }
}
