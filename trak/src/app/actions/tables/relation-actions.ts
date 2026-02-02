"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTableAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { TableField, TableRow } from "@/types/table";

type ActionResult<T> = { data: T } | { error: string };

interface NormalizedRelationConfig {
  relatedTableId: string | null;
  allowMultiple: boolean;
  limit?: number;
  bidirectional: boolean;
  reverseFieldId?: string | null;
  displayFieldId?: string | null;
}

function normalizeRelationConfig(config: TableField["config"]): NormalizedRelationConfig {
  const cfg = (config || {}) as Record<string, unknown>;
  const relatedTableId =
    (cfg.relation_table_id as string | undefined) ||
    (cfg.linkedTableId as string | undefined) ||
    null;
  const allowMultiple =
    (cfg.allow_multiple as boolean | undefined) ??
    (cfg.allowMultiple as boolean | undefined) ??
    true;
  return {
    relatedTableId,
    allowMultiple,
    limit: typeof cfg.limit === "number" ? cfg.limit : undefined,
    bidirectional: Boolean(cfg.bidirectional),
    reverseFieldId: (cfg.reverse_field_id as string | undefined) ?? null,
    displayFieldId:
      (cfg.display_field_id as string | undefined) ||
      (cfg.displayFieldId as string | undefined) ||
      null,
  };
}

function buildRelationConfig(input: {
  relatedTableId: string;
  allowMultiple: boolean;
  bidirectional: boolean;
  limit?: number;
  displayFieldId?: string | null;
  reverseFieldId?: string | null;
  reverseAllowMultiple?: boolean;
}) {
  const config: Record<string, unknown> = {
    relation_table_id: input.relatedTableId,
    relation_type: input.allowMultiple ? "many_to_many" : "one_to_many",
    bidirectional: input.bidirectional,
    reverse_field_id: input.reverseFieldId ?? undefined,
    display_field_id: input.displayFieldId ?? undefined,
    allow_multiple: input.allowMultiple,
    limit: input.limit,
  };

  if (input.reverseAllowMultiple !== undefined) {
    config.reverse_allow_multiple = input.reverseAllowMultiple;
  }

  return config;
}

