import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, getTabMetadata, checkWorkspaceMembership } from "@/lib/auth-utils";

const BLOCKS_PER_TAB_LIMIT = 500;

export async function GET(
  req: Request,
  { params }: { params: { tabId: string } }
) {
  const tabId = params.tabId;
  const _t0 = process.env.PERF_DEBUG === "1" ? performance.now() : 0;

  try {
    const supabase = await createClient();
    const user = await getAuthenticatedUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    const _tAuth0 = process.env.PERF_DEBUG === "1" ? performance.now() : 0;
    const tab = await getTabMetadata(tabId);

    if (!tab) {
      return Response.json({ error: "Tab not found" }, { status: 500 });
    }

    const workspaceId = (tab.projects as any).workspace_id;

    const member = await checkWorkspaceMembership(workspaceId, userId);
    if (!member) {
      return Response.json(
        { error: "Not a member of this workspace" },
        { status: 401 }
      );
    }

    if (process.env.PERF_DEBUG === "1") {
      console.log(
        `[PERF] getTabBlocks auth ms=${Math.round(
          performance.now() - _tAuth0
        )}`
      );
    }

    const _tQuery0 = process.env.PERF_DEBUG === "1" ? performance.now() : 0;
    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select(
        "id, tab_id, parent_block_id, type, content, position, column, is_template, template_name, original_block_id, created_at, updated_at"
      )
      .eq("tab_id", tabId)
      .is("parent_block_id", null)
      .order("column", { ascending: true })
      .order("position", { ascending: true })
      .limit(BLOCKS_PER_TAB_LIMIT);

    if (blocksError) {
      console.error("Get blocks error:", blocksError);
      return Response.json({ error: "Failed to fetch blocks" }, { status: 500 });
    }

    if (process.env.PERF_DEBUG === "1") {
      const blockCount = (blocks || []).length;
      const payloadBytes = Buffer.byteLength(
        JSON.stringify(blocks ?? []),
        "utf8"
      );
      console.log(
        `[PERF] getTabBlocks query ms=${Math.round(
          performance.now() - _tQuery0
        )} blocks=${blockCount} payloadBytes=${payloadBytes} totalMs=${Math.round(
          performance.now() - _t0
        )}`
      );
    }

    return Response.json({ data: blocks || [] }, { status: 200 });
  } catch (error) {
    console.error("Get tab blocks exception:", error);
    return Response.json({ error: "Failed to fetch blocks" }, { status: 500 });
  }
}

