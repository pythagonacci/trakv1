"use server";

import type { TimelineReference, TimelineReferenceFieldMappings } from "@/types/timeline";
import type { TimelineEventStatus } from "@/types/timeline";

export interface ResolvedReferenceData {
  title: string;
  start_date: string;
  end_date: string;
  status?: TimelineEventStatus;
  assignee_id?: string | null;
  progress?: number;
  source_data?: Record<string, unknown> | null;
}

export async function autoDetectDateFields(tableId: string, supabase: any) {
  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, type, is_primary, order")
    .eq("table_id", tableId)
    .order("order", { ascending: true });

  const dateFields = (fields || []).filter((field: any) => field.type === "date");
  const start = dateFields[0]?.id || null;
  const end = dateFields[1]?.id || null;

  return { startDateFieldId: start, endDateFieldId: end };
}

export async function resolveReferenceData(input: {
  reference: TimelineReference;
  supabase: any;
}): Promise<ResolvedReferenceData | null> {
  const { reference, supabase } = input;

  if (reference.reference_type === "table_row") {
    const { data: row } = await supabase
      .from("table_rows")
      .select("id, table_id, data, created_at, updated_at")
      .eq("id", reference.reference_id)
      .single();

    if (!row) return null;

    const { data: fields } = await supabase
      .from("table_fields")
      .select("id, name, type, is_primary, order")
      .eq("table_id", row.table_id)
      .order("order", { ascending: true });

    const mappings = (reference.field_mappings || {}) as TimelineReferenceFieldMappings;
    const startFieldId = mappings.startDateFieldId;
    const endFieldId = mappings.endDateFieldId;
    const titleFieldId = mappings.titleFieldId;

    const rowData = (row.data || {}) as Record<string, any>;

    const title =
      (titleFieldId && rowData[titleFieldId]) ||
      rowData[(fields || []).find((f: any) => f.is_primary)?.id || ""] ||
      rowData[(fields || []).find((f: any) => f.type === "text")?.id || ""] ||
      `Row ${row.id.slice(0, 6)}`;

    const start = startFieldId ? rowData[startFieldId] : null;
    const end = endFieldId ? rowData[endFieldId] : null;
    const startDate = start ? new Date(start).toISOString() : new Date(row.created_at).toISOString();
    const endDate = end ? new Date(end).toISOString() : startDate;

    return {
      title: String(title),
      start_date: startDate,
      end_date: endDate,
      source_data: rowData,
    };
  }

  if (reference.reference_type === "doc") {
    const { data: doc } = await supabase
      .from("docs")
      .select("id, title, created_at, updated_at")
      .eq("id", reference.reference_id)
      .single();

    if (!doc) return null;

    return {
      title: doc.title,
      start_date: doc.created_at,
      end_date: doc.updated_at,
    };
  }

  if (reference.reference_type === "task") {
    const { data: task } = await supabase
      .from("standalone_tasks")
      .select("id, text, due_date, created_at, updated_at")
      .eq("id", reference.reference_id)
      .single();

    if (!task) return null;

    const start = task.due_date ? new Date(task.due_date).toISOString() : task.created_at;
    const end = task.due_date ? new Date(task.due_date).toISOString() : task.updated_at;

    return {
      title: task.text,
      start_date: start,
      end_date: end,
    };
  }

  if (reference.reference_type === "block") {
    const { data: block } = await supabase
      .from("blocks")
      .select("id, type, created_at, updated_at")
      .eq("id", reference.reference_id)
      .single();

    if (!block) return null;

    return {
      title: `${block.type} block`,
      start_date: block.created_at,
      end_date: block.updated_at,
    };
  }

  return null;
}