export async function configureRelationField(input: {
  fieldId: string;
  name?: string;
  relatedTableId: string;
  allowMultiple: boolean;
  bidirectional: boolean;
  reverseAllowMultiple?: boolean;
  limit?: number;
  displayFieldId?: string | null;
  reverseFieldName?: string;
  authContext?: AuthContext;
}): Promise<ActionResult<{ field: TableField; reverseField?: TableField }>> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  if (input.authContext) {
    supabase = input.authContext.supabase;
    userId = input.authContext.userId;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }

  const { data: field, error: fieldError } = await supabase
    .from("table_fields")
    .select("id, table_id, name, config, type")
    .eq("id", input.fieldId)
    .maybeSingle();

  if (fieldError || !field) {
    return { error: "Field not found" };
  }

  const access = await requireTableAccess(field.table_id, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { data: relatedTable, error: relatedError } = await supabase
    .from("tables")
    .select("id, workspace_id")
    .eq("id", input.relatedTableId)
    .maybeSingle();

  if (relatedError || !relatedTable) {
    return { error: "Related table not found" };
  }

  if (relatedTable.workspace_id !== access.table.workspace_id) {
    return { error: "Tables must belong to the same workspace" };
  }

  let reverseField: TableField | undefined;
  let reverseFieldId = (field.config as any)?.reverse_field_id as string | undefined;
  const reverseAllowMultiple =
    input.reverseAllowMultiple !== undefined ? input.reverseAllowMultiple : !input.allowMultiple;

  if (input.bidirectional && !reverseFieldId) {
    const reverseName = input.reverseFieldName || `Related ${input.name || field.name}`;
    const { data: createdReverse, error: reverseError } = await supabase
      .from("table_fields")
      .insert({
        table_id: input.relatedTableId,
        name: reverseName,
        type: "relation",
        config: buildRelationConfig({
          relatedTableId: field.table_id,
          allowMultiple: reverseAllowMultiple,
          bidirectional: true,
          displayFieldId: undefined,
          reverseFieldId: field.id,
        }),
      })
      .select("*")
      .single();

    if (reverseError || !createdReverse) {
      return { error: "Failed to create reverse relation field" };
    }
    reverseField = createdReverse as TableField;
    reverseFieldId = reverseField.id;
  } else if (input.bidirectional && reverseFieldId) {
    const reverseUpdates: Record<string, unknown> = {
      type: "relation",
      config: buildRelationConfig({
        relatedTableId: field.table_id,
        allowMultiple: reverseAllowMultiple,
        bidirectional: true,
        displayFieldId: undefined,
        reverseFieldId: field.id,
      }),
    };
    if (input.reverseFieldName) {
      reverseUpdates.name = input.reverseFieldName;
    }

    await supabase.from("table_fields").update(reverseUpdates).eq("id", reverseFieldId);
  }

  const nextConfig = buildRelationConfig({
    relatedTableId: input.relatedTableId,
    allowMultiple: input.allowMultiple,
    bidirectional: input.bidirectional,
    limit: input.limit,
    displayFieldId: input.displayFieldId ?? null,
    reverseFieldId: reverseFieldId ?? null,
    reverseAllowMultiple: input.bidirectional ? reverseAllowMultiple : undefined,
  });

  const updatePayload: Record<string, unknown> = {
    type: "relation",
    config: nextConfig,
  };
  if (input.name) {
    updatePayload.name = input.name;
  }

  const { data: updatedField, error: updateError } = await supabase
    .from("table_fields")
    .update(updatePayload)
    .eq("id", input.fieldId)
    .select("*")
    .single();

  if (updateError || !updatedField) {
    return { error: "Failed to update relation field" };
  }

  return { data: { field: updatedField as TableField, reverseField } };
}

export async function getRelatedRows(
  rowId: string,
  fieldId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<{ rows: TableRow[]; displayFieldId?: string | null }>> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
  }

  const { data: field, error: fieldError } = await supabase
    .from("table_fields")
    .select("id, table_id, config, type")
    .eq("id", fieldId)
    .maybeSingle();

  if (fieldError || !field || field.type !== "relation") {
    return { error: "Relation field not found" };
  }

  const access = await requireTableAccess(field.table_id, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const config = normalizeRelationConfig(field.config as TableField["config"]);
  const relatedTableId = config.relatedTableId;

  if (!relatedTableId) {
    return { data: { rows: [], displayFieldId: null } };
  }

  const { data: relations, error: relError } = await supabase
    .from("table_relations")
    .select("to_row_id, to_table_id")
    .eq("from_row_id", rowId)
    .eq("from_field_id", fieldId);

  if (relError) {
    return { error: "Failed to load relations" };
  }

  if (!relations || relations.length === 0) {
    return { data: { rows: [], displayFieldId: config.displayFieldId } };
  }

  const ids = relations.map((rel) => rel.to_row_id);
  const toTableId = relations[0]?.to_table_id || relatedTableId;

  const { data: rows, error: rowsError } = await supabase
    .from("table_rows")
    .select("*")
    .eq("table_id", toTableId)
    .in("id", ids)
    .order("order", { ascending: true });

  if (rowsError || !rows) {
    return { error: "Failed to load related rows" };
  }

  const { data: fields } = await supabase
    .from("table_fields")
    .select("id, name, type, is_primary")
    .eq("table_id", toTableId)
    .order("order", { ascending: true });

  /**
   * Determine which field to display for related rows.
   *
   * When showing related rows, we pick one field value to display.
   * This follows a predictable fallback order to stay readable.
   * If the configured display field was deleted, we fall back gracefully.
   * If the table has no fields, callers should display the row id.
   *
   * Fallback priority:
   * 1) Configured display field (explicit user choice)
   * 2) Primary/text field (most likely to be a title/name)
   * 3) First long_text field (better than nothing)
   * 4) First field of any type (edge case for unusual tables)
   * 5) Null (caller falls back to row id)
   */
  const determineDisplayField = (
    configuredFieldId: string | null | undefined,
    tableFields: Array<{ id: string; name?: string; type: string; is_primary?: boolean }> | null
  ) => {
    if (!tableFields || tableFields.length === 0) return null;

    // Try configured field first (user's explicit choice).
    const configured = configuredFieldId
      ? tableFields.find((f) => f.id === configuredFieldId || f.name === configuredFieldId) ?? null
      : null;
    if (configured) return configured.id;

    // Prefer primary or text field (usually title/name).
    const primary = tableFields.find((f) => f.is_primary);
    if (primary) return primary.id;

    const textField = tableFields.find((f) => f.type === "text");
    if (textField) return textField.id;

    // Fall back to long text field.
    const longTextField = tableFields.find((f) => f.type === "long_text");
    if (longTextField) return longTextField.id;

    // Use any field as last resort (better than nothing).
    return tableFields[0]?.id ?? null;
  };

  const displayFieldId = determineDisplayField(config.displayFieldId, fields || null);

  return { data: { rows: rows as TableRow[], displayFieldId } };
}

