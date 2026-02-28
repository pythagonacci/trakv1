import type { SupabaseClient } from "@supabase/supabase-js";

export interface TagFieldOption {
  id: string;
  label: string;
  color?: string | null;
}

function normalizeTagName(value: string): string {
  return value.trim();
}

export function normalizeTagNames(input: string[]): string[] {
  const dedup = new Map<string, string>();
  for (const raw of input) {
    const normalized = normalizeTagName(raw);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!dedup.has(key)) dedup.set(key, normalized);
  }
  return Array.from(dedup.values());
}

export async function getProjectTagOptions(
  supabase: SupabaseClient,
  projectId: string
): Promise<TagFieldOption[]> {
  const { data, error } = await supabase
    .from("project_tags")
    .select("id,name")
    .eq("project_id", projectId)
    .order("name", { ascending: true });
  if (error) {
    throw new Error(`Failed to load project tags: ${error.message}`);
  }

  return (data ?? [])
    .map((row: any) => {
      const id = typeof row?.id === "string" ? row.id : "";
      const label = typeof row?.name === "string" ? row.name : "";
      if (!id || !label) return null;
      return { id, label } as TagFieldOption;
    })
    .filter((row): row is TagFieldOption => Boolean(row));
}

export async function ensureProjectTags(
  supabase: SupabaseClient,
  projectId: string,
  tagNames: string[]
): Promise<TagFieldOption[]> {
  const normalized = normalizeTagNames(tagNames);
  if (normalized.length === 0) {
    return getProjectTagOptions(supabase, projectId);
  }

  const existing = await getProjectTagOptions(supabase, projectId);
  const existingKeys = new Set(existing.map((opt) => opt.label.trim().toLowerCase()));
  const missing = normalized.filter((name) => !existingKeys.has(name.trim().toLowerCase()));
  if (missing.length === 0) return existing;

  const { error: insertError } = await supabase
    .from("project_tags")
    .insert(missing.map((name) => ({ project_id: projectId, name })));
  if (insertError) {
    throw new Error(`Failed to insert project tags: ${insertError.message}`);
  }

  return getProjectTagOptions(supabase, projectId);
}

export async function syncTagsFieldConfigsForProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<void> {
  const options = await getProjectTagOptions(supabase, projectId);
  const config = { options };

  const { data: tables, error: tablesError } = await supabase
    .from("tables")
    .select("id")
    .eq("project_id", projectId);
  if (tablesError) {
    throw new Error(`Failed to load project tables: ${tablesError.message}`);
  }
  const tableIds = (tables ?? [])
    .map((table: any) => table.id)
    .filter((id: unknown): id is string => typeof id === "string");
  if (tableIds.length === 0) return;

  const { data: fields, error: fieldsError } = await supabase
    .from("table_fields")
    .select("id")
    .eq("type", "tags")
    .in("table_id", tableIds);
  if (fieldsError) {
    throw new Error(`Failed to load tags fields: ${fieldsError.message}`);
  }

  const ids = (fields ?? []).map((f: any) => f.id).filter((id: unknown): id is string => typeof id === "string");
  if (ids.length === 0) return;

  const { error: updateError } = await supabase
    .from("table_fields")
    .update({ config })
    .in("id", ids);
  if (updateError) {
    throw new Error(`Failed to sync tags field configs: ${updateError.message}`);
  }
}

export function mapTagNamesToOptionIds(
  tagNames: string[],
  options: TagFieldOption[]
): string[] {
  const byLabel = new Map<string, string>();
  for (const option of options) {
    byLabel.set(option.label.trim().toLowerCase(), option.id);
  }
  return normalizeTagNames(tagNames)
    .map((name) => byLabel.get(name.trim().toLowerCase()) ?? null)
    .filter((id): id is string => Boolean(id));
}

export function mapOptionIdsToTagNames(
  ids: string[],
  options: TagFieldOption[]
): string[] {
  const byId = new Map<string, string>();
  for (const option of options) {
    byId.set(option.id, option.label);
  }
  return ids
    .map((id) => byId.get(id) ?? id)
    .filter((name) => typeof name === "string" && name.trim().length > 0);
}
