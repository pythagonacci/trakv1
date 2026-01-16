"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTimelineAccess } from "./context";
import { detectCircularDependencies, validateDependencyType } from "./validators";
import type { DependencyType, TimelineDependency } from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

export async function createTimelineDependency(input: {
  timelineBlockId: string;
  fromId: string;
  toId: string;
  dependencyType: DependencyType;
}): Promise<ActionResult<TimelineDependency>> {
  const access = await requireTimelineAccess(input.timelineBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  if (!validateDependencyType(input.dependencyType)) {
    return { error: "Invalid dependency type" };
  }

  const { supabase, userId, block } = access;

  const { data: existing } = await supabase
    .from("timeline_dependencies")
    .select("from_id, to_id")
    .eq("timeline_block_id", block.id);

  const edges = (existing || []).map((edge) => ({
    fromId: `event:${edge.from_id}`,
    toId: `event:${edge.to_id}`,
  }));

  const hasCycle = detectCircularDependencies(edges, {
    fromId: `event:${input.fromId}`,
    toId: `event:${input.toId}`,
  });
  if (hasCycle) {
    return { error: "Dependency would create a circular chain" };
  }

  const { data, error } = await supabase
    .from("timeline_dependencies")
    .insert({
      timeline_block_id: block.id,
      workspace_id: block.workspace_id,
      from_id: input.fromId,
      to_id: input.toId,
      dependency_type: input.dependencyType,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to create dependency" };

  return { data: data as TimelineDependency };
}

export async function deleteTimelineDependency(dependencyId: string): Promise<ActionResult<null>> {
  const access = await getDependencyContext(dependencyId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase } = access;
  const { error } = await supabase
    .from("timeline_dependencies")
    .delete()
    .eq("id", dependencyId);

  if (error) return { error: "Failed to delete dependency" };

  return { data: null };
}

export async function getTimelineDependencies(timelineBlockId: string): Promise<ActionResult<TimelineDependency[]>> {
  const access = await requireTimelineAccess(timelineBlockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, block } = access;

  const { data, error } = await supabase
    .from("timeline_dependencies")
    .select("*")
    .eq("timeline_block_id", block.id)
    .order("created_at", { ascending: true });

  if (error || !data) return { error: "Failed to load dependencies" };

  return { data: data as TimelineDependency[] };
}

async function getDependencyContext(dependencyId: string): Promise<{ error: string } | { supabase: any; dependency: TimelineDependency }> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: dependency } = await supabase
    .from("timeline_dependencies")
    .select("*")
    .eq("id", dependencyId)
    .single();

  if (!dependency) return { error: "Dependency not found" };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", (dependency as any).workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, dependency: dependency as TimelineDependency };
}