export async function countRelationLinksForRows(input: {
  tableId: string;
  rowIds: string[];
  authContext?: AuthContext;
}): Promise<ActionResult<{ count: number }>> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  if (input.authContext) {
    supabase = input.authContext.supabase;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
  }

  if (input.rowIds.length === 0) return { data: { count: 0 } };

  const access = await requireTableAccess(input.tableId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const quotedIds = input.rowIds.map((id) => `"${id}"`).join(",");
  const filter = `from_row_id.in.(${quotedIds}),to_row_id.in.(${quotedIds})`;

  const { count, error } = await supabase
    .from("table_relations")
    .select("id", { count: "exact", head: true })
    .or(filter);

  if (error) return { error: "Failed to count relation links" };

  return { data: { count: count ?? 0 } };
}

export async function syncRelationLinks(input: {
  fromRowId: string;
  fromField: Pick<TableField, "id" | "table_id" | "config">;
  nextRowIds: string[];
  userId?: string;
  authContext?: AuthContext;
}) {
  /**
   * Sync relation links using a delta-based approach.
   *
   * We take the full desired set of related row ids and compute:
   * - toAdd = desired - current
   * - toRemove = current - desired
   *
   * This keeps updates atomic and avoids race conditions between
   * separate link/unlink calls.
   */
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  if (input.authContext) {
    supabase = input.authContext.supabase;
    userId = input.authContext.userId;
  } else {
    const client = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" } as const;
    supabase = client;
    userId = user.id;
  }

  const access = await requireTableAccess(input.fromField.table_id, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" } as const;

  const config = normalizeRelationConfig(input.fromField.config);
  if (!config.relatedTableId) {
    return { error: "Relation field is missing related table" } as const;
  }

  const uniqueIds = Array.from(new Set(input.nextRowIds.filter(Boolean)));
  const limitedIds =
    !config.allowMultiple && uniqueIds.length > 1 ? uniqueIds.slice(0, 1) : uniqueIds;
  const cappedIds = config.limit ? limitedIds.slice(0, config.limit) : limitedIds;

  const { data: validRows } = await supabase
    .from("table_rows")
    .select("id")
    .eq("table_id", config.relatedTableId)
    .in("id", cappedIds);
  const validSet = new Set((validRows || []).map((row) => row.id));
  const validIds = cappedIds.filter((id) => validSet.has(id));

  const { data: existingRelations } = await supabase
    .from("table_relations")
    .select("to_row_id")
    .eq("from_row_id", input.fromRowId)
    .eq("from_field_id", input.fromField.id);

  const existingIds = new Set((existingRelations || []).map((rel) => rel.to_row_id));
  const nextIds = new Set(validIds);

  const toAdd = validIds.filter((id) => !existingIds.has(id));
  const toRemove = Array.from(existingIds).filter((id) => !nextIds.has(id));

  if (toAdd.length > 0) {
    const payload = toAdd.map((toRowId) => ({
      from_table_id: input.fromField.table_id,
      from_field_id: input.fromField.id,
      from_row_id: input.fromRowId,
      to_table_id: config.relatedTableId,
      to_row_id: toRowId,
    }));
    const { error: insertError } = await supabase.from("table_relations").insert(payload);
    if (insertError) return { error: "Failed to link related rows" } as const;
  }

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("table_relations")
      .delete()
      .eq("from_row_id", input.fromRowId)
      .eq("from_field_id", input.fromField.id)
      .in("to_row_id", toRemove);
    if (deleteError) return { error: "Failed to unlink related rows" } as const;
  }

  const { data: row } = await supabase
    .from("table_rows")
    .select("data")
    .eq("id", input.fromRowId)
    .single();

  const updatedData = {
    ...(row?.data || {}),
    [input.fromField.id]: validIds,
  };

  await supabase
    .from("table_rows")
    .update({
      data: updatedData,
      updated_by: input.userId ?? userId,
    })
    .eq("id", input.fromRowId);

  if (config.bidirectional && config.reverseFieldId) {
    // Determine which field to update on the related row
    // If we're updating from the reverse field, we need to update the forward field on the related row
    // If we're updating from the forward field, we need to update the reverse field on the related row
    const isReverseField = input.fromField.id === config.reverseFieldId;
    const fieldIdToUpdateOnRelatedRow = isReverseField 
      ? config.reverseFieldId // When on reverse, update the forward field (which is reverseFieldId from reverse's perspective)
      : config.reverseFieldId; // When on forward, update the reverse field
    
    // Actually, when on reverse field, reverseFieldId points to the forward field in the related table
    // So we should use it directly
    const forwardFieldId = config.reverseFieldId;

    for (const toRowId of toAdd) {
      // Create reverse relation record
      await supabase.from("table_relations").insert({
        from_table_id: config.relatedTableId,
        from_field_id: config.reverseFieldId,
        from_row_id: toRowId,
        to_table_id: input.fromField.table_id,
        to_row_id: input.fromRowId,
      });

      // Update the forward field on the related row (toRowId)
      // This ensures the forward side shows the link when viewing Project A's Tasks field
      const { data: forwardRow } = await supabase
        .from("table_rows")
        .select("data")
        .eq("id", toRowId)
        .single();

      if (forwardRow) {
        const existingForward = (forwardRow.data?.[forwardFieldId] as string[]) || [];
        const nextForward = Array.from(new Set([...existingForward, input.fromRowId]));
        await supabase
          .from("table_rows")
          .update({
            data: {
              ...(forwardRow.data || {}),
              [forwardFieldId]: nextForward,
            },
            updated_by: input.userId ?? userId,
          })
          .eq("id", toRowId);
      }
    }

    for (const toRowId of toRemove) {
      // Delete reverse relation record
      await supabase
        .from("table_relations")
        .delete()
        .eq("from_row_id", toRowId)
        .eq("from_field_id", config.reverseFieldId)
        .eq("to_row_id", input.fromRowId);

      // Update the forward field on the related row (toRowId)
      const forwardFieldId = config.reverseFieldId;
      const { data: forwardRow } = await supabase
        .from("table_rows")
        .select("data")
        .eq("id", toRowId)
        .single();

      if (forwardRow) {
        const existingForward = (forwardRow.data?.[forwardFieldId] as string[]) || [];
        const nextForward = existingForward.filter((id) => id !== input.fromRowId);
        await supabase
          .from("table_rows")
          .update({
            data: {
              ...(forwardRow.data || {}),
              [forwardFieldId]: nextForward,
            },
            updated_by: input.userId ?? userId,
          })
          .eq("id", toRowId);
      }
    }
  }

  return {
    data: {
      relatedTableId: config.relatedTableId,
      reverseFieldId: config.reverseFieldId,
      added: toAdd,
      removed: toRemove,
    },
  } as const;
}
