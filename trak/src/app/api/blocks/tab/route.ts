import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, getTabMetadata, checkWorkspaceMembership } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

const BLOCKS_PER_TAB_LIMIT = 500;

export async function GET(request: NextRequest) {
  const t0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;
  const url = new URL(request.url);
  const tabId = url.searchParams.get("tabId");

  if (!tabId) {
    return NextResponse.json(
      { error: "Missing tabId" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) {
      if (process.env.PERF_DEBUG === "1") {
        console.log(`[PERF] route getTabBlocks tabId=${tabId} error=Unauthorized ms=${Math.round(Date.now() - t0)}`);
      }
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const tAuth0 = Date.now();
    const tab = await getTabMetadata(tabId);
    if (!tab) {
      if (process.env.PERF_DEBUG === "1") {
        console.log(`[PERF] route getTabBlocks tabId=${tabId} error=TabNotFound ms=${Math.round(Date.now() - t0)}`);
      }
      return NextResponse.json(
        { error: "Tab not found" },
        { status: 404 }
      );
    }

    const workspaceId = (tab.projects as any).workspace_id;
    const member = await checkWorkspaceMembership(workspaceId, user.id);
    if (!member) {
      if (process.env.PERF_DEBUG === "1") {
        console.log(`[PERF] route getTabBlocks tabId=${tabId} error=NotMember ms=${Math.round(Date.now() - t0)}`);
      }
      return NextResponse.json(
        { error: "Not a member of this workspace" },
        { status: 403 }
      );
    }
    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getTabBlocks auth ms=${Math.round(Date.now() - tAuth0)}`);
    }

    const tQuery0 = Date.now();
    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select("id, tab_id, parent_block_id, type, content, position, column, is_template, template_name, original_block_id, created_at, updated_at")
      .eq("tab_id", tabId)
      .is("parent_block_id", null)
      .order("column", { ascending: true })
      .order("position", { ascending: true })
      .limit(BLOCKS_PER_TAB_LIMIT);

    if (blocksError) {
      console.error("Get blocks error:", blocksError);
      if (process.env.PERF_DEBUG === "1") {
        console.log(`[PERF] route getTabBlocks tabId=${tabId} error=Query ms=${Math.round(Date.now() - t0)}`);
      }
      return NextResponse.json(
        { error: "Failed to fetch blocks" },
        { status: 500 }
      );
    }

    const blockCount = (blocks || []).length;
    const payloadBytes = Buffer.byteLength(JSON.stringify(blocks ?? []), "utf8");
    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getTabBlocks query ms=${Math.round(Date.now() - tQuery0)} blocks=${blockCount} payloadBytes=${payloadBytes} totalMs=${Math.round(Date.now() - t0)}`);
    }

    return NextResponse.json({ data: blocks || [] });
  } catch (error) {
    console.error("Get tab blocks exception:", error);
    if (process.env.PERF_DEBUG === "1") {
      console.log(`[PERF] route getTabBlocks tabId=${tabId} error=Exception ms=${Math.round(Date.now() - t0)}`);
    }
    return NextResponse.json(
      { error: "Failed to fetch blocks" },
      { status: 500 }
    );
  }
}
