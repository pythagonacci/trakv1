/**
 * Migrate legacy timeline block JSONB data into timeline_* tables.
 * Run with: npx tsx scripts/migrate-timeline-blocks.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateTimelineBlocks() {
  const { data: blocks, error } = await supabase
    .from("blocks")
    .select("id, content, tabs!inner(projects!inner(workspace_id))")
    .eq("type", "timeline");

  if (error) {
    console.error("Failed to load timeline blocks:", error);
    return;
  }

  if (!blocks || blocks.length === 0) {
    console.log("No timeline blocks found.");
    return;
  }

  for (const block of blocks as any[]) {
    const workspaceId = block.tabs?.projects?.workspace_id;
    if (!workspaceId) {
      console.warn(`Skipping block ${block.id}: missing workspace`);
      continue;
    }

    const content = block.content || {};
    const legacyEvents = Array.isArray(content.events) ? content.events : [];
    const legacyDependencies = Array.isArray(content.dependencies) ? content.dependencies : [];

    if (legacyEvents.length > 0) {
      const eventPayload = legacyEvents.map((event: any, idx: number) => ({
        timeline_block_id: block.id,
        workspace_id: workspaceId,
        title: event.title || "Untitled",
        start_date: event.start,
        end_date: event.end || event.start,
        status: event.status || "planned",
        assignee_id: null,
        progress: event.progress ?? 0,
        notes: event.notes ?? null,
        color: event.color ?? null,
        is_milestone: event.isMilestone ?? false,
        baseline_start: event.baselineStart ?? null,
        baseline_end: event.baselineEnd ?? null,
        display_order: idx,
      }));

      const { error: insertError } = await supabase.from("timeline_events").insert(eventPayload);
      if (insertError) {
        console.error(`Failed to insert events for block ${block.id}:`, insertError);
      }
    }

    if (legacyDependencies.length > 0) {
      const depPayload = legacyDependencies.map((dep: any) => ({
        timeline_block_id: block.id,
        workspace_id: workspaceId,
        from_type: "event",
        from_id: dep.fromEventId,
        to_type: "event",
        to_id: dep.toEventId,
        dependency_type: dep.type || "finish-to-start",
      }));

      const { error: depError } = await supabase.from("timeline_dependencies").insert(depPayload);
      if (depError) {
        console.error(`Failed to insert dependencies for block ${block.id}:`, depError);
      }
    }

    const startDate = content.startDate || new Date(Date.now() - 7 * 86400000).toISOString();
    const endDate = content.endDate || new Date(Date.now() + 30 * 86400000).toISOString();
    const zoomLevel = content.zoomLevel || "day";
    const filters = content.filters || {};
    const groupBy = content.groupBy || "none";

    const { error: updateError } = await supabase
      .from("blocks")
      .update({
        content: {
          viewConfig: {
            startDate,
            endDate,
            zoomLevel,
            filters,
            groupBy,
          },
        },
      })
      .eq("id", block.id);

    if (updateError) {
      console.error(`Failed to update block ${block.id}:`, updateError);
    } else {
      console.log(`Migrated block ${block.id}`);
    }
  }
}

migrateTimelineBlocks().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
