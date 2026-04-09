import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";
import { buildEntityPropertiesFromRows } from "@/app/actions/entity-properties";
import type { EntityProperties, EntityType } from "@/types/properties";
import { formatPerfContext, getPerfRequestContext } from "@/lib/perf/perf-trace";

export const dynamic = "force-dynamic";

function isQueryableEntityId(id: string): boolean {
  if (!id) return false;
  if (id.startsWith("optimistic-")) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(request: NextRequest) {
  try {
    const perfContext = getPerfRequestContext(request);
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entityType") as EntityType | null;
    const idsParam = url.searchParams.get("ids");
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;

    if (!entityType || !idsParam) {
      return NextResponse.json(
        { error: "Missing entityType or ids" },
        { status: 400 }
      );
    }

    const entityIds = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => isQueryableEntityId(id));

    if (entityIds.length === 0) {
      return NextResponse.json({ data: {} });
    }

    const t0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;
    const tAuth0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;
    const supabase = await createClient();

    if (workspaceId) {
      const user = await getAuthenticatedUser();
      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const membership = await checkWorkspaceMembership(workspaceId, user.id);
      if (!membership) {
        return NextResponse.json(
          { error: "Not a member of this workspace" },
          { status: 403 }
        );
      }
    }
    const tQuery0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;

    let query = supabase
      .from("entity_properties")
      .select(
        "id, entity_type, entity_id, workspace_id, field_name, field_type, value, created_at, updated_at"
      )
      .eq("entity_type", entityType)
      .in("entity_id", entityIds);

    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("getEntitiesProperties route error:", error);
      return NextResponse.json(
        { error: "Failed to fetch entity properties" },
        { status: 500 }
      );
    }

    const rowsById: Record<string, any[]> = {};
    for (const id of entityIds) {
      rowsById[id] = [];
    }

    for (const row of data ?? []) {
      const key = String((row as any).entity_id);
      const list = rowsById[key] ?? [];
      list.push(row);
      rowsById[key] = list;
    }

    const tBuild0 = process.env.PERF_DEBUG === "1" ? Date.now() : 0;
    const result: Record<string, EntityProperties> = {};
    for (const [id, rows] of Object.entries(rowsById)) {
      if (rows.length === 0) continue;
      const buildWorkspaceId =
        workspaceId ?? String((rows[0] as any).workspace_id ?? "");
      result[id] = await buildEntityPropertiesFromRows(
        entityType,
        id,
        buildWorkspaceId,
        rows
      );
    }

    if (process.env.PERF_DEBUG === "1") {
      const totalMs = Math.round(Date.now() - t0);
      const authMs = workspaceId ? Math.round(tQuery0 - tAuth0) : 0;
      const queryMs = Math.round(tBuild0 - tQuery0);
      const buildMs = Math.round(Date.now() - tBuild0);
      const payloadBytes = Buffer.byteLength(JSON.stringify(result), "utf8");
      console.log(
        `[PERF] route getEntitiesProperties type=${entityType} ids=${entityIds.length} rows=${data?.length ?? 0} authMs=${authMs} queryMs=${queryMs} buildMs=${buildMs} payloadBytes=${payloadBytes} totalMs=${totalMs}${formatPerfContext(perfContext)}`
      );
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error in entities properties route:", error);
    return NextResponse.json(
      { error: "Failed to fetch entity properties" },
      { status: 500 }
    );
  }
}
