import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { decodeReadableEntityParam, slugifyUrlSegment } from "@/lib/dashboard-routes";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function normalizeEntityId(entityId: string): string {
  return entityId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Canonical v4 UUID as produced by gen_random_uuid(). Project/tab ids are stored
// as Postgres `uuid`, so only strings that parse as a UUID are valid for a
// direct `eq("id", …)` lookup. Anything else triggers a Postgres
// "invalid input syntax for type uuid" error when used in an equality filter.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeDirectEntityId(param: string): boolean {
  // Support legacy links that still use raw UUIDs in the route. Readable params
  // always include "~" (or legacy "--"), so anything containing those is
  // definitely not a direct id.
  const trimmed = param.trim();
  if (!trimmed) return false;
  if (trimmed.includes("~") || trimmed.includes("--")) return false;
  return UUID_PATTERN.test(trimmed);
}

// Build a UUID range that covers every uuid whose first hex group (8 chars)
// matches the given short id. Lets us use the native uuid index for prefix
// lookups without casting to text (which can't use the index).
function shortIdToUuidRange(shortId: string): { lower: string; upper: string } | null {
  if (!/^[0-9a-f]{8}$/i.test(shortId)) return null;
  const lower = `${shortId.toLowerCase()}-0000-0000-0000-000000000000`;
  const upper = `${shortId.toLowerCase()}-ffff-ffff-ffff-ffffffffffff`;
  return { lower, upper };
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
  if (looksLikeDirectEntityId(projectParam)) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", projectParam.trim())
      .maybeSingle();

    if (project?.id) return project.id;
  }

  const { shortId } = decodeReadableEntityParam(projectParam);

  if (shortId) {
    const range = shortIdToUuidRange(shortId);
    if (range) {
      const { data: candidates } = await supabase
        .from("projects")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .gte("id", range.lower)
        .lte("id", range.upper)
        .limit(10);

      return resolveEntityIdFromCandidates(projectParam, candidates);
    }
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
  if (looksLikeDirectEntityId(tabParam)) {
    const { data: tab } = await supabase
      .from("tabs")
      .select("id")
      .eq("project_id", projectId)
      .eq("id", tabParam.trim())
      .maybeSingle();

    if (tab?.id) return tab.id;
  }

  const { shortId } = decodeReadableEntityParam(tabParam);

  if (shortId) {
    const range = shortIdToUuidRange(shortId);
    if (range) {
      const { data: candidates } = await supabase
        .from("tabs")
        .select("id, name")
        .eq("project_id", projectId)
        .gte("id", range.lower)
        .lte("id", range.upper)
        .limit(10);

      return resolveEntityIdFromCandidates(tabParam, candidates);
    }
  }

  const { data: candidates } = await supabase
    .from("tabs")
    .select("id, name")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .limit(2000);

  return resolveEntityIdFromCandidates(tabParam, candidates);
});
