import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { decodeReadableEntityParam, slugifyUrlSegment } from "@/lib/dashboard-routes";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function normalizeEntityId(entityId: string): string {
  return entityId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveEntityIdFromCandidates<T extends { id: string; name: string | null }>(
  param: string,
  candidates: T[] | null | undefined
): string | null {
  const { slug, shortId } = decodeReadableEntityParam(param);
  const records = candidates ?? [];

  if (shortId) {
    const shortIdMatches = records.filter((candidate) =>
      normalizeEntityId(candidate.id).startsWith(shortId)
    );

    if (shortIdMatches.length === 1) {
      return shortIdMatches[0]?.id ?? null;
    }

    if (shortIdMatches.length > 1) {
      const slugMatch = shortIdMatches.find((candidate) => slugifyUrlSegment(candidate.name ?? "") === slug);
      return slugMatch?.id ?? null;
    }

    return null;
  }

  const targetSlug = slugifyUrlSegment(slug);
  const match = records.find((candidate) => slugifyUrlSegment(candidate.name ?? "") === targetSlug);
  return match?.id ?? null;
}

/**
 * Resolve project ID from a readable URL param using a targeted query.
 * When the URL contains a short ID (e.g. "my-project~a1b2c3d4"), we query
 * with a prefix filter instead of fetching all projects in the workspace.
 * Wrapped in React cache() to deduplicate across layout + page in the same request.
 */
export const resolveProjectIdFromParam = cache(async (
  supabase: ServerSupabaseClient,
  workspaceId: string,
  projectParam: string
): Promise<string | null> => {
  const { slug, shortId } = decodeReadableEntityParam(projectParam);

  if (shortId) {
    const { data: candidates } = await supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .ilike("id", `${shortId}%`)
      .limit(10);

    return resolveEntityIdFromCandidates(projectParam, candidates);
  }

  const { data: candidates } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .limit(2000);

  return resolveEntityIdFromCandidates(projectParam, candidates);
});

/**
 * Resolve tab ID from a readable URL param using a targeted query.
 * Same optimization as resolveProjectIdFromParam.
 * Wrapped in React cache() to deduplicate across layout + page in the same request.
 */
export const resolveTabIdFromParam = cache(async (
  supabase: ServerSupabaseClient,
  projectId: string,
  tabParam: string
): Promise<string | null> => {
  const { slug, shortId } = decodeReadableEntityParam(tabParam);

  if (shortId) {
    const { data: candidates } = await supabase
      .from("tabs")
      .select("id, name")
      .eq("project_id", projectId)
      .ilike("id", `${shortId}%`)
      .limit(10);

    return resolveEntityIdFromCandidates(tabParam, candidates);
  }

  const { data: candidates } = await supabase
    .from("tabs")
    .select("id, name")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .limit(2000);

  return resolveEntityIdFromCandidates(tabParam, candidates);
});
