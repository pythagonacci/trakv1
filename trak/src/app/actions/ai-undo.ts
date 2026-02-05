"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import type { UndoBatch, UndoStep } from "@/lib/ai/undo";

type ActionResult<T> = { data: T } | { error: string };

const ALLOWED_UNDO_TABLES = new Set([
  "projects",
  "tabs",
  "blocks",
  "task_items",
  "task_subtasks",
  "task_assignees",
  "task_tag_links",
  "task_comments",
  "tables",
  "table_fields",
  "table_rows",
  "table_comments",
  "timeline_events",
  "timeline_dependencies",
  "property_definitions",
  "entity_properties",
  "clients",
  "docs",
  "files",
]);

function normalizeBatches(batches: UndoBatch[] | null | undefined): UndoBatch[] {
  if (!Array.isArray(batches)) return [];
  return batches.filter((batch) => Array.isArray(batch) && batch.length > 0);
}

async function applyUndoStep(step: UndoStep, supabase: Awaited<ReturnType<typeof createClient>>) {
  if (!ALLOWED_UNDO_TABLES.has(step.table)) {
    return `Undo not allowed for table "${step.table}"`;
  }
  if (step.action === "delete") {
    const idColumn = step.idColumn || "id";
    const hasIds = Array.isArray(step.ids) && step.ids.length > 0;
    const hasWhere = step.where && Object.keys(step.where).length > 0;
    if (!hasIds && !hasWhere) return "Undo delete step missing ids/where";

    let query = supabase.from(step.table).delete();
    if (hasWhere) {
      query = query.match(step.where as Record<string, unknown>);
    }
    if (hasIds) {
      query = query.in(idColumn, step.ids as string[]);
    }
    const { error } = await query;
    if (error) return error.message || "Failed to delete rows";
    return null;
  }

  if (step.action === "upsert") {
    if (!Array.isArray(step.rows) || step.rows.length === 0) return null;
    const { error } = await supabase
      .from(step.table)
      .upsert(step.rows, step.onConflict ? { onConflict: step.onConflict } : undefined);
    if (error) return error.message || "Failed to upsert rows";
    return null;
  }

  return "Unsupported undo step";
}

export async function undoAIAction(params: {
  workspaceId: string;
  batches: UndoBatch[];
}): Promise<ActionResult<{ applied: number; failed: number; errors: string[] }>> {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const workspaceId = String(params.workspaceId || "").trim();
  if (!workspaceId) return { error: "Missing workspaceId" };

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const batches = normalizeBatches(params.batches);
  if (batches.length === 0) {
    return { data: { applied: 0, failed: 0, errors: [] } };
  }

  const supabase = await createClient();
  let applied = 0;
  let failed = 0;
  const errors: string[] = [];

  // Undo in reverse order of tool execution, while preserving step order per tool.
  for (let i = batches.length - 1; i >= 0; i -= 1) {
    const batch = batches[i];
    for (const step of batch) {
      const error = await applyUndoStep(step, supabase);
      if (error) {
        failed += 1;
        errors.push(error);
      } else {
        applied += 1;
      }
    }
  }

  return { data: { applied, failed, errors } };
}
