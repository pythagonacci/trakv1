"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import type { AuthContext } from "@/lib/auth-context";
import { queryEntities } from "@/app/actions/properties/query-actions";
import type { QueryEntitiesParams, PropertyFilter, EntityReference } from "@/types/properties";

// ============================================================================
// TYPES
// ============================================================================

interface SearchResponse<T> {
  data: T[] | null;
  error: string | null;
}

interface DateFilter {
  eq?: string;
  gte?: string;
  lte?: string;
  isNull?: boolean;
}

// Parse Assignee property value: supports single/array of { id, name } or string IDs
function parseAssigneeValue(value: unknown): Array<{ id: string; name: string }> {
  if (value === null || value === undefined) return [];
  const entries = Array.isArray(value) ? value : [value];
  const assignees: Array<{ id: string; name: string }> = [];

  for (const entry of entries) {
    if (entry === null || entry === undefined) continue;
    if (typeof entry === "string") {
      assignees.push({ id: entry, name: entry });
      continue;
    }
    if (typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const id =
        (typeof obj.id === "string" && obj.id) ||
        (typeof obj.user_id === "string" && obj.user_id) ||
        (typeof obj.value === "string" && obj.value) ||
        "";
      const name =
        (typeof obj.name === "string" && obj.name) ||
        (typeof obj.email === "string" && obj.email) ||
        id;
      if (id || name) {
        assignees.push({ id: id || name, name });
      }
    }
  }

  return assignees;
}

function normalizeSelectValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeSelectValue(item);
      if (normalized) return normalized;
    }
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const idCandidate = obj.id;
    const nameCandidate = obj.name ?? obj.label;
    if (
      (typeof idCandidate === "string" || typeof idCandidate === "number" || typeof idCandidate === "boolean") &&
      (typeof nameCandidate === "string" || typeof nameCandidate === "number" || typeof nameCandidate === "boolean")
    ) {
      const idString = String(idCandidate);
      if (isUuidLike(idString)) {
        return String(nameCandidate);
      }
    }
    for (const key of ["id", "value", "name", "label"]) {
      const candidate = obj[key];
      if (typeof candidate === "string" || typeof candidate === "number" || typeof candidate === "boolean") {
        return String(candidate);
      }
    }
  }
  return null;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeStatusValue(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === "in-progress" || normalized === "in progress" || normalized === "in_progress") return "in_progress";
  if (normalized === "to do" || normalized === "to-do" || normalized === "todo") return "todo";
  if (normalized === "blocked" || normalized === "on hold" || normalized === "stuck") return "blocked";
  if (normalized === "done" || normalized === "complete" || normalized === "completed" || normalized === "finished") return "done";
  return value;
}

function normalizePriorityValue(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (["low", "medium", "high", "urgent"].includes(normalized)) return normalized;
  return value;
}

function normalizeDateValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.end === "string") return obj.end;
    if (typeof obj.start === "string") return obj.start;
    if (typeof obj.date === "string") return obj.date;
    if (typeof obj.value === "string") return obj.value;
  }
  return null;
}

function normalizeTagsValue(value: unknown): Array<{ id: string; name: string; color: string | null }> {
  if (value === null || value === undefined) return [];
  const entries = Array.isArray(value) ? value : [value];
  const tags: Array<{ id: string; name: string; color: string | null }> = [];

  for (const entry of entries) {
    if (entry === null || entry === undefined) continue;
    if (typeof entry === "string") {
      tags.push({ id: entry, name: entry, color: null });
      continue;
    }
    if (typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const id =
        (typeof obj.id === "string" && obj.id) ||
        (typeof obj.value === "string" && obj.value) ||
        (typeof obj.name === "string" && obj.name) ||
        (typeof obj.label === "string" && obj.label) ||
        "";
      const name =
        (typeof obj.name === "string" && obj.name) ||
        (typeof obj.label === "string" && obj.label) ||
        id;
      const color = typeof obj.color === "string" ? obj.color : null;
      if (id || name) {
        tags.push({ id: id || name, name, color });
      }
    }
  }

  return tags;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

interface TaskResult {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  description: string | null;
  due_date: string | null;
  start_date: string | null;
  workspace_id: string;
  project_id: string | null;
  project_name: string | null;
  tab_id: string | null;
  tab_name: string | null;
  task_block_id: string;
  assignees: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string; color: string | null }>;
  created_at: string;
  updated_at: string;
}

interface SubtaskResult {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  display_order: number;
  task_id: string;
  task_title: string | null;
  project_id: string | null;
  project_name: string | null;
  tab_id: string | null;
  tab_name: string | null;
  created_at: string;
  updated_at: string;
}

interface SubtaskDetailsResult extends SubtaskResult {
  properties?: EnrichedProperty[];
}

interface ProjectResult {
  id: string;
  name: string;
  status: string;
  project_type: string;
  workspace_id: string;
  client_id: string | null;
  client_name: string | null;
  due_date_date: string | null;
  due_date_text: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientResult {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  workspace_id: string;
  created_at: string;
}

interface WorkspaceMemberResult {
  id: string;
  user_id: string;
  role: string;
  name: string | null;
  email: string;
  workspace_id: string;
  created_at: string;
}

interface TabResult {
  id: string;
  name: string;
  position: number;
  project_id: string;
  project_name: string | null;
  parent_tab_id: string | null;
  is_client_visible: boolean;
  created_at: string;
}

interface BlockResult {
  id: string;
  type: string;
  content: Record<string, unknown>;
  position: number;
  column: number;
  tab_id: string;
  tab_name: string | null;
  project_id: string | null;
  project_name: string | null;
  parent_block_id: string | null;
  is_template: boolean;
  template_name: string | null;
  created_at: string;
  updated_at: string;
  // Properties from entity_properties
  assignees?: Array<{ id: string; name: string }>;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
}

interface DocResult {
  id: string;
  title: string;
  content: Record<string, unknown>;
  workspace_id: string;
  created_by: string;
  created_by_name: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface TableResult {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  workspace_id: string;
  project_id: string | null;
  project_name: string | null;
  created_at: string;
  updated_at: string;
}

interface TableFieldResult {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  order: number;
  is_primary: boolean;
  table_id: string;
  table_title: string | null;
  created_at: string;
}

interface TableRowResult {
  id: string;
  data: Record<string, unknown>;
  order: number;
  table_id: string;
  table_title: string | null;
  project_id: string | null;
  project_name: string | null;
  created_at: string;
  updated_at: string;
  // Properties from entity_properties
  assignees?: Array<{ id: string; name: string }>;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
}

interface TimelineEventResult {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string | null;
  progress: number;
  notes: string | null;
  color: string | null;
  is_milestone: boolean;
  workspace_id: string;
  timeline_block_id: string;
  assignee_id: string | null;
  assignee_name: string | null;
  project_id: string | null;
  project_name: string | null;
  created_at: string;
  updated_at: string;
}

interface FileResult {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  storage_path: string;
  bucket: string;
  workspace_id: string;
  project_id: string;
  project_name: string | null;
  uploaded_by: string;
  uploaded_by_name: string | null;
  created_at: string;
}

interface CommentResult {
  id: string;
  text: string;
  target_type: string;
  target_id: string;
  user_id: string;
  user_name: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskCommentResult {
  id: string;
  text: string;
  task_id: string;
  task_title: string | null;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

interface PaymentResult {
  id: string;
  payment_number: string | null;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  notes: string | null;
  due_date: string | null;
  paid_at: string | null;
  workspace_id: string;
  project_id: string | null;
  project_name: string | null;
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string | null;
}

interface TagResult {
  id: string;
  name: string;
  color: string | null;
  workspace_id: string;
  created_at: string | null;
}

interface PropertyDefinitionResult {
  id: string;
  name: string;
  type: string;
  options: unknown;
  workspace_id: string;
  created_at: string;
}

interface EntityLinkResult {
  id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  workspace_id: string;
  created_at: string;
}

interface EntityPropertyResult {
  id: string;
  entity_type: string;
  entity_id: string;
  property_definition_id: string;
  property_name: string;
  property_type: string;
  value: unknown;
  workspace_id: string;
  created_at: string;
}

interface TableViewResult {
  id: string;
  name: string;
  type: string;
  table_id: string;
  table_title: string | null;
  config: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
}

interface DocContentSearchResult {
  id: string;
  title: string;
  snippets: string[];
  match_count: number;
  created_at: string;
  updated_at: string;
}

type EntityType =
  | "task"
  | "subtask"
  | "project"
  | "client"
  | "member"
  | "tab"
  | "block"
  | "doc"
  | "table"
  | "table_row"
  | "timeline_event"
  | "file"
  | "payment"
  | "tag";

interface ResolvedEntity {
  id: string;
  name: string;
  type: EntityType;
  confidence: "exact" | "high" | "partial";
  context?: {
    project_id?: string;
    project_name?: string;
    client_id?: string;
    client_name?: string;
  };
}

// ============================================================================
// CONTEXT HELPERS
// ============================================================================

/** Success shape for search context (workspace + auth + client). Pass to search fns to avoid duplicate getSearchContext. */
export type SearchContextSuccess = {
  workspaceId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

/**
 * Gets the authenticated search context including workspace ID and Supabase client.
 * All search functions must call this to ensure proper authorization.
 * Exported so callers (e.g. tool-executor) can get context once and pass to multiple search fns.
 * When opts.authContext is provided, reuses it to avoid duplicate auth.
 */
export async function getSearchContext(opts?: { authContext?: AuthContext }): Promise<
  | { error: string; workspaceId?: undefined; supabase?: undefined; userId?: undefined }
  | { error: null; workspaceId: string; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  let workspaceId: string | null;

  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
    workspaceId = opts.authContext.workspaceId || null;
  } else {
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    supabase = await createClient();
    userId = user.id;
    workspaceId = null;
  }

  // Get workspace ID from authContext or from cookies
  if (!workspaceId) {
    workspaceId = await getCurrentWorkspaceId();
  }

  if (!workspaceId) return { error: "No workspace selected" };

  return { error: null, workspaceId, supabase, userId };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Normalizes a filter value that can be either a single value or an array.
 */
function normalizeArrayFilter<T>(value?: T | T[]): T[] | null {
  if (!value) return null;
  return Array.isArray(value) ? value : [value];
}

function coerceRelation<T>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return (value[0] as T) ?? null;
  }
  return value as T;
}

/**
 * Escapes a value for safe use inside PostgREST .or() filter expressions.
 * PostgREST treats commas/parentheses as syntax unless the value is quoted.
 */
function escapePostgrestOrValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Builds a safe OR expression for ilike across multiple columns.
 */
function buildOrIlikeFilter(columns: string[], text: string): string {
  const pattern = escapePostgrestOrValue(`%${text}%`);
  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}

/**
 * Stringifies unknown data for broad text matching.
 */
function toSearchableText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

/**
 * Applies date filters to a Supabase query.
 */
function applyDateFilter<T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T; eq: (col: string, val: string) => T; is: (col: string, val: null) => T }>(
  query: T,
  column: string,
  filter?: DateFilter
): T {
  if (!filter) return query;

  if (filter.isNull) {
    return query.is(column, null);
  }
  if (filter.eq) {
    return query.eq(column, filter.eq);
  }
  if (filter.gte) {
    query = query.gte(column, filter.gte);
  }
  if (filter.lte) {
    query = query.lte(column, filter.lte);
  }
  return query;
}

// ============================================================================
// ENTITY PROPERTIES HELPERS
// ============================================================================

/**
 * Property definition info with ID and type.
 */
interface PropertyDefInfo {
  id: string;
  type: string;
}

/**
 * Enriched property data for an entity.
 */
interface EnrichedProperty {
  id: string;
  name: string;
  type: string;
  value: unknown;
}

/**
 * Gets property definition IDs for common task properties in the workspace.
 * Returns a Map of property name → { id, type }.
 */
async function getPropertyDefinitionIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<Map<string, PropertyDefInfo>> {
  // Query ALL property definitions to find matching names (case-insensitive)
  const { data, error } = await supabase
    .from("property_definitions")
    .select("id, name, type")
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("[getPropertyDefinitionIds] Error:", error);
    return new Map();
  }

  // Map by lowercase name for case-insensitive matching
  const result = new Map<string, PropertyDefInfo>();
  for (const p of data ?? []) {
    // Store by original name
    result.set(p.name, { id: p.id, type: p.type });
    // Also store by lowercase for flexible lookup
    result.set(p.name.toLowerCase(), { id: p.id, type: p.type });
  }

  return result;
}

/**
 * Fetches entity IDs that match a property filter.
 * Uses fetch-and-filter approach for reliability with JSONB data.
 *
 * @param entityType - The entity type to filter (task, block, timeline_event)
 * @param propertyDefId - The property definition ID to filter on
 * @param filterType - The type of filter: 'id' for exact ID match, 'name' for fuzzy name match
 * @param filterValue - The value to filter by (ID or name string)
 */
async function getEntitiesWithPropertyFilter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  entityType: "task" | "block" | "timeline_event",
  propertyDefId: string,
  filterType: "id" | "name",
  filterValue: string | string[]
): Promise<string[]> {
  // Fetch all entity_properties with this property definition
  const { data, error } = await supabase
    .from("entity_properties")
    .select("entity_id, value")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("property_definition_id", propertyDefId);

  if (error) {
    console.error("[getEntitiesWithPropertyFilter] Error:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Filter in JavaScript based on JSONB value structure
  const matchingIds: string[] = [];
  const filterValues = Array.isArray(filterValue) ? filterValue : [filterValue];

  console.log(`[getEntitiesWithPropertyFilter] Filtering ${entityType}, filterType: ${filterType}, filterValues:`, filterValues, `total rows: ${data.length}`);

  // Log all the actual values in the database for debugging
  if (entityType === "task" && filterType === "name" && data.length > 0) {
    console.log("[getEntitiesWithPropertyFilter] All database status values:", data.map(r => {
      const v = r.value;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        return (v as Record<string, unknown>).name;
      }
      return v;
    }));
  }

  for (const row of data) {
    const value = row.value;
    let matches = false;

    // Debug: log value structure for task status filtering
    if (entityType === "task" && filterType === "name") {
      console.log(`[getEntitiesWithPropertyFilter] Row value:`, JSON.stringify(value), `type:`, typeof value, `isArray:`, Array.isArray(value));
    }

    if (filterType === "id") {
      // For person property: value is { id, name }
      // For multi_select: value is [{ id, name }, ...]
      if (value && typeof value === "object") {
        if (Array.isArray(value)) {
          // Multi-select: check if any item.id matches
          matches = value.some((item: any) =>
            filterValues.some(fv => item?.id === fv)
          );
        } else {
          // Single object: check if value.id matches
          const valueObj = value as Record<string, unknown>;
          matches = filterValues.some(fv => valueObj.id === fv);
        }
      }
    } else {
      // Name-based fuzzy matching - support array of names (match any)
      // Normalize search strings: replace underscores/hyphens with spaces for flexible matching
      const normalizeForMatching = (str: string) => str.toLowerCase().replace(/[_-]/g, " ");
      const searchNames = filterValues.map(v => normalizeForMatching(v));

      if (typeof value === "string") {
        // Handle plain string values (e.g., status stored as "todo" instead of {name: "todo"})
        const valueNormalized = normalizeForMatching(value);
        matches = searchNames.some(searchName => valueNormalized.includes(searchName));

        if (entityType === "task" && filterType === "name") {
          console.log(`[getEntitiesWithPropertyFilter] String comparison - DB: "${value}", normalized: "${valueNormalized}", search:`, searchNames, `matches:`, matches);
        }
      } else if (value && typeof value === "object") {
        if (Array.isArray(value)) {
          // Multi-select: check if any item.name matches any search name
          matches = value.some((item: any) =>
            searchNames.some(searchName => {
              const itemNameNormalized = normalizeForMatching(item?.name || "");
              return itemNameNormalized.includes(searchName);
            })
          );
        } else {
          // Single object: check if value.name matches any search name
          const valueObj = value as Record<string, unknown>;
          const name = valueObj.name as string | undefined;
          const nameNormalized = name ? normalizeForMatching(name) : "";

          // Debug logging for status filtering
          if (entityType === "task" && filterType === "name") {
            console.log(`[getEntitiesWithPropertyFilter] Object comparison - DB value: "${name}", normalized: "${nameNormalized}", searchNames:`, searchNames, `matches:`, searchNames.some(searchName => nameNormalized.includes(searchName)));
          }

          matches = nameNormalized ? searchNames.some(searchName => nameNormalized.includes(searchName)) : false;
        }
      }
    }

    if (matches) {
      matchingIds.push(row.entity_id);
    }

    // Debug: log match result
    if (entityType === "task" && filterType === "name") {
      console.log(`[getEntitiesWithPropertyFilter] Final matches result:`, matches);
    }
  }

  return [...new Set(matchingIds)];
}

/**
 * Fetches entity IDs that match a date property filter.
 * Applies DateFilter to property values (expected ISO date strings).
 */
async function getEntitiesWithDatePropertyFilter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  entityType: "task" | "block" | "timeline_event",
  propertyDefId: string,
  filter: DateFilter
): Promise<string[]> {
  const { data, error } = await supabase
    .from("entity_properties")
    .select("entity_id, value")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .eq("property_definition_id", propertyDefId);

  if (error) {
    console.error("[getEntitiesWithDatePropertyFilter] Error:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  const matchesDateFilter = (value: unknown): boolean => {
    const dateValue = typeof value === "string" ? value : null;

    if (filter.isNull) {
      return dateValue === null;
    }

    if (!dateValue) return false;

    if (filter.eq && dateValue !== filter.eq) return false;
    if (filter.gte && dateValue < filter.gte) return false;
    if (filter.lte && dateValue > filter.lte) return false;
    return true;
  };

  const matchingIds = data
    .filter((row) => matchesDateFilter(row.value))
    .map((row) => row.entity_id);

  return [...new Set(matchingIds)];
}

/**
 * Fetches all properties for a list of entities and returns them as a Map.
 * Used to enrich entity results with their property values.
 *
 * @returns Map of entity_id → array of properties with name, type, and value
 */
async function enrichEntitiesWithProperties(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  entityType: "task" | "subtask" | "block" | "timeline_event" | "table_row",
  entityIds: string[]
): Promise<Map<string, EnrichedProperty[]>> {
  if (entityIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("entity_properties")
    .select("entity_id, property_definition_id, value, property_definitions(name, type)")
    .eq("workspace_id", workspaceId)
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  if (error) {
    console.error("enrichEntitiesWithProperties error:", error);
    return new Map();
  }

  // Group properties by entity_id
  const result = new Map<string, EnrichedProperty[]>();

  for (const row of data ?? []) {
    const rawDef = row.property_definitions as
      | { name: string; type: string }
      | Array<{ name: string; type: string }>
      | null;
    const def = Array.isArray(rawDef) ? rawDef[0] ?? null : rawDef;
    const prop: EnrichedProperty = {
      id: row.property_definition_id,
      name: def?.name ?? "Unknown",
      type: def?.type ?? "unknown",
      value: row.value,
    };

    const existing = result.get(row.entity_id) ?? [];
    existing.push(prop);
    result.set(row.entity_id, existing);
  }

  return result;
}

/**
 * Extracts a typed value from a property based on its type.
 */
function extractPropertyValue(
  value: unknown,
  propertyType: string
): { id?: string; name?: string } | Array<{ id: string; name: string }> | string | null {
  if (value === null || value === undefined) return null;

  switch (propertyType) {
    case "person":
    case "select":
      // { id, name } structure
      if (typeof value === "object" && value !== null) {
        const v = value as Record<string, unknown>;
        return { id: v.id as string, name: v.name as string };
      }
      return null;

    case "multi_select":
      // Array of { id, name } structures
      if (Array.isArray(value)) {
        return value.map((item) => ({
          id: (item as Record<string, unknown>).id as string,
          name: (item as Record<string, unknown>).name as string,
        }));
      }
      return [];

    case "date":
    case "text":
    case "number":
    case "checkbox":
      // Return as-is (string, number, or boolean)
      return value as string;

    default:
      return value as string;
  }
}

/**
 * Intersects two arrays of IDs. If the first array is null, returns the second.
 * Used for combining multiple property filters.
 */
function intersectIds(a: string[] | null, b: string[]): string[] {
  if (a === null) return b;
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Search for tasks in the current workspace.
 * Returns tasks with their assignees, tags, project name, and tab name.
 *
 * @param params.searchText - Fuzzy search on task title and description
 * @param params.status - Filter by status (todo, in-progress, done)
 * @param params.priority - Filter by priority (urgent, high, medium, low, none)
 * @param params.assigneeId - Filter by assignee user ID
 * @param params.assigneeName - Search by assignee name via entity_properties
 * @param params.projectId - Filter by project ID
 * @param params.tabId - Filter by tab ID
 * @param params.tagId - Filter by tag ID
 * @param params.tagName - Search by tag name via entity_properties
 * @param params.dueDate - Date filter for due_date column or "Due Date" property
 * @param params.startDate - Date filter for start_date
 * @param params.createdAt - Date filter for created_at
 * @param params.updatedAt - Date filter for updated_at
 * @param params.limit - Maximum results (default 50)
 */
export async function searchTasks(params: {
  searchText?: string;
  status?: string | string[];
  priority?: string | string[];
  assigneeId?: string | string[];
  assigneeName?: string; // Search by assignee name via entity_properties
  projectId?: string | string[];
  tabId?: string | string[];
  tagId?: string | string[];
  tagName?: string; // Search by tag name via entity_properties
  dueDate?: DateFilter;
  startDate?: DateFilter;
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
  limit?: number;
  includeWorkflowRepresentations?: boolean;
  authContext?: AuthContext; // For Slack and API calls without cookies
}): Promise<SearchResponse<TaskResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  // After error check, supabase and workspaceId are guaranteed to be defined
  const supabase = ctx.supabase!;
  const workspaceId = ctx.workspaceId!;
  const limit = params.limit ?? 50;

  try {
    // Determine if we need property-based filtering
    const hasPropertyFilters = !!(
      params.assigneeId ||
      params.assigneeName ||
      params.tagId ||
      params.tagName ||
      params.status ||
      params.priority
    );

    let matchingTaskIds: string[] | null = null;
    let dueDatePropertyIds: string[] | null = null;

    // Pre-filter by entity_properties if property filters are specified
    if (hasPropertyFilters) {
      const propDefs = await getPropertyDefinitionIds(supabase, workspaceId);

      // Helper to find property definition case-insensitively
      const findPropDef = (name: string) =>
        propDefs.get(name) || propDefs.get(name.toLowerCase()) || propDefs.get(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());

      // Filter by assignee (via entity_properties)
      if (params.assigneeName || params.assigneeId) {
        const assigneePropDef = findPropDef("Assignee");
        if (assigneePropDef) {
          const assigneeFilter = normalizeArrayFilter(params.assigneeId);
          if (assigneeFilter) {
            const taskIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "task",
              assigneePropDef.id,
              "id",
              assigneeFilter
            );
            matchingTaskIds = intersectIds(matchingTaskIds, taskIds);
          }
          if (params.assigneeName) {
            const taskIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "task",
              assigneePropDef.id,
              "name",
              params.assigneeName
            );
            matchingTaskIds = intersectIds(matchingTaskIds, taskIds);
          }
        }
      }

      // Filter by tags (via entity_properties)
      if (params.tagName || params.tagId) {
        const tagsPropDef = findPropDef("Tags");
        if (tagsPropDef) {
          const tagFilter = normalizeArrayFilter(params.tagId);
          if (tagFilter) {
            const taskIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "task",
              tagsPropDef.id,
              "id",
              tagFilter
            );
            matchingTaskIds = intersectIds(matchingTaskIds, taskIds);
          }
          if (params.tagName) {
            const taskIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "task",
              tagsPropDef.id,
              "name",
              params.tagName
            );
            matchingTaskIds = intersectIds(matchingTaskIds, taskIds);
          }
        }
      }

      // Filter by status (via entity_properties)
      if (params.status) {
        const statusPropDef = findPropDef("Status");
        console.log("[searchTasks] Status filter - property def found:", !!statusPropDef);
        if (statusPropDef) {
          const statusFilter = normalizeArrayFilter(params.status);
          console.log("[searchTasks] Status filter values:", statusFilter);
          if (statusFilter) {
            // For status, we match by name (e.g., "todo", "in_progress", "done")
            // Pass all status values - matches any of them
            const taskIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "task",
              statusPropDef.id,
              "name",
              statusFilter
            );
            console.log("[searchTasks] Status filter - matching task IDs count:", taskIds.length);
            matchingTaskIds = intersectIds(matchingTaskIds, taskIds);
          }
        }
      }

      // Filter by priority (via entity_properties)
      if (params.priority) {
        const priorityPropDef = findPropDef("Priority");
        if (priorityPropDef) {
          const priorityFilter = normalizeArrayFilter(params.priority);
          if (priorityFilter) {
            // Pass all priority values - matches any of them
            const taskIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "task",
              priorityPropDef.id,
              "name",
              priorityFilter
            );
            matchingTaskIds = intersectIds(matchingTaskIds, taskIds);
          }
        }
      }

      // If no tasks match the property filters, return empty result
      if (matchingTaskIds !== null && matchingTaskIds.length === 0) {
        return { data: [], error: null };
      }
    }

    // Filter by due date property if requested (matches "Due Date" property)
    if (params.dueDate) {
      const propDefs = await getPropertyDefinitionIds(supabase, workspaceId);
      const findPropDef = (name: string) =>
        propDefs.get(name) || propDefs.get(name.toLowerCase()) || propDefs.get(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());
      const dueDatePropDef = findPropDef("Due Date");
      if (dueDatePropDef) {
        dueDatePropertyIds = await getEntitiesWithDatePropertyFilter(
          supabase,
          workspaceId,
          "task",
          dueDatePropDef.id,
          params.dueDate
        );

        // CRITICAL FIX: Intersect with other property filters to maintain AND semantics
        // Without this, due date filter uses OR logic, returning tasks that match
        // due date OR other filters, instead of due date AND other filters
        if (matchingTaskIds !== null) {
          dueDatePropertyIds = intersectIds(matchingTaskIds, dueDatePropertyIds);
          // Update matchingTaskIds to include the due date filter
          matchingTaskIds = dueDatePropertyIds;
        }
      }
    }

    // Build the main query (no longer joining task_assignees or task_tag_links)
    let query = supabase
      .from("task_items")
      .select(`
        id, title, description, status, priority, due_date, start_date, source_task_id,
        workspace_id, project_id, tab_id, task_block_id, created_at, updated_at,
        projects(name),
        tabs(name)
      `)
      .eq("workspace_id", workspaceId);

    if (!params.includeWorkflowRepresentations) {
      query = query.is("source_task_id", null);
    }

    // Apply entity ID filter from property pre-filtering
    if (matchingTaskIds !== null) {
      query = query.in("id", matchingTaskIds);
    }

    // Apply text search filter (search both title and description)
    if (params.searchText) {
      const text = params.searchText;
      query = query.or(buildOrIlikeFilter(["title", "description"], text));
    }

    // Apply date filters (column-based)
    query = applyDateFilter(query, "due_date", params.dueDate);
    query = applyDateFilter(query, "start_date", params.startDate);
    query = applyDateFilter(query, "created_at", params.createdAt);
    query = applyDateFilter(query, "updated_at", params.updatedAt);

    // Apply project filter
    const projectFilter = normalizeArrayFilter(params.projectId);
    if (projectFilter) {
      query = query.in("project_id", projectFilter);
    }

    // Apply tab filter
    const tabFilter = normalizeArrayFilter(params.tabId);
    if (tabFilter) {
      query = query.in("tab_id", tabFilter);
    }

    // Execute the query (column-based due date filter)
    const baseFetchLimit = dueDatePropertyIds && dueDatePropertyIds.length > 0 ? limit * 2 : limit;
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(baseFetchLimit);

    if (error) {
      console.error("searchTasks error:", error);
      return { data: null, error: error.message };
    }

    let tasks: Array<Record<string, unknown>> = (data ?? []) as Array<Record<string, unknown>>;

    // If due date property matches exist, fetch those too (OR logic with column filter)
    if (dueDatePropertyIds && dueDatePropertyIds.length > 0) {
      const dueDateMatchIds = matchingTaskIds
        ? intersectIds(matchingTaskIds, dueDatePropertyIds)
        : dueDatePropertyIds;

      if (dueDateMatchIds.length > 0) {
        let dueDateQuery = supabase
          .from("task_items")
          .select(`
            id, title, description, status, priority, due_date, start_date, source_task_id,
            workspace_id, project_id, tab_id, task_block_id, created_at, updated_at,
            projects(name),
            tabs(name)
          `)
          .eq("workspace_id", workspaceId)
          .in("id", dueDateMatchIds);

        if (!params.includeWorkflowRepresentations) {
          dueDateQuery = dueDateQuery.is("source_task_id", null);
        }

        if (params.searchText) {
          const text = params.searchText;
          dueDateQuery = dueDateQuery.or(buildOrIlikeFilter(["title", "description"], text));
        }

        const projectFilter = normalizeArrayFilter(params.projectId);
        if (projectFilter) {
          dueDateQuery = dueDateQuery.in("project_id", projectFilter);
        }

        const tabFilter = normalizeArrayFilter(params.tabId);
        if (tabFilter) {
          dueDateQuery = dueDateQuery.in("tab_id", tabFilter);
        }

        dueDateQuery = applyDateFilter(dueDateQuery, "start_date", params.startDate);
        dueDateQuery = applyDateFilter(dueDateQuery, "created_at", params.createdAt);
        dueDateQuery = applyDateFilter(dueDateQuery, "updated_at", params.updatedAt);

        const { data: dueDateData } = await dueDateQuery
          .order("updated_at", { ascending: false })
          .limit(baseFetchLimit);

        tasks = [...tasks, ...((dueDateData ?? []) as Array<Record<string, unknown>>)];
      }
    }

    // De-dupe and trim
    const taskMap = new Map<string, Record<string, unknown>>();
    for (const task of tasks) {
      taskMap.set(task.id as string, task);
    }
    tasks = Array.from(taskMap.values())
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, limit);

    // Enrich tasks with properties from entity_properties
    const taskIds = tasks.map((t: Record<string, unknown>) => t.id as string);
    const propertiesMap = await enrichEntitiesWithProperties(supabase, workspaceId, "task", taskIds);

    // Map to clean results with properties from entity_properties
    const mapped: TaskResult[] = tasks.map((task: Record<string, unknown>) => {
      const project = coerceRelation<{ name: string }>(task.projects);
      const tab = coerceRelation<{ name: string }>(task.tabs);
      const props = propertiesMap.get(task.id as string) ?? [];

      // Extract properties by name
      const assigneeProp = props.find((p) => p.name === "Assignee");
      const tagsProp = props.find((p) => p.name === "Tags");
      const statusProp = props.find((p) => p.name === "Status");
      const priorityProp = props.find((p) => p.name === "Priority");
      const dueDateProp = props.find((p) => p.name === "Due Date");

      // Parse assignee (person type: single { id, name } or array for multiple)
      const assignees = parseAssigneeValue(assigneeProp?.value);

      // Parse tags (multi_select type: strings or objects)
      const tags = normalizeTagsValue(tagsProp?.value);

      // Parse status (select type: string/object)
      const rawStatus = normalizeSelectValue(statusProp?.value) ?? (typeof task.status === "string" ? task.status : null);
      const status = normalizeStatusValue(rawStatus) ?? "todo";

      // Parse priority (select type: string/object)
      const rawPriority = normalizeSelectValue(priorityProp?.value) ?? (typeof task.priority === "string" ? task.priority : null);
      const normalizedPriority = normalizePriorityValue(rawPriority);
      const priority = normalizedPriority === "none" ? null : normalizedPriority;

      // Parse due date (date type: string/object)
      const dueDate = normalizeDateValue(dueDateProp?.value) ?? (task.due_date as string | null);

      return {
        id: task.id as string,
        title: task.title as string,
        status,
        priority,
        description: task.description as string | null,
        due_date: dueDate,
        start_date: task.start_date as string | null,
        workspace_id: task.workspace_id as string,
        project_id: task.project_id as string | null,
        project_name: project?.name ?? null,
        tab_id: task.tab_id as string | null,
        tab_name: tab?.name ?? null,
        task_block_id: task.task_block_id as string,
        assignees,
        tags,
        created_at: task.created_at as string,
        updated_at: task.updated_at as string,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchTasks exception:", err);
    return { data: null, error: "Failed to search tasks" };
  }
}

/**
 * Search for subtasks (checklist items) in the current workspace.
 * Returns subtasks with their parent task, project, and tab context.
 *
 * @param params.searchText - Fuzzy search on subtask title and description
 * @param params.completed - Filter by completion status
 * @param params.taskId - Filter by parent task ID
 * @param params.taskTitle - Filter by parent task title (partial match)
 * @param params.projectId - Filter by project ID (via parent task)
 * @param params.tabId - Filter by tab ID (via parent task)
 * @param params.limit - Maximum results (default 50)
 */
export async function searchSubtasks(params: {
  searchText?: string;
  completed?: boolean;
  taskId?: string | string[];
  taskTitle?: string;
  projectId?: string | string[];
  tabId?: string | string[];
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<SubtaskResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("task_subtasks")
      .select(
        `
        id,
        title,
        description,
        completed,
        display_order,
        task_id,
        created_at,
        updated_at,
        task_items!inner(
          id,
          title,
          workspace_id,
          project_id,
          tab_id,
          projects(name),
          tabs(name)
        )
      `
      )
      .eq("task_items.workspace_id", workspaceId);

    if (params.searchText) {
      query = query.or(buildOrIlikeFilter(["title", "description"], params.searchText));
    }

    if (params.completed !== undefined) {
      query = query.eq("completed", params.completed);
    }

    const taskIds = normalizeArrayFilter(params.taskId);
    if (taskIds && taskIds.length > 0) {
      query = query.in("task_id", taskIds);
    }

    const projectIds = normalizeArrayFilter(params.projectId);
    if (projectIds && projectIds.length > 0) {
      query = query.in("task_items.project_id", projectIds);
    }

    const tabIds = normalizeArrayFilter(params.tabId);
    if (tabIds && tabIds.length > 0) {
      query = query.in("task_items.tab_id", tabIds);
    }

    if (params.taskTitle) {
      query = query.ilike("task_items.title", `%${params.taskTitle}%`);
    }

    const { data, error } = await query
      .order("display_order", { ascending: true })
      .limit(limit);

    if (error) return { data: null, error: error.message ?? "Failed to search subtasks" };

    const results: SubtaskResult[] = (data ?? []).map((row: any) => {
      const task = coerceRelation<{
        title?: string;
        project_id?: string | null;
        tab_id?: string | null;
        projects?: unknown;
        tabs?: unknown;
      }>(row.task_items);
      const project = coerceRelation<{ name?: string }>(task?.projects);
      const tab = coerceRelation<{ name?: string }>(task?.tabs);

      return {
        id: row.id,
        title: row.title,
        description: row.description ?? null,
        completed: Boolean(row.completed),
        display_order: row.display_order ?? 0,
        task_id: row.task_id,
        task_title: task?.title ?? null,
        project_id: task?.project_id ?? null,
        project_name: project?.name ?? null,
        tab_id: task?.tab_id ?? null,
        tab_name: tab?.name ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return { data: results, error: null };
  } catch (err) {
    console.error("searchSubtasks exception:", err);
    return { data: null, error: "Failed to search subtasks" };
  }
}

/**
 * Get full details for a single subtask by ID.
 * Returns subtask data with parent task context and optional properties.
 *
 * @param params.subtaskId - The subtask ID to fetch
 * @param params.includeProperties - Include entity_properties (default true)
 */
export async function getSubtaskDetails(params: {
  subtaskId?: string;
  taskId?: string;
  subtaskTitle?: string;
  includeProperties?: boolean;
  authContext?: AuthContext;
}): Promise<{ data: SubtaskDetailsResult | null; error: string | null }> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const includeProperties = params.includeProperties ?? true;

  try {
    if (!params.subtaskId && (!params.taskId || !params.subtaskTitle)) {
      return { data: null, error: "Provide subtaskId or (taskId + subtaskTitle)." };
    }

    let subtaskData: any | null = null;

    if (params.subtaskId) {
      const { data, error } = await supabase
        .from("task_subtasks")
        .select(
          `
          id,
          title,
          description,
          completed,
          display_order,
          task_id,
          created_at,
          updated_at,
          task_items!inner(
            id,
            title,
            workspace_id,
            project_id,
            tab_id,
            projects(name),
            tabs(name)
          )
        `
        )
        .eq("task_items.workspace_id", workspaceId)
        .eq("id", params.subtaskId)
        .single();

      if (error || !data) return { data: null, error: error?.message ?? "Subtask not found" };
      subtaskData = data;
    } else if (params.taskId && params.subtaskTitle) {
      const { data, error } = await supabase
        .from("task_subtasks")
        .select(
          `
          id,
          title,
          description,
          completed,
          display_order,
          task_id,
          created_at,
          updated_at,
          task_items!inner(
            id,
            title,
            workspace_id,
            project_id,
            tab_id,
            projects(name),
            tabs(name)
          )
        `
        )
        .eq("task_items.workspace_id", workspaceId)
        .eq("task_id", params.taskId)
        .ilike("title", `%${params.subtaskTitle}%`);

      if (error) return { data: null, error: error.message ?? "Failed to find subtask" };

      const matches = (data ?? []) as any[];
      if (matches.length === 0) {
        return { data: null, error: "Subtask not found for the provided taskId and title." };
      }

      const normalizedTitle = params.subtaskTitle.trim().toLowerCase();
      const exactMatches = matches.filter((row) => String(row.title ?? "").toLowerCase() === normalizedTitle);
      const candidateMatches = exactMatches.length > 0 ? exactMatches : matches;

      if (candidateMatches.length > 1) {
        const titles = candidateMatches
          .slice(0, 5)
          .map((row) => `- ${row.title} (${row.id})`)
          .join("\n");
        return {
          data: null,
          error:
            "Multiple subtasks match that title. Please specify the exact subtask ID or a more specific title.\n" +
            titles,
        };
      }

      subtaskData = candidateMatches[0];
    }

    if (!subtaskData) return { data: null, error: "Subtask not found" };

    const task = coerceRelation<{
      title?: string;
      project_id?: string | null;
      tab_id?: string | null;
      projects?: unknown;
      tabs?: unknown;
    }>(subtaskData.task_items);
    const project = coerceRelation<{ name?: string }>(task?.projects);
    const tab = coerceRelation<{ name?: string }>(task?.tabs);

    const result: SubtaskDetailsResult = {
      id: subtaskData.id,
      title: subtaskData.title,
      description: subtaskData.description ?? null,
      completed: Boolean(subtaskData.completed),
      display_order: subtaskData.display_order ?? 0,
      task_id: subtaskData.task_id,
      task_title: task?.title ?? null,
      project_id: task?.project_id ?? null,
      project_name: project?.name ?? null,
      tab_id: task?.tab_id ?? null,
      tab_name: tab?.name ?? null,
      created_at: subtaskData.created_at,
      updated_at: subtaskData.updated_at,
    };

    if (includeProperties) {
      const propertiesMap = await enrichEntitiesWithProperties(supabase, workspaceId, "subtask", [subtaskData.id]);
      result.properties = propertiesMap.get(subtaskData.id) ?? [];
    }

    return { data: result, error: null };
  } catch (err) {
    console.error("getSubtaskDetails exception:", err);
    return { data: null, error: "Failed to get subtask details" };
  }
}

/**
 * Search for projects in the current workspace.
 * Returns projects with their client name.
 *
 * @param params.searchText - Fuzzy search on project name
 * @param params.status - Filter by status (not_started, in_progress, complete)
 * @param params.projectType - Filter by type (project, internal)
 * @param params.clientId - Filter by client ID
 * @param params.dueDate - Date filter for due_date_date
 * @param params.limit - Maximum results (default 50)
 */
export async function searchProjects(params: {
  searchText?: string;
  status?: string | string[];
  projectType?: string | string[];
  clientId?: string | string[];
  dueDate?: DateFilter;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<ProjectResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("projects")
      .select(`
        id, name, status, project_type, workspace_id, client_id,
        due_date_date, due_date_text, created_at, updated_at,
        clients(name)
      `)
      .eq("workspace_id", workspaceId);

    if (params.searchText) {
      query = query.ilike("name", `%${params.searchText}%`);
    }

    const statusFilter = normalizeArrayFilter(params.status);
    if (statusFilter) {
      query = query.in("status", statusFilter);
    }

    const typeFilter = normalizeArrayFilter(params.projectType);
    if (typeFilter) {
      query = query.in("project_type", typeFilter);
    }

    const clientFilter = normalizeArrayFilter(params.clientId);
    if (clientFilter) {
      query = query.in("client_id", clientFilter);
    }

    query = applyDateFilter(query, "due_date_date", params.dueDate);

    const { data, error } = await query.order("updated_at", { ascending: false }).limit(limit);

    if (error) {
      console.error("searchProjects error:", error);
      return { data: null, error: error.message };
    }

    const mapped: ProjectResult[] = (data ?? []).map((p: Record<string, unknown>) => {
      const client = coerceRelation<{ name: string }>(p.clients);
      return {
        id: p.id as string,
        name: p.name as string,
        status: p.status as string,
        project_type: p.project_type as string,
        workspace_id: p.workspace_id as string,
        client_id: p.client_id as string | null,
        client_name: client?.name ?? null,
        due_date_date: p.due_date_date as string | null,
        due_date_text: p.due_date_text as string | null,
        created_at: p.created_at as string,
        updated_at: p.updated_at as string,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchProjects exception:", err);
    return { data: null, error: "Failed to search projects" };
  }
}

/**
 * Search for clients in the current workspace.
 *
 * @param params.searchText - Fuzzy search on name, email, company
 * @param params.limit - Maximum results (default 50)
 */
export async function searchClients(params: {
  searchText?: string;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<ClientResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("clients")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (params.searchText) {
      const text = params.searchText;
      query = query.or(buildOrIlikeFilter(["name", "email", "company"], text));
    }

    const { data, error } = await query.order("name").limit(limit);

    if (error) {
      console.error("searchClients error:", error);
      return { data: null, error: error.message };
    }

    return { data: data as ClientResult[], error: null };
  } catch (err) {
    console.error("searchClients exception:", err);
    return { data: null, error: "Failed to search clients" };
  }
}

/** Cache workspace members per workspace to speed up assignee resolution (TTL 60s). */
const workspaceMembersCache = new Map<
  string,
  { results: WorkspaceMemberResult[]; ts: number }
>();
const WORKSPACE_MEMBERS_CACHE_TTL_MS = 60_000;

/**
 * Search for workspace members.
 * Returns members with their profile information (name, email).
 *
 * @param params.searchText - Fuzzy search on name or email
 * @param params.role - Filter by role (owner, admin, teammate)
 * @param params.limit - Maximum results (default 20)
 * @param opts.ctx - Pre-obtained search context to avoid duplicate getSearchContext
 */
export async function searchWorkspaceMembers(
  params: {
    searchText?: string;
    role?: string | string[];
    limit?: number;
  },
  opts?: { ctx?: SearchContextSuccess }
): Promise<SearchResponse<WorkspaceMemberResult>> {
  const ctx = opts?.ctx ?? (await getSearchContext());
  if ("error" in ctx && ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  if (!supabase) return { data: null, error: "Not authenticated" };
  const limit = params.limit ?? 20;

  const cacheKey = workspaceId + (normalizeArrayFilter(params.role)?.join(",") ?? "");
  const cached = workspaceMembersCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < WORKSPACE_MEMBERS_CACHE_TTL_MS) {
    let results = cached.results;
    if (params.searchText) {
      const text = params.searchText.toLowerCase();
      results = results.filter(
        (m) =>
          m.name?.toLowerCase().includes(text) ||
          m.email.toLowerCase().includes(text)
      );
    }
    return { data: results.slice(0, limit), error: null };
  }

  try {
    // Get members
    let memberQuery = supabase
      .from("workspace_members")
      .select("id, user_id, role, workspace_id, created_at")
      .eq("workspace_id", workspaceId);

    const roleFilter = normalizeArrayFilter(params.role);
    if (roleFilter) {
      memberQuery = memberQuery.in("role", roleFilter);
    }

    const { data: members, error: membersError } = await memberQuery.limit(limit);

    if (membersError) {
      console.error("searchWorkspaceMembers error:", membersError);
      return { data: null, error: membersError.message };
    }

    if (!members || members.length === 0) {
      return { data: [], error: null };
    }

    // Get profiles for members
    const userIds = members.map((m) => m.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);

    if (profilesError) {
      console.error("searchWorkspaceMembers profiles error:", profilesError);
      return { data: null, error: profilesError.message };
    }

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    // Combine and filter
    let results: WorkspaceMemberResult[] = members.map((m) => {
      const profile = profileMap.get(m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        name: profile?.name ?? null,
        email: profile?.email ?? "",
        workspace_id: m.workspace_id,
        created_at: m.created_at,
      };
    });

    workspaceMembersCache.set(cacheKey, { results, ts: Date.now() });

    // Filter by search text if provided
    if (params.searchText) {
      const text = params.searchText.toLowerCase();
      results = results.filter(
        (m) =>
          m.name?.toLowerCase().includes(text) ||
          m.email.toLowerCase().includes(text)
      );
    }

    return { data: results.slice(0, limit), error: null };
  } catch (err) {
    console.error("searchWorkspaceMembers exception:", err);
    return { data: null, error: "Failed to search workspace members" };
  }
}

/**
 * Search for tabs in the current workspace.
 * Returns tabs with their project name.
 *
 * @param params.searchText - Fuzzy search on tab name
 * @param params.projectId - Filter by project ID
 * @param params.isClientVisible - Filter by client visibility
 * @param params.limit - Maximum results (default 50)
 */
export async function searchTabs(params: {
  searchText?: string;
  projectId?: string | string[];
  isClientVisible?: boolean;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<TabResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("tabs")
      .select(`
        id, name, position, project_id, parent_tab_id, is_client_visible, created_at,
        projects!inner(workspace_id, name)
      `)
      .eq("projects.workspace_id", workspaceId);

    if (params.searchText) {
      query = query.ilike("name", `%${params.searchText}%`);
    }

    const projectFilter = normalizeArrayFilter(params.projectId);
    if (projectFilter) {
      query = query.in("project_id", projectFilter);
    }

    if (params.isClientVisible !== undefined) {
      query = query.eq("is_client_visible", params.isClientVisible);
    }

    const { data, error } = await query.order("position").limit(limit);

    if (error) {
      console.error("searchTabs error:", error);
      return { data: null, error: error.message };
    }

    const mapped: TabResult[] = (data ?? []).map((t: Record<string, unknown>) => {
      const project = coerceRelation<{ name: string }>(t.projects);
      return {
        id: t.id as string,
        name: t.name as string,
        position: t.position as number,
        project_id: t.project_id as string,
        project_name: project?.name ?? null,
        parent_tab_id: t.parent_tab_id as string | null,
        is_client_visible: t.is_client_visible as boolean,
        created_at: t.created_at as string,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchTabs exception:", err);
    return { data: null, error: "Failed to search tabs" };
  }
}

/**
 * Search for blocks in the current workspace.
 * Returns blocks with their tab and project information.
 *
 * @param params.searchText - Fuzzy search on block content (JSON text)
 * @param params.type - Filter by block type
 * @param params.projectId - Filter by project ID
 * @param params.tabId - Filter by tab ID
 * @param params.isTemplate - Filter by template status
 * @param params.limit - Maximum results (default 50)
 * @param opts.ctx - Pre-obtained search context to avoid duplicate getSearchContext
 */
export async function searchBlocks(
  params: {
    searchText?: string;
    type?: string | string[];
    projectId?: string | string[];
    projectName?: string; // Search by project name
    tabId?: string | string[];
    isTemplate?: boolean;
    // Property filters via entity_properties
    assigneeId?: string | string[];
    assigneeName?: string;
    tagId?: string | string[];
    tagName?: string;
    status?: string | string[];
    priority?: string | string[];
    limit?: number;
  },
  opts?: { ctx?: SearchContextSuccess }
): Promise<SearchResponse<BlockResult>> {
  const ctx = opts?.ctx ?? (await getSearchContext());
  if ("error" in ctx && ctx.error !== null) return { data: null, error: ctx.error };

  // After error check, supabase and workspaceId are guaranteed to be defined
  const supabase = ctx.supabase!;
  const workspaceId = ctx.workspaceId!;
  const limit = params.limit ?? 50;

  try {
    // Determine if we need property-based filtering
    const hasPropertyFilters = !!(
      params.assigneeId ||
      params.assigneeName ||
      params.tagId ||
      params.tagName ||
      params.status ||
      params.priority
    );

    let matchingBlockIds: string[] | null = null;

    // Pre-filter by entity_properties if property filters are specified
    if (hasPropertyFilters) {
      const propDefs = await getPropertyDefinitionIds(supabase, workspaceId);

      // Helper to find property definition case-insensitively
      const findPropDef = (name: string) =>
        propDefs.get(name) || propDefs.get(name.toLowerCase()) || propDefs.get(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());

      // Filter by assignee (via entity_properties)
      if (params.assigneeName || params.assigneeId) {
        const assigneePropDef = findPropDef("Assignee");
        if (assigneePropDef) {
          const assigneeFilter = normalizeArrayFilter(params.assigneeId);
          if (assigneeFilter) {
            const blockIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "block",
              assigneePropDef.id,
              "id",
              assigneeFilter
            );
            matchingBlockIds = intersectIds(matchingBlockIds, blockIds);
          }
          if (params.assigneeName) {
            const blockIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "block",
              assigneePropDef.id,
              "name",
              params.assigneeName
            );
            matchingBlockIds = intersectIds(matchingBlockIds, blockIds);
          }
        }
      }

      // Filter by tags (via entity_properties)
      if (params.tagName || params.tagId) {
        const tagsPropDef = findPropDef("Tags");
        if (tagsPropDef) {
          const tagFilter = normalizeArrayFilter(params.tagId);
          if (tagFilter) {
            const blockIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "block",
              tagsPropDef.id,
              "id",
              tagFilter
            );
            matchingBlockIds = intersectIds(matchingBlockIds, blockIds);
          }
          if (params.tagName) {
            const blockIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "block",
              tagsPropDef.id,
              "name",
              params.tagName
            );
            matchingBlockIds = intersectIds(matchingBlockIds, blockIds);
          }
        }
      }

      // Filter by status (via entity_properties)
      if (params.status) {
        const statusPropDef = findPropDef("Status");
        if (statusPropDef) {
          const statusFilter = normalizeArrayFilter(params.status);
          if (statusFilter) {
            // For status, we match by name (e.g., "todo", "in_progress", "done")
            // Pass all status values - matches any of them
            const blockIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "block",
              statusPropDef.id,
              "name",
              statusFilter
            );
            matchingBlockIds = intersectIds(matchingBlockIds, blockIds);
          }
        }
      }

      // Filter by priority (via entity_properties)
      if (params.priority) {
        const priorityPropDef = findPropDef("Priority");
        if (priorityPropDef) {
          const priorityFilter = normalizeArrayFilter(params.priority);
          if (priorityFilter) {
            // Pass all priority values - matches any of them
            const blockIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "block",
              priorityPropDef.id,
              "name",
              priorityFilter
            );
            matchingBlockIds = intersectIds(matchingBlockIds, blockIds);
          }
        }
      }

      // If no blocks match the property filters, return empty result
      if (matchingBlockIds !== null && matchingBlockIds.length === 0) {
        return { data: [], error: null };
      }
    }

    // Determine if we need post-query filtering for project
    const projectFilter = normalizeArrayFilter(params.projectId);
    const searchLower = params.searchText?.trim().toLowerCase();
    const hasPostFilters = !!(projectFilter || params.projectName || searchLower);
    const fetchLimit = hasPostFilters ? limit * 10 : limit;

    let query = supabase
      .from("blocks")
      .select(`
        id, type, content, position, column, tab_id, parent_block_id,
        is_template, template_name, created_at, updated_at,
        tabs!inner(name, project_id, projects!inner(workspace_id, name))
      `)
      .eq("tabs.projects.workspace_id", workspaceId);

    // Apply entity ID filter from property pre-filtering
    if (matchingBlockIds !== null) {
      query = query.in("id", matchingBlockIds);
    }

    const typeFilter = normalizeArrayFilter(params.type);
    if (typeFilter) {
      query = query.in("type", typeFilter);
    }

    const tabFilter = normalizeArrayFilter(params.tabId);
    if (tabFilter) {
      query = query.in("tab_id", tabFilter);
    }

    if (params.isTemplate !== undefined) {
      query = query.eq("is_template", params.isTemplate);
    }

    const { data, error } = await query.order("updated_at", { ascending: false }).limit(fetchLimit);

    if (error) {
      console.error("searchBlocks error:", error);
      return { data: null, error: error.message };
    }

    let results = data ?? [];

    // Filter by project ID if specified
    if (projectFilter) {
      results = results.filter((b: Record<string, unknown>) => {
        const tabs = coerceRelation<{ project_id: string }>(b.tabs);
        return tabs && projectFilter.includes(tabs.project_id);
      });
    }

    // Filter by project name if specified (fuzzy match)
    if (params.projectName) {
      const searchName = params.projectName.toLowerCase();
      results = results.filter((b: Record<string, unknown>) => {
        const tabs = coerceRelation<{ projects: { name: string } | null }>(b.tabs);
        return tabs?.projects?.name.toLowerCase().includes(searchName);
      });
    }

    // Filter block JSON content in JS to avoid unsupported jsonb ILIKE in SQL.
    if (searchLower) {
      results = results.filter((b: Record<string, unknown>) =>
        toSearchableText(b.content).toLowerCase().includes(searchLower)
      );
    }

    // Trim to requested limit after filtering
    results = results.slice(0, limit);

    // Enrich blocks with properties from entity_properties
    const blockIds = results.map((b: Record<string, unknown>) => b.id as string);
    const propertiesMap = await enrichEntitiesWithProperties(supabase, workspaceId, "block", blockIds);

    const mapped: BlockResult[] = results.map((b: Record<string, unknown>) => {
      const tabs = coerceRelation<{ name: string; project_id: string; projects: { name: string } | null }>(b.tabs);
      const props = propertiesMap.get(b.id as string) ?? [];

      // Extract properties by name
      const assigneeProp = props.find((p) => p.name === "Assignee");
      const tagsProp = props.find((p) => p.name === "Tags");
      const statusProp = props.find((p) => p.name === "Status");
      const priorityProp = props.find((p) => p.name === "Priority");
      const dueDateProp = props.find((p) => p.name === "Due Date");

      // Parse assignee (person type: single or array)
      const assignees = parseAssigneeValue(assigneeProp?.value);

      // Parse tags (multi_select type: strings or objects)
      const tags = normalizeTagsValue(tagsProp?.value);

      // Parse status and priority (select type: string/object)
      const status = normalizeStatusValue(normalizeSelectValue(statusProp?.value));
      const priority = normalizePriorityValue(normalizeSelectValue(priorityProp?.value));
      const dueDate = normalizeDateValue(dueDateProp?.value);

      return {
        id: b.id as string,
        type: b.type as string,
        content: b.content as Record<string, unknown>,
        position: b.position as number,
        column: b.column as number,
        tab_id: b.tab_id as string,
        tab_name: tabs?.name ?? null,
        project_id: tabs?.project_id ?? null,
        project_name: tabs?.projects?.name ?? null,
        parent_block_id: b.parent_block_id as string | null,
        is_template: b.is_template as boolean,
        template_name: b.template_name as string | null,
        created_at: b.created_at as string,
        updated_at: b.updated_at as string,
        assignees,
        tags,
        status,
        priority,
        due_date: dueDate,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchBlocks exception:", err);
    return { data: null, error: "Failed to search blocks" };
  }
}

/**
 * Search for documents in the current workspace.
 * Supports searching both title and content.
 *
 * @param params.searchText - Fuzzy search on document title
 * @param params.contentSearch - Fuzzy search on document content (searches JSON text)
 * @param params.searchBoth - If true, searches both title and content with searchText
 * @param params.isArchived - Filter by archived status
 * @param params.createdBy - Filter by creator user ID
 * @param params.limit - Maximum results (default 50)
 */
export async function searchDocs(params: {
  searchText?: string;
  contentSearch?: string;
  searchBoth?: boolean; // NEW: Search both title and content with searchText
  isArchived?: boolean;
  createdBy?: string;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<DocResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;
  const shouldSearchBoth = !!(params.searchBoth && params.searchText);
  const shouldSearchContentOnly = !!params.contentSearch;
  const needsContentPostFilter = shouldSearchBoth || shouldSearchContentOnly;
  const fetchLimit = needsContentPostFilter ? limit * 10 : limit;

  try {
    let query = supabase
      .from("docs")
      .select("*")
      .eq("workspace_id", workspaceId);

    // SQL-filter only when title-only search is requested.
    if (!needsContentPostFilter && params.searchText) {
      query = query.ilike("title", `%${params.searchText}%`);
    }

    if (params.isArchived !== undefined) {
      query = query.eq("is_archived", params.isArchived);
    }

    if (params.createdBy) {
      query = query.eq("created_by", params.createdBy);
    }

    const { data, error } = await query.order("updated_at", { ascending: false }).limit(fetchLimit);

    if (error) {
      console.error("searchDocs error:", error);
      return { data: null, error: error.message };
    }

    let filteredDocs = data ?? [];
    if (needsContentPostFilter) {
      const titleSearch = params.searchText?.toLowerCase();
      const contentSearch = (params.contentSearch ?? params.searchText)?.toLowerCase();
      filteredDocs = filteredDocs.filter((d) => {
        const titleMatch = titleSearch ? (d.title ?? "").toLowerCase().includes(titleSearch) : false;
        const contentMatch = contentSearch
          ? toSearchableText(d.content).toLowerCase().includes(contentSearch)
          : false;
        return shouldSearchBoth ? (titleMatch || contentMatch) : contentMatch;
      });
    }
    filteredDocs = filteredDocs.slice(0, limit);

    // Get creator names
    const creatorIds = [...new Set(filteredDocs.map((d) => d.created_by))];
    const { data: profiles } = creatorIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", creatorIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    const mapped: DocResult[] = filteredDocs.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      workspace_id: d.workspace_id,
      created_by: d.created_by,
      created_by_name: profileMap.get(d.created_by) ?? null,
      is_archived: d.is_archived,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchDocs exception:", err);
    return { data: null, error: "Failed to search docs" };
  }
}

/**
 * Search for specific content within a document and return snippets.
 * Useful for finding specific sections without loading entire doc content.
 *
 * @param params.docId - The document ID
 * @param params.searchText - Text to search for within the document
 * @param params.snippetLength - Length of context around matches (default 100 chars)
 */
export async function searchDocContent(params: {
  docId: string;
  searchText: string;
  snippetLength?: number;
  authContext?: AuthContext;
}): Promise<{ data: { found: boolean; snippets: string[]; matchCount: number } | null; error: string | null }> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const snippetLength = params.snippetLength ?? 100;

  try {
    const { data: doc, error } = await supabase
      .from("docs")
      .select("content")
      .eq("id", params.docId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !doc) {
      return { data: null, error: error?.message ?? "Document not found" };
    }

    // Extract text content from ProseMirror JSON
    const contentText = extractTextFromContent(doc.content);
    const searchLower = params.searchText.toLowerCase();
    const contentLower = contentText.toLowerCase();

    const snippets: string[] = [];
    let matchCount = 0;
    let searchStart = 0;

    // Find all occurrences and extract snippets
    while (true) {
      const matchIndex = contentLower.indexOf(searchLower, searchStart);
      if (matchIndex === -1) break;

      matchCount++;
      const snippetStart = Math.max(0, matchIndex - snippetLength);
      const snippetEnd = Math.min(contentText.length, matchIndex + params.searchText.length + snippetLength);

      let snippet = contentText.slice(snippetStart, snippetEnd);
      if (snippetStart > 0) snippet = "..." + snippet;
      if (snippetEnd < contentText.length) snippet = snippet + "...";

      snippets.push(snippet);
      searchStart = matchIndex + 1;

      // Limit to 10 snippets
      if (snippets.length >= 10) break;
    }

    return {
      data: {
        found: matchCount > 0,
        snippets,
        matchCount,
      },
      error: null,
    };
  } catch (err) {
    console.error("searchDocContent exception:", err);
    return { data: null, error: "Failed to search document content" };
  }
}

/**
 * Extracts plain text from ProseMirror JSON content.
 */
function extractTextFromContent(content: unknown): string {
  if (!content || typeof content !== "object") return "";

  const textParts: string[] = [];

  function traverse(node: unknown): void {
    if (!node || typeof node !== "object") return;

    const n = node as Record<string, unknown>;

    // Extract text from text nodes
    if (n.type === "text" && typeof n.text === "string") {
      textParts.push(n.text);
    }

    // Recursively process content array
    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        traverse(child);
      }
    }
  }

  traverse(content);
  return textParts.join(" ");
}

/**
 * Search across all documents' content in the workspace.
 * Returns matching documents with their titles and content snippets.
 *
 * @param params.searchText - Text to search for within document content
 * @param params.isArchived - Filter by archived status (default: false)
 * @param params.snippetLength - Length of context around matches (default 100 chars)
 * @param params.maxSnippetsPerDoc - Maximum snippets per document (default 3)
 * @param params.limit - Maximum number of documents to return (default 20)
 */
export async function searchDocsContentAll(params: {
  searchText: string;
  isArchived?: boolean;
  snippetLength?: number;
  maxSnippetsPerDoc?: number;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<DocContentSearchResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const snippetLength = params.snippetLength ?? 100;
  const maxSnippetsPerDoc = params.maxSnippetsPerDoc ?? 3;
  const limit = params.limit ?? 20;
  const isArchived = params.isArchived ?? false;

  try {
    // Fetch all docs (with a reasonable limit for performance)
    const { data: docs, error } = await supabase
      .from("docs")
      .select("id, title, content, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", isArchived)
      .order("updated_at", { ascending: false })
      .limit(limit * 10);

    if (error) {
      console.error("searchDocsContentAll error:", error);
      return { data: null, error: error.message };
    }

    const searchLower = params.searchText.toLowerCase();
    const results: DocContentSearchResult[] = [];

    for (const doc of docs ?? []) {
      // Extract text content from ProseMirror JSON
      const contentText = extractTextFromContent(doc.content);
      const contentLower = contentText.toLowerCase();

      // Check if document contains the search text
      if (!contentLower.includes(searchLower)) {
        continue;
      }

      // Find all occurrences and extract snippets
      const snippets: string[] = [];
      let matchCount = 0;
      let searchStart = 0;

      while (true) {
        const matchIndex = contentLower.indexOf(searchLower, searchStart);
        if (matchIndex === -1) break;

        matchCount++;

        if (snippets.length < maxSnippetsPerDoc) {
          const snippetStart = Math.max(0, matchIndex - snippetLength);
          const snippetEnd = Math.min(contentText.length, matchIndex + params.searchText.length + snippetLength);

          let snippet = contentText.slice(snippetStart, snippetEnd);
          if (snippetStart > 0) snippet = "..." + snippet;
          if (snippetEnd < contentText.length) snippet = snippet + "...";

          snippets.push(snippet);
        }

        searchStart = matchIndex + 1;

        // Stop counting after 100 matches for performance
        if (matchCount >= 100) break;
      }

      results.push({
        id: doc.id,
        title: doc.title,
        snippets,
        match_count: matchCount,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      });

      // Stop once we have enough results
      if (results.length >= limit) break;
    }

    return { data: results, error: null };
  } catch (err) {
    console.error("searchDocsContentAll exception:", err);
    return { data: null, error: "Failed to search document content" };
  }
}

/**
 * Search for tables in the current workspace.
 * Returns tables with their project name.
 *
 * @param params.searchText - Fuzzy search on table title or description
 * @param params.projectId - Filter by project ID
 * @param params.limit - Maximum results (default 50)
 */
export async function searchTables(params: {
  searchText?: string;
  projectId?: string | string[];
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<TableResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("tables")
      .select(`
        id, title, description, icon, workspace_id, project_id, created_at, updated_at,
        projects(name)
      `)
      .eq("workspace_id", workspaceId);

    if (params.searchText) {
      const text = params.searchText;
      query = query.or(buildOrIlikeFilter(["title", "description"], text));
    }

    const projectFilter = normalizeArrayFilter(params.projectId);
    if (projectFilter) {
      query = query.in("project_id", projectFilter);
    }

    const { data, error } = await query.order("updated_at", { ascending: false }).limit(limit);

    if (error) {
      console.error("searchTables error:", error);
      return { data: null, error: error.message };
    }

    const mapped: TableResult[] = (data ?? []).map((t: Record<string, unknown>) => {
      const project = coerceRelation<{ name: string }>(t.projects);
      return {
        id: t.id as string,
        title: t.title as string,
        description: t.description as string | null,
        icon: t.icon as string | null,
        workspace_id: t.workspace_id as string,
        project_id: t.project_id as string | null,
        project_name: project?.name ?? null,
        created_at: t.created_at as string,
        updated_at: t.updated_at as string,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchTables exception:", err);
    return { data: null, error: "Failed to search tables" };
  }
}

/**
 * Search for table fields in the current workspace.
 *
 * @param params.searchText - Fuzzy search on field name
 * @param params.tableId - Filter by table ID
 * @param params.type - Filter by field type
 * @param params.limit - Maximum results (default 100)
 */
export async function searchTableFields(params: {
  searchText?: string;
  tableId?: string | string[];
  type?: string | string[];
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<TableFieldResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 100;

  try {
    let query = supabase
      .from("table_fields")
      .select(`
        id, name, type, config, order, is_primary, table_id, created_at,
        tables!inner(workspace_id, title)
      `)
      .eq("tables.workspace_id", workspaceId);

    if (params.searchText) {
      query = query.ilike("name", `%${params.searchText}%`);
    }

    const tableFilter = normalizeArrayFilter(params.tableId);
    if (tableFilter) {
      query = query.in("table_id", tableFilter);
    }

    const typeFilter = normalizeArrayFilter(params.type);
    if (typeFilter) {
      query = query.in("type", typeFilter);
    }

    const { data, error } = await query.order("order").limit(limit);

    if (error) {
      console.error("searchTableFields error:", error);
      return { data: null, error: error.message };
    }

    const mapped: TableFieldResult[] = (data ?? []).map((f: Record<string, unknown>) => {
      const tables = f.tables as { title: string } | null;
      return {
        id: f.id as string,
        name: f.name as string,
        type: f.type as string,
        config: f.config as Record<string, unknown>,
        order: f.order as number,
        is_primary: f.is_primary as boolean,
        table_id: f.table_id as string,
        table_title: tables?.title ?? null,
        created_at: f.created_at as string,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchTableFields exception:", err);
    return { data: null, error: "Failed to search table fields" };
  }
}

/**
 * Search for table views in the current workspace.
 * Returns views with their table context.
 *
 * @param params.searchText - Fuzzy search on view name
 * @param params.tableId - Filter by table ID
 * @param params.type - Filter by view type (grid, kanban, calendar, etc.)
 * @param params.limit - Maximum results (default 50)
 */
export async function searchTableViews(params: {
  searchText?: string;
  tableId?: string | string[];
  type?: string | string[];
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<TableViewResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("table_views")
      .select(`
        id, name, type, table_id, config, is_default, created_at,
        tables!inner(workspace_id, title)
      `)
      .eq("tables.workspace_id", workspaceId);

    if (params.searchText) {
      query = query.ilike("name", `%${params.searchText}%`);
    }

    const tableFilter = normalizeArrayFilter(params.tableId);
    if (tableFilter) {
      query = query.in("table_id", tableFilter);
    }

    const typeFilter = normalizeArrayFilter(params.type);
    if (typeFilter) {
      query = query.in("type", typeFilter);
    }

    const { data, error } = await query.order("created_at").limit(limit);

    if (error) {
      console.error("searchTableViews error:", error);
      return { data: null, error: error.message };
    }

    const mapped: TableViewResult[] = (data ?? []).map((v: Record<string, unknown>) => {
      const tables = v.tables as { title: string } | null;
      return {
        id: v.id as string,
        name: v.name as string,
        type: v.type as string,
        table_id: v.table_id as string,
        table_title: tables?.title ?? null,
        config: v.config as Record<string, unknown>,
        is_default: v.is_default as boolean,
        created_at: v.created_at as string,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchTableViews exception:", err);
    return { data: null, error: "Failed to search table views" };
  }
}

/**
 * Field filter with operator support for searchTableRows.
 */
interface FieldFilter {
  op: "eq" | "contains" | "gte" | "lte";
  value: string | number;
}

/**
 * Search for table rows in the current workspace.
 * Searches across all text values in the JSONB data column.
 * Returns rows with table and project context.
 *
 * @param params.searchText - Fuzzy search across row data values
 * @param params.tableId - Filter by table ID (recommended for efficient search)
 * @param params.projectId - Filter by project ID
 * @param params.fieldFilters - Filter by specific field values with operators { fieldId: { op, value } }
 * @param params.limit - Maximum results (default 50)
 */
export async function searchTableRows(params: {
  searchText?: string;
  tableId?: string | string[];
  projectId?: string | string[];
  fieldFilters?: Record<string, FieldFilter | string>; // Filter by field ID -> { op, value } or simple string (legacy)
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<TableRowResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  // Determine if we need post-query filtering
  const projectFilter = normalizeArrayFilter(params.projectId);
  const hasPostFilters = !!(projectFilter || params.fieldFilters || params.searchText);

  // Overfetch when post-filtering is needed
  const fetchLimit = hasPostFilters ? limit * 10 : limit;

  try {
    let query = supabase
      .from("table_rows")
      .select(`
        id, data, order, table_id, created_at, updated_at,
        tables!inner(workspace_id, title, project_id, projects(name))
      `)
      .eq("tables.workspace_id", workspaceId);

    const tableFilter = normalizeArrayFilter(params.tableId);
    if (tableFilter) {
      query = query.in("table_id", tableFilter);
    }

    const { data, error } = await query.order("order").limit(fetchLimit);

    if (error) {
      console.error("searchTableRows error:", error);
      return { data: null, error: error.message };
    }

    let results = data ?? [];

    // Filter by project if specified
    if (projectFilter) {
      results = results.filter((r: Record<string, unknown>) => {
        const tables = r.tables as { project_id: string | null } | null;
        return tables?.project_id && projectFilter.includes(tables.project_id);
      });
    }

    // Filter by specific field values if provided
    if (params.fieldFilters) {
      results = results.filter((r: Record<string, unknown>) => {
        const rowData = r.data as Record<string, unknown>;
        for (const [fieldId, filter] of Object.entries(params.fieldFilters!)) {
          const actualValue = rowData[fieldId];

          // Normalize filter to { op, value } format
          const normalizedFilter: FieldFilter =
            typeof filter === "string"
              ? { op: "contains", value: filter }
              : filter;

          const { op, value } = normalizedFilter;

          // Handle null/undefined actual values
          if (actualValue === null || actualValue === undefined) {
            if (op === "eq" && value === "") continue; // Empty equals empty
            return false;
          }

          switch (op) {
            case "eq": {
              // Exact equality
              if (typeof actualValue === "string" || typeof actualValue === "number") {
                if (actualValue !== value && String(actualValue) !== String(value)) {
                  return false;
                }
              } else if (Array.isArray(actualValue)) {
                // For arrays, check if any element equals the value
                if (!actualValue.some((v) => v === value || String(v) === String(value))) {
                  return false;
                }
              } else if (typeof actualValue === "object") {
                // For objects with name/id, check those properties
                const obj = actualValue as Record<string, unknown>;
                if (obj.name !== value && obj.id !== value) {
                  return false;
                }
              } else {
                return false;
              }
              break;
            }

            case "contains": {
              // String contains (case-insensitive)
              const searchValue = String(value).toLowerCase();
              if (typeof actualValue === "string") {
                if (!actualValue.toLowerCase().includes(searchValue)) {
                  return false;
                }
              } else if (Array.isArray(actualValue)) {
                if (!actualValue.some((v) => String(v).toLowerCase().includes(searchValue))) {
                  return false;
                }
              } else if (typeof actualValue === "object") {
                const obj = actualValue as Record<string, unknown>;
                const name = obj.name as string | undefined;
                if (!name?.toLowerCase().includes(searchValue)) {
                  return false;
                }
              } else {
                if (!String(actualValue).toLowerCase().includes(searchValue)) {
                  return false;
                }
              }
              break;
            }

            case "gte": {
              // Greater than or equal (numeric/date comparison)
              if (typeof actualValue === "number" && typeof value === "number") {
                if (actualValue < value) return false;
              } else if (typeof actualValue === "string") {
                // String comparison works for ISO date strings
                if (actualValue < String(value)) return false;
              } else {
                return false;
              }
              break;
            }

            case "lte": {
              // Less than or equal (numeric/date comparison)
              if (typeof actualValue === "number" && typeof value === "number") {
                if (actualValue > value) return false;
              } else if (typeof actualValue === "string") {
                if (actualValue > String(value)) return false;
              } else {
                return false;
              }
              break;
            }

            default:
              // Unknown operator, skip this filter
              break;
          }
        }
        return true;
      });
    }

    // Filter by search text across row data (post-query)
    if (params.searchText) {
      const searchLower = params.searchText.toLowerCase();
      results = results.filter((r: Record<string, unknown>) => {
        const rowData = r.data as Record<string, unknown>;
        return Object.values(rowData).some((value) => {
          if (value === null || value === undefined) return false;
          if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return String(value).toLowerCase().includes(searchLower);
          }
          if (Array.isArray(value)) {
            return value.some((v) => String(v).toLowerCase().includes(searchLower));
          }
          if (typeof value === "object") {
            try {
              return JSON.stringify(value).toLowerCase().includes(searchLower);
            } catch {
              return false;
            }
          }
          return false;
        });
      });
    }

    // Trim to requested limit after filtering
    results = results.slice(0, limit);

    const rowIds = results.map((r: Record<string, unknown>) => r.id as string);
    const propertiesMap = await enrichEntitiesWithProperties(supabase, workspaceId, "table_row", rowIds);

    const mapped: TableRowResult[] = results.map((r: Record<string, unknown>) => {
      const tables = r.tables as { title: string; project_id: string | null; projects: { name: string } | null } | null;
      const props = propertiesMap.get(r.id as string) ?? [];

      const assigneeProp = props.find((p) => p.name === "Assignee");
      const tagsProp = props.find((p) => p.name === "Tags");
      const statusProp = props.find((p) => p.name === "Status");
      const priorityProp = props.find((p) => p.name === "Priority");
      const dueDateProp = props.find((p) => p.name === "Due Date");

      const assignees = parseAssigneeValue(assigneeProp?.value);
      const tags = normalizeTagsValue(tagsProp?.value);
      const status = normalizeStatusValue(normalizeSelectValue(statusProp?.value));
      const priority = normalizePriorityValue(normalizeSelectValue(priorityProp?.value));
      const dueDate = normalizeDateValue(dueDateProp?.value);

      return {
        id: r.id as string,
        data: r.data as Record<string, unknown>,
        order: r.order as number,
        table_id: r.table_id as string,
        table_title: tables?.title ?? null,
        project_id: tables?.project_id ?? null,
        project_name: tables?.projects?.name ?? null,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
        assignees,
        tags,
        status,
        priority,
        due_date: dueDate,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchTableRows exception:", err);
    return { data: null, error: "Failed to search table rows" };
  }
}

/**
 * Search for timeline events in the current workspace.
 * Returns events with assignee name and project context.
 *
 * @param params.searchText - Fuzzy search on event title
 * @param params.status - Filter by status (planned, in-progress, blocked, done)
 * @param params.assigneeId - Filter by assignee user ID
 * @param params.projectId - Filter by project ID (via timeline block)
 * @param params.startDate - Date filter for start_date
 * @param params.endDate - Date filter for end_date
 * @param params.isMilestone - Filter by milestone status
 * @param params.limit - Maximum results (default 50)
 */
export async function searchTimelineEvents(params: {
  searchText?: string;
  status?: string | string[];
  assigneeId?: string | string[];
  assigneeName?: string; // Search by assignee name via entity_properties
  projectId?: string | string[];
  projectName?: string; // Search by project name
  startDate?: DateFilter;
  endDate?: DateFilter;
  isMilestone?: boolean;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<TimelineEventResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  // After error check, supabase and workspaceId are guaranteed to be defined
  const supabase = ctx.supabase!;
  const workspaceId = ctx.workspaceId!;
  const limit = params.limit ?? 50;

  try {
    // Determine if we need property-based filtering
    const hasPropertyFilters = !!(
      params.assigneeId ||
      params.assigneeName ||
      params.status
    );

    let matchingEventIds: string[] | null = null;

    // Pre-filter by entity_properties if property filters are specified
    if (hasPropertyFilters) {
      const propDefs = await getPropertyDefinitionIds(supabase, workspaceId);

      // Helper to find property definition case-insensitively
      const findPropDef = (name: string) =>
        propDefs.get(name) || propDefs.get(name.toLowerCase()) || propDefs.get(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());

      // Filter by assignee (via entity_properties)
      if (params.assigneeName || params.assigneeId) {
        const assigneePropDef = findPropDef("Assignee");
        if (assigneePropDef) {
          const assigneeFilter = normalizeArrayFilter(params.assigneeId);
          if (assigneeFilter) {
            const eventIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "timeline_event",
              assigneePropDef.id,
              "id",
              assigneeFilter
            );
            matchingEventIds = intersectIds(matchingEventIds, eventIds);
          }
          if (params.assigneeName) {
            const eventIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "timeline_event",
              assigneePropDef.id,
              "name",
              params.assigneeName
            );
            matchingEventIds = intersectIds(matchingEventIds, eventIds);
          }
        }
      }

      // Filter by status (via entity_properties)
      if (params.status) {
        const statusPropDef = findPropDef("Status");
        if (statusPropDef) {
          const statusFilter = normalizeArrayFilter(params.status);
          if (statusFilter) {
            // Pass all status values - matches any of them
            const eventIds = await getEntitiesWithPropertyFilter(
              supabase,
              workspaceId,
              "timeline_event",
              statusPropDef.id,
              "name",
              statusFilter
            );
            matchingEventIds = intersectIds(matchingEventIds, eventIds);
          }
        }
      }

      // If no events match the property filters, return empty result
      if (matchingEventIds !== null && matchingEventIds.length === 0) {
        return { data: [], error: null };
      }
    }

    // Determine if we need post-query filtering for project
    const projectFilter = normalizeArrayFilter(params.projectId);
    const hasPostFilters = !!(projectFilter || params.projectName);
    const fetchLimit = hasPostFilters ? limit * 10 : limit;

    // Build the main query (no longer using assignee_id column for filtering)
    let query = supabase
      .from("timeline_events")
      .select(`
        id, title, start_date, end_date, status, priority, progress, notes, color,
        is_milestone, workspace_id, timeline_block_id,
        created_at, updated_at,
        blocks:timeline_block_id(tab_id, tabs(project_id, projects(name)))
      `)
      .eq("workspace_id", workspaceId);

    // Apply entity ID filter from property pre-filtering
    if (matchingEventIds !== null) {
      query = query.in("id", matchingEventIds);
    }

    if (params.searchText) {
      query = query.ilike("title", `%${params.searchText}%`);
    }

    if (params.isMilestone !== undefined) {
      query = query.eq("is_milestone", params.isMilestone);
    }

    query = applyDateFilter(query, "start_date", params.startDate);
    query = applyDateFilter(query, "end_date", params.endDate);

    const { data, error } = await query.order("start_date").limit(fetchLimit);

    if (error) {
      console.error("searchTimelineEvents error:", error);
      return { data: null, error: error.message };
    }

    let results = data ?? [];

    // Filter by project ID if specified
    if (projectFilter) {
      results = results.filter((e: Record<string, unknown>) => {
        const blocks = e.blocks as { tabs: { project_id: string } | null } | null;
        return blocks?.tabs?.project_id && projectFilter.includes(blocks.tabs.project_id);
      });
    }

    // Filter by project name if specified (fuzzy match)
    if (params.projectName) {
      const searchName = params.projectName.toLowerCase();
      results = results.filter((e: Record<string, unknown>) => {
        const blocks = e.blocks as { tabs: { projects: { name: string } | null } | null } | null;
        return blocks?.tabs?.projects?.name.toLowerCase().includes(searchName);
      });
    }

    // Trim to requested limit after filtering
    results = results.slice(0, limit);

    // Enrich events with properties from entity_properties
    const eventIds = results.map((e: Record<string, unknown>) => e.id as string);
    const propertiesMap = await enrichEntitiesWithProperties(supabase, workspaceId, "timeline_event", eventIds);

    const mapped: TimelineEventResult[] = results.map((e: Record<string, unknown>) => {
      const blocks = e.blocks as { tabs: { project_id: string; projects: { name: string } | null } | null } | null;
      const props = propertiesMap.get(e.id as string) ?? [];

      // Extract properties by name
      const assigneeProp = props.find((p) => p.name === "Assignee");
      const statusProp = props.find((p) => p.name === "Status");

      const assignees = parseAssigneeValue(assigneeProp?.value);
      const primaryAssignee = assignees[0] ?? null;

      // Parse status (select type: string/object)
      const rawStatus = normalizeSelectValue(statusProp?.value) ?? (typeof e.status === "string" ? e.status : null);
      const status = normalizeStatusValue(rawStatus);

      return {
        id: e.id as string,
        title: e.title as string,
        start_date: e.start_date as string,
        end_date: e.end_date as string,
        status,
        progress: e.progress as number,
        notes: e.notes as string | null,
        color: e.color as string | null,
        is_milestone: e.is_milestone as boolean,
        workspace_id: e.workspace_id as string,
        timeline_block_id: e.timeline_block_id as string,
        assignee_id: primaryAssignee?.id ?? null,
        assignee_name: primaryAssignee?.name ?? null,
        project_id: blocks?.tabs?.project_id ?? null,
        project_name: blocks?.tabs?.projects?.name ?? null,
        created_at: e.created_at as string,
        updated_at: e.updated_at as string,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchTimelineEvents exception:", err);
    return { data: null, error: "Failed to search timeline events" };
  }
}

/**
 * Search for files in the current workspace.
 * Returns files with project name and uploader name.
 *
 * @param params.searchText - Fuzzy search on file name
 * @param params.projectId - Filter by project ID
 * @param params.fileType - Filter by file MIME type
 * @param params.uploadedBy - Filter by uploader user ID
 * @param params.uploadedByName - Filter by uploader name (fuzzy match via profile lookup)
 * @param params.bucket - Filter by storage bucket
 * @param params.storagePath - Filter by storage path (contains match)
 * @param params.createdAt - Date filter for created_at
 * @param params.limit - Maximum results (default 50)
 */
export async function searchFiles(params: {
  searchText?: string;
  projectId?: string | string[];
  fileType?: string | string[];
  uploadedBy?: string;
  uploadedByName?: string;
  bucket?: string | string[];
  storagePath?: string;
  createdAt?: DateFilter;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<FileResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  // Determine if we need post-query filtering for uploadedByName
  const hasPostFilters = !!params.uploadedByName;
  const fetchLimit = hasPostFilters ? limit * 5 : limit;

  try {
    let query = supabase
      .from("files")
      .select(`
        id, file_name, file_size, file_type, storage_path, bucket,
        workspace_id, project_id, uploaded_by, created_at,
        projects(name)
      `)
      .eq("workspace_id", workspaceId);

    if (params.searchText) {
      query = query.ilike("file_name", `%${params.searchText}%`);
    }

    const projectFilter = normalizeArrayFilter(params.projectId);
    if (projectFilter) {
      query = query.in("project_id", projectFilter);
    }

    const typeFilter = normalizeArrayFilter(params.fileType);
    if (typeFilter) {
      query = query.in("file_type", typeFilter);
    }

    if (params.uploadedBy) {
      query = query.eq("uploaded_by", params.uploadedBy);
    }

    // Filter by bucket
    const bucketFilter = normalizeArrayFilter(params.bucket);
    if (bucketFilter) {
      query = query.in("bucket", bucketFilter);
    }

    // Filter by storage path (contains match)
    if (params.storagePath) {
      query = query.ilike("storage_path", `%${params.storagePath}%`);
    }

    // Apply date filter for created_at
    query = applyDateFilter(query, "created_at", params.createdAt);

    const { data, error } = await query.order("created_at", { ascending: false }).limit(fetchLimit);

    if (error) {
      console.error("searchFiles error:", error);
      return { data: null, error: error.message };
    }

    let results = data ?? [];

    // Get uploader names (needed for both display and filtering)
    const uploaderIds = [...new Set(results.map((f) => f.uploaded_by as string))];
    const { data: profiles } = uploaderIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", uploaderIds)
      : { data: [] };

    const profileMap = new Map<string, string | null>(
      (profiles ?? []).map((p: { id: string; name: string | null }) => [p.id, p.name])
    );

    // Filter by uploader name if specified
    if (params.uploadedByName) {
      const searchName = params.uploadedByName.toLowerCase();
      results = results.filter((f) => {
        const uploaderName = profileMap.get(f.uploaded_by as string);
        return uploaderName?.toLowerCase().includes(searchName);
      });
    }

    // Trim to requested limit after filtering
    results = results.slice(0, limit);

    const mapped: FileResult[] = results.map((f: Record<string, unknown>) => {
      const project = coerceRelation<{ name: string }>(f.projects);
      return {
        id: f.id as string,
        file_name: f.file_name as string,
        file_size: f.file_size as number,
        file_type: f.file_type as string | null,
        storage_path: f.storage_path as string,
        bucket: f.bucket as string,
        workspace_id: f.workspace_id as string,
        project_id: f.project_id as string,
        project_name: project?.name ?? null,
        uploaded_by: f.uploaded_by as string,
        uploaded_by_name: profileMap.get(f.uploaded_by as string) ?? null,
        created_at: f.created_at as string,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchFiles exception:", err);
    return { data: null, error: "Failed to search files" };
  }
}

/**
 * Search for comments (on blocks, tabs, or projects).
 *
 * @param params.searchText - Fuzzy search on comment text
 * @param params.targetType - Filter by target type (block, tab, project)
 * @param params.targetId - Filter by target ID
 * @param params.userId - Filter by comment author
 * @param params.limit - Maximum results (default 50)
 */
export async function searchComments(params: {
  searchText?: string;
  targetType?: string | string[];
  targetId?: string;
  userId?: string;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<CommentResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("comments")
      .select("id, text, target_type, target_id, user_id, created_at, updated_at")
      .is("deleted_at", null);

    if (params.searchText) {
      query = query.ilike("text", `%${params.searchText}%`);
    }

    const typeFilter = normalizeArrayFilter(params.targetType);
    if (typeFilter) {
      query = query.in("target_type", typeFilter);
    }

    if (params.targetId) {
      query = query.eq("target_id", params.targetId);
    }

    if (params.userId) {
      query = query.eq("user_id", params.userId);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit * 2);

    if (error) {
      console.error("searchComments error:", error);
      return { data: null, error: error.message };
    }

    // Filter to workspace-accessible comments by validating all target types
    // Note: comments target_type enum only supports: block, tab, project
    const comments = data ?? [];

    // Group comments by target type for efficient validation
    const projectComments = comments.filter((c) => c.target_type === "project");
    const blockComments = comments.filter((c) => c.target_type === "block");
    const tabComments = comments.filter((c) => c.target_type === "tab");

    // Validate project targets
    let validProjectIds = new Set<string>();
    const projectIds = projectComments.map((c) => c.target_id);
    if (projectIds.length > 0) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("id", projectIds);
      validProjectIds = new Set((projects ?? []).map((p) => p.id));
    }

    // Validate block targets (blocks belong to tabs -> projects -> workspace)
    let validBlockIds = new Set<string>();
    const blockIds = blockComments.map((c) => c.target_id);
    if (blockIds.length > 0) {
      const { data: blocks } = await supabase
        .from("blocks")
        .select("id, tabs!inner(project_id, projects!inner(workspace_id))")
        .eq("tabs.projects.workspace_id", workspaceId)
        .in("id", blockIds);
      validBlockIds = new Set((blocks ?? []).map((b) => b.id));
    }

    // Validate tab targets (tabs belong to projects -> workspace)
    let validTabIds = new Set<string>();
    const tabIds = tabComments.map((c) => c.target_id);
    if (tabIds.length > 0) {
      const { data: tabs } = await supabase
        .from("tabs")
        .select("id, projects!inner(workspace_id)")
        .eq("projects.workspace_id", workspaceId)
        .in("id", tabIds);
      validTabIds = new Set((tabs ?? []).map((t) => t.id));
    }

    // Filter comments to only those with valid targets in this workspace
    const filteredComments = comments.filter((c) => {
      switch (c.target_type) {
        case "project":
          return validProjectIds.has(c.target_id);
        case "block":
          return validBlockIds.has(c.target_id);
        case "tab":
          return validTabIds.has(c.target_id);
        default:
          // Unknown target types are excluded for safety
          return false;
      }
    });

    // Get user names
    const userIds = [...new Set(filteredComments.map((c) => c.user_id))];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", userIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    const mapped: CommentResult[] = filteredComments.slice(0, limit).map((c) => ({
      id: c.id,
      text: c.text,
      target_type: c.target_type,
      target_id: c.target_id,
      user_id: c.user_id,
      user_name: profileMap.get(c.user_id) ?? null,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchComments exception:", err);
    return { data: null, error: "Failed to search comments" };
  }
}

/**
 * Search for task comments.
 *
 * @param params.searchText - Fuzzy search on comment text
 * @param params.taskId - Filter by task ID
 * @param params.authorId - Filter by author user ID
 * @param params.limit - Maximum results (default 50)
 */
export async function searchTaskComments(params: {
  searchText?: string;
  taskId?: string | string[];
  authorId?: string;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<TaskCommentResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("task_comments")
      .select(`
        id, text, task_id, author_id, created_at,
        task_items!inner(title, workspace_id)
      `)
      .eq("task_items.workspace_id", workspaceId);

    if (params.searchText) {
      query = query.ilike("text", `%${params.searchText}%`);
    }

    const taskFilter = normalizeArrayFilter(params.taskId);
    if (taskFilter) {
      query = query.in("task_id", taskFilter);
    }

    if (params.authorId) {
      query = query.eq("author_id", params.authorId);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

    if (error) {
      console.error("searchTaskComments error:", error);
      return { data: null, error: error.message };
    }

    // Get author names
    const authorIds = [...new Set((data ?? []).map((c) => c.author_id).filter(Boolean))];
    let profileMap = new Map<string, string>();

    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", authorIds as string[]);
      profileMap = new Map((profiles ?? []).map((p) => [p.id, p.name ?? ""]));
    }

    const mapped: TaskCommentResult[] = (data ?? []).map((c: Record<string, unknown>) => {
      const task = c.task_items as { title: string } | null;
      return {
        id: c.id as string,
        text: c.text as string,
        task_id: c.task_id as string,
        task_title: task?.title ?? null,
        author_id: c.author_id as string | null,
        author_name: c.author_id ? profileMap.get(c.author_id as string) ?? null : null,
        created_at: c.created_at as string,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchTaskComments exception:", err);
    return { data: null, error: "Failed to search task comments" };
  }
}

/**
 * Search for payments in the current workspace.
 * Returns payments with client and project names.
 *
 * @param params.searchText - Fuzzy search on description, notes, payment_number
 * @param params.status - Filter by status (pending, paid, overdue, draft, failed, canceled)
 * @param params.clientId - Filter by client ID
 * @param params.projectId - Filter by project ID
 * @param params.dueDate - Date filter for due_date
 * @param params.minAmount - Minimum amount filter
 * @param params.maxAmount - Maximum amount filter
 * @param params.limit - Maximum results (default 50)
 */
export async function searchPayments(params: {
  searchText?: string;
  status?: string | string[];
  clientId?: string | string[];
  projectId?: string | string[];
  dueDate?: DateFilter;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<PaymentResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("payments")
      .select(`
        id, payment_number, amount, currency, status, description, notes,
        due_date, paid_at, workspace_id, project_id, client_id,
        created_at, updated_at,
        projects(name),
        clients(name)
      `)
      .eq("workspace_id", workspaceId);

    if (params.searchText) {
      const text = params.searchText;
      query = query.or(buildOrIlikeFilter(["description", "notes", "payment_number"], text));
    }

    const statusFilter = normalizeArrayFilter(params.status);
    if (statusFilter) {
      query = query.in("status", statusFilter);
    }

    const clientFilter = normalizeArrayFilter(params.clientId);
    if (clientFilter) {
      query = query.in("client_id", clientFilter);
    }

    const projectFilter = normalizeArrayFilter(params.projectId);
    if (projectFilter) {
      query = query.in("project_id", projectFilter);
    }

    query = applyDateFilter(query, "due_date", params.dueDate);

    if (params.minAmount !== undefined) {
      query = query.gte("amount", params.minAmount);
    }

    if (params.maxAmount !== undefined) {
      query = query.lte("amount", params.maxAmount);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

    if (error) {
      console.error("searchPayments error:", error);
      return { data: null, error: error.message };
    }

    const mapped: PaymentResult[] = (data ?? []).map((p: Record<string, unknown>) => {
      const project = coerceRelation<{ name: string }>(p.projects);
      const client = coerceRelation<{ name: string }>(p.clients);
      return {
        id: p.id as string,
        payment_number: p.payment_number as string | null,
        amount: p.amount as number,
        currency: p.currency as string,
        status: p.status as string,
        description: p.description as string | null,
        notes: p.notes as string | null,
        due_date: p.due_date as string | null,
        paid_at: p.paid_at as string | null,
        workspace_id: p.workspace_id as string,
        project_id: p.project_id as string | null,
        project_name: project?.name ?? null,
        client_id: p.client_id as string | null,
        client_name: client?.name ?? null,
        created_at: p.created_at as string,
        updated_at: p.updated_at as string | null,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchPayments exception:", err);
    return { data: null, error: "Failed to search payments" };
  }
}

/**
 * Search for task tags in the current workspace.
 *
 * @param params.searchText - Fuzzy search on tag name
 * @param params.limit - Maximum results (default 50)
 */
export async function searchTags(params: {
  searchText?: string;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<TagResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    const { data: propDefs, error: propDefsError } = await supabase
      .from("property_definitions")
      .select("id, name, type, options")
      .eq("workspace_id", workspaceId)
      .ilike("name", "Tags");

    if (propDefsError) {
      console.error("searchTags property definitions error:", propDefsError);
      return { data: null, error: propDefsError.message };
    }

    const tagsPropDef = (propDefs ?? []).find((p) => p.name.toLowerCase() === "tags");

    if (!tagsPropDef) {
      // Fallback to legacy task_tags if property definition is missing
      let query = supabase
        .from("task_tags")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (params.searchText) {
        query = query.ilike("name", `%${params.searchText}%`);
      }

      const { data, error } = await query.order("name").limit(limit);

      if (error) {
        console.error("searchTags error:", error);
        return { data: null, error: error.message };
      }

      return { data: data as TagResult[], error: null };
    }

    // Aggregate tags from entity_properties (Tags multi_select) across entities
    const { data, error } = await supabase
      .from("entity_properties")
      .select("entity_id, value")
      .eq("workspace_id", workspaceId)
      .eq("property_definition_id", tagsPropDef.id)
      .in("entity_type", ["task", "block", "timeline_event"]);

    if (error) {
      console.error("searchTags error:", error);
      return { data: null, error: error.message };
    }

    const searchLower = params.searchText?.toLowerCase() ?? null;
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedSearch = searchLower ? normalize(searchLower) : null;
    const editDistance = (a: string, b: string): number => {
      const aLen = a.length;
      const bLen = b.length;
      if (aLen === 0) return bLen;
      if (bLen === 0) return aLen;

      const dp = new Array(bLen + 1);
      for (let j = 0; j <= bLen; j++) dp[j] = j;

      for (let i = 1; i <= aLen; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= bLen; j++) {
          const temp = dp[j];
          if (a[i - 1] === b[j - 1]) {
            dp[j] = prev;
          } else {
            dp[j] = Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
          }
          prev = temp;
        }
      }
      return dp[bLen];
    };
    const isFuzzyMatch = (name: string): boolean => {
      if (!searchLower || !normalizedSearch) return true;
      const nameLower = name.toLowerCase();
      const normalizedName = normalize(name);
      if (nameLower.includes(searchLower)) return true;
      if (normalizedName.includes(normalizedSearch)) return true;

      const maxEdits = normalizedSearch.length <= 4 ? 1 : normalizedSearch.length <= 7 ? 2 : 3;
      return editDistance(normalizedName, normalizedSearch) <= maxEdits;
    };
    const tagMap = new Map<string, TagResult>();

    for (const row of data ?? []) {
      const value = row.value;
      const tags = Array.isArray(value) ? value : value ? [value] : [];

      for (const tag of tags) {
        if (typeof tag === "string") {
          const name = tag;
          if (searchLower && !isFuzzyMatch(name)) {
            continue;
          }
          if (!tagMap.has(tag)) {
            tagMap.set(tag, {
              id: tag,
              name,
              color: null,
              workspace_id: workspaceId,
              created_at: null,
            });
          }
          continue;
        }

        const tagObj = tag as Record<string, unknown>;
        const id = String(tagObj.id ?? "");
        const label = String(tagObj.name ?? tagObj.label ?? "");
        const name = label;
        if (!id || !name) continue;

        if (searchLower && !isFuzzyMatch(name)) {
          continue;
        }

        if (!tagMap.has(id)) {
          tagMap.set(id, {
            id,
            name,
            color: (tagObj.color as string) ?? null,
            workspace_id: workspaceId,
            created_at: null,
          });
        }
      }
    }

    const tags = Array.from(tagMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return { data: tags.slice(0, limit), error: null };
  } catch (err) {
    console.error("searchTags exception:", err);
    return { data: null, error: "Failed to search tags" };
  }
}

/**
 * Search for property definitions in the current workspace.
 *
 * @param params.searchText - Fuzzy search on property name
 * @param params.type - Filter by property type
 * @param params.limit - Maximum results (default 50)
 */
export async function searchPropertyDefinitions(params: {
  searchText?: string;
  type?: string | string[];
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<PropertyDefinitionResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("property_definitions")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (params.searchText) {
      query = query.ilike("name", `%${params.searchText}%`);
    }

    const typeFilter = normalizeArrayFilter(params.type);
    if (typeFilter) {
      query = query.in("type", typeFilter);
    }

    const { data, error } = await query.order("name").limit(limit);

    if (error) {
      console.error("searchPropertyDefinitions error:", error);
      return { data: null, error: error.message };
    }

    return { data: data as PropertyDefinitionResult[], error: null };
  } catch (err) {
    console.error("searchPropertyDefinitions exception:", err);
    return { data: null, error: "Failed to search property definitions" };
  }
}

/**
 * Search for entity properties generically across the workspace.
 * Allows filtering by entity type, property definition, and value matching.
 *
 * @param params.entityType - Filter by entity type (task, block, timeline_event)
 * @param params.propertyDefinitionId - Filter by specific property definition ID
 * @param params.propertyName - Filter by property name (fuzzy match)
 * @param params.propertyType - Filter by property type (text, number, date, select, multi_select, person)
 * @param params.valueFilter - Filter by value with operator
 * @param params.valueFilter.op - Operator: "contains", "eq", "gte", "lte"
 * @param params.valueFilter.value - The value to compare against
 * @param params.limit - Maximum results (default 50)
 */
export async function searchEntityProperties(params: {
  entityType?: "task" | "block" | "timeline_event";
  propertyDefinitionId?: string;
  propertyName?: string;
  propertyType?: string | string[];
  valueFilter?: {
    op: "contains" | "eq" | "gte" | "lte";
    value: string | number;
  };
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<EntityPropertyResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    // First, get matching property definitions if filtering by name or type
    let propertyDefIds: string[] | null = null;

    if (params.propertyName || params.propertyType) {
      let defQuery = supabase
        .from("property_definitions")
        .select("id, name, type")
        .eq("workspace_id", workspaceId);

      if (params.propertyName) {
        defQuery = defQuery.ilike("name", `%${params.propertyName}%`);
      }

      const typeFilter = normalizeArrayFilter(params.propertyType);
      if (typeFilter) {
        defQuery = defQuery.in("type", typeFilter);
      }

      const { data: defs, error: defError } = await defQuery;
      if (defError) {
        return { data: null, error: defError.message };
      }

      propertyDefIds = (defs ?? []).map((d) => d.id);
      if (propertyDefIds.length === 0) {
        return { data: [], error: null };
      }
    }

    // Build entity_properties query
    let query = supabase
      .from("entity_properties")
      .select("*, property_definitions(name, type)")
      .eq("workspace_id", workspaceId);

    if (params.entityType) {
      query = query.eq("entity_type", params.entityType);
    }

    if (params.propertyDefinitionId) {
      query = query.eq("property_definition_id", params.propertyDefinitionId);
    } else if (propertyDefIds) {
      query = query.in("property_definition_id", propertyDefIds);
    }

    // Overfetch if we need to filter by value in JS
    const fetchLimit = params.valueFilter ? limit * 10 : limit;
    const { data, error } = await query.order("created_at", { ascending: false }).limit(fetchLimit);

    if (error) {
      console.error("searchEntityProperties error:", error);
      return { data: null, error: error.message };
    }

    let results = data ?? [];

    // Filter by value in JavaScript if valueFilter is specified
    if (params.valueFilter) {
      const { op, value } = params.valueFilter;
      results = results.filter((row) => {
        const propValue = row.value;
        if (propValue === null || propValue === undefined) return false;

        switch (op) {
          case "contains": {
            // For string/text values, or object values with name property
            if (typeof propValue === "string") {
              return propValue.toLowerCase().includes(String(value).toLowerCase());
            }
            if (typeof propValue === "object" && !Array.isArray(propValue)) {
              const v = propValue as Record<string, unknown>;
              if (typeof v.name === "string") {
                return v.name.toLowerCase().includes(String(value).toLowerCase());
              }
            }
            if (Array.isArray(propValue)) {
              return propValue.some((item: unknown) => {
                if (typeof item === "string") {
                  return item.toLowerCase().includes(String(value).toLowerCase());
                }
                if (typeof item === "object" && item !== null) {
                  const i = item as Record<string, unknown>;
                  return typeof i.name === "string" && i.name.toLowerCase().includes(String(value).toLowerCase());
                }
                return false;
              });
            }
            return false;
          }
          case "eq": {
            if (typeof propValue === "string" || typeof propValue === "number") {
              return propValue === value;
            }
            if (typeof propValue === "object" && !Array.isArray(propValue)) {
              const v = propValue as Record<string, unknown>;
              return v.name === value || v.id === value;
            }
            return false;
          }
          case "gte": {
            if (typeof propValue === "number" && typeof value === "number") {
              return propValue >= value;
            }
            if (typeof propValue === "string" && typeof value === "string") {
              return propValue >= value; // Works for date strings in ISO format
            }
            return false;
          }
          case "lte": {
            if (typeof propValue === "number" && typeof value === "number") {
              return propValue <= value;
            }
            if (typeof propValue === "string" && typeof value === "string") {
              return propValue <= value;
            }
            return false;
          }
          default:
            return true;
        }
      });
    }

    // Map to result format
    const mapped: EntityPropertyResult[] = results.slice(0, limit).map((row) => {
      const def = coerceRelation<{ name: string; type: string }>(row.property_definitions);
      return {
        id: row.id,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        property_definition_id: row.property_definition_id,
        property_name: def?.name ?? "Unknown",
        property_type: def?.type ?? "unknown",
        value: row.value,
        workspace_id: row.workspace_id,
        created_at: row.created_at,
      };
    });

    return { data: mapped, error: null };
  } catch (err) {
    console.error("searchEntityProperties exception:", err);
    return { data: null, error: "Failed to search entity properties" };
  }
}

/**
 * Search for entity links in the current workspace.
 *
 * @param params.sourceEntityType - Filter by source entity type
 * @param params.sourceEntityId - Filter by source entity ID
 * @param params.targetEntityType - Filter by target entity type
 * @param params.targetEntityId - Filter by target entity ID
 * @param params.limit - Maximum results (default 50)
 */
export async function searchEntityLinks(params: {
  sourceEntityType?: string;
  sourceEntityId?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<EntityLinkResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    let query = supabase
      .from("entity_links")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (params.sourceEntityType) {
      query = query.eq("source_entity_type", params.sourceEntityType);
    }

    if (params.sourceEntityId) {
      query = query.eq("source_entity_id", params.sourceEntityId);
    }

    if (params.targetEntityType) {
      query = query.eq("target_entity_type", params.targetEntityType);
    }

    if (params.targetEntityId) {
      query = query.eq("target_entity_id", params.targetEntityId);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

    if (error) {
      console.error("searchEntityLinks error:", error);
      return { data: null, error: error.message };
    }

    return { data: data as EntityLinkResult[], error: null };
  } catch (err) {
    console.error("searchEntityLinks exception:", err);
    return { data: null, error: "Failed to search entity links" };
  }
}

// ============================================================================
// ENTITY RETRIEVAL PRIMITIVES
// ============================================================================

interface EntityResult {
  type: EntityType;
  id: string;
  name: string;
  data: Record<string, unknown>;
  context?: {
    workspace_id?: string;
    project_id?: string;
    project_name?: string;
    tab_id?: string;
    tab_name?: string;
    client_id?: string;
    client_name?: string;
  };
}

interface EntityContextResult extends EntityResult {
  properties?: Array<{
    id: string;
    name: string;
    type: string;
    value: unknown;
  }>;
  links?: Array<{
    direction: "outgoing" | "incoming";
    linked_entity_type: string;
    linked_entity_id: string;
    linked_entity_name?: string;
  }>;
  parent?: {
    type: string;
    id: string;
    name: string;
  };
  children?: Array<{
    type: string;
    id: string;
    name: string;
  }>;
}

interface TableSchemaResult {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  project_name: string | null;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
    order: number;
    is_primary: boolean;
  }>;
  views: Array<{
    id: string;
    name: string;
    type: string;
    is_default: boolean;
  }>;
  row_count: number;
}

/**
 * Retrieves a single entity by type and ID.
 * Returns the full entity data with context information.
 *
 * @param params.entityType - The type of entity to retrieve
 * @param params.id - The entity ID
 */
export async function getEntityById(params: {
  entityType: EntityType;
  id: string;
  authContext?: AuthContext;
}): Promise<{ data: EntityResult | null; error: string | null }> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  // After error check, supabase and workspaceId are guaranteed to be defined
  const supabase = ctx.supabase!;
  const workspaceId = ctx.workspaceId!;

  try {
    switch (params.entityType) {
      case "task": {
        // Fetch task without join tables (they're not used)
        const { data, error } = await supabase
          .from("task_items")
          .select(`*, projects(name), tabs(name)`)
          .eq("id", params.id)
          .eq("workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Task not found" };

        // Fetch properties from entity_properties
        const propertiesMap = await enrichEntitiesWithProperties(supabase, workspaceId, "task", [params.id]);
        const props = propertiesMap.get(params.id) ?? [];

        // Extract properties by name
        const assigneeProp = props.find((p) => p.name === "Assignee");
        const tagsProp = props.find((p) => p.name === "Tags");
        const statusProp = props.find((p) => p.name === "Status");
        const priorityProp = props.find((p) => p.name === "Priority");

        // Parse assignee (person type: single or array)
        const assigneesList = parseAssigneeValue(assigneeProp?.value);
        const assignees = assigneesList.map((a) => ({
          assignee_id: a.id,
          assignee_name: a.name,
        }));

        // Parse tags (multi_select type: strings or objects)
        const tags = normalizeTagsValue(tagsProp?.value).map((t) => ({
          task_tags: { id: t.id, name: t.name, color: t.color ?? null },
        }));

        // Parse status and priority (select type: string/object)
        const rawStatus = normalizeSelectValue(statusProp?.value) ?? (typeof data.status === "string" ? data.status : null);
        const status = normalizeStatusValue(rawStatus);
        const rawPriority = normalizeSelectValue(priorityProp?.value) ?? (typeof data.priority === "string" ? data.priority : null);
        const normalizedPriority = normalizePriorityValue(rawPriority);
        const priority = normalizedPriority === "none" ? null : normalizedPriority;

        const project = coerceRelation<{ name: string }>(data.projects);
        if (!project) {
          return { data: null, error: "Tab project not found" };
        }
        if (!project) {
          return { data: null, error: "Tab project not found" };
        }
        if (!project) {
          return { data: null, error: "Tab project not found" };
        }
        if (!project) {
          return { data: null, error: "Tab project not found" };
        }
        if (!project) {
          return { data: null, error: "Tab project not found" };
        }
        const tab = coerceRelation<{ name: string }>(data.tabs);

        // Merge properties into data for backward compatibility
        const enrichedData = {
          ...data,
          status: status ?? data.status,
          priority: priority ?? data.priority,
          task_assignees: assignees,
          task_tag_links: tags,
        };

        return {
          data: {
            type: "task",
            id: data.id,
            name: data.title,
            data: enrichedData,
            context: {
              workspace_id: data.workspace_id,
              project_id: data.project_id ?? undefined,
              project_name: project?.name ?? undefined,
              tab_id: data.tab_id ?? undefined,
              tab_name: tab?.name ?? undefined,
            },
          },
          error: null,
        };
      }

      case "subtask": {
        const { data, error } = await supabase
          .from("task_subtasks")
          .select(
            `
            *,
            task_items!inner(
              id,
              title,
              workspace_id,
              project_id,
              tab_id,
              projects(name),
              tabs(name)
            )
          `
          )
          .eq("id", params.id)
          .eq("task_items.workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Subtask not found" };

        const task = coerceRelation<{ title?: string; project_id?: string | null; tab_id?: string | null; projects?: unknown; tabs?: unknown; workspace_id?: string }>(
          data.task_items
        );
        const project = coerceRelation<{ name: string }>(task?.projects);
        const tab = coerceRelation<{ name: string }>(task?.tabs);

        return {
          data: {
            type: "subtask",
            id: data.id,
            name: data.title,
            data: {
              ...data,
              task_title: task?.title ?? null,
              project_id: task?.project_id ?? null,
              tab_id: task?.tab_id ?? null,
            },
            context: {
              workspace_id: task?.workspace_id ?? undefined,
              project_id: task?.project_id ?? undefined,
              project_name: project?.name ?? undefined,
              tab_id: task?.tab_id ?? undefined,
              tab_name: tab?.name ?? undefined,
            },
          },
          error: null,
        };
      }

      case "project": {
        const { data, error } = await supabase
          .from("projects")
          .select("*, clients(name)")
          .eq("id", params.id)
          .eq("workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Project not found" };

        const client = coerceRelation<{ name: string }>(data.clients);

        return {
          data: {
            type: "project",
            id: data.id,
            name: data.name,
            data: data,
            context: {
              workspace_id: data.workspace_id,
              client_id: data.client_id ?? undefined,
              client_name: client?.name ?? undefined,
            },
          },
          error: null,
        };
      }

      case "client": {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("id", params.id)
          .eq("workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Client not found" };

        return {
          data: {
            type: "client",
            id: data.id,
            name: data.name,
            data: data,
            context: { workspace_id: data.workspace_id },
          },
          error: null,
        };
      }

      case "member": {
        const { data: member, error: memberError } = await supabase
          .from("workspace_members")
          .select("*")
          .eq("user_id", params.id)
          .eq("workspace_id", workspaceId)
          .single();

        if (memberError || !member) return { data: null, error: memberError?.message ?? "Member not found" };

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", params.id)
          .single();

        return {
          data: {
            type: "member",
            id: params.id,
            name: profile?.name ?? profile?.email ?? "Unknown",
            data: { ...member, profile },
            context: { workspace_id: member.workspace_id },
          },
          error: null,
        };
      }

      case "tab": {
        const { data, error } = await supabase
          .from("tabs")
          .select("*, projects!inner(workspace_id, name)")
          .eq("id", params.id)
          .eq("projects.workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Tab not found" };

        const project = coerceRelation<{ name: string }>(data.projects);
        if (!project) {
          return { data: null, error: "Tab project not found" };
        }

        return {
          data: {
            type: "tab",
            id: data.id,
            name: data.name,
            data: data,
            context: {
              workspace_id: workspaceId,
              project_id: data.project_id,
              project_name: project.name,
            },
          },
          error: null,
        };
      }

      case "block": {
        const { data, error } = await supabase
          .from("blocks")
          .select("*, tabs!inner(name, project_id, projects!inner(workspace_id, name))")
          .eq("id", params.id)
          .eq("tabs.projects.workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Block not found" };

        const tabs = coerceRelation<{ name: string; project_id: string; projects: { name: string } }>(data.tabs);
        if (!tabs) {
          return { data: null, error: "Block tab not found" };
        }

        const propertiesMap = await enrichEntitiesWithProperties(supabase, workspaceId, "block", [params.id]);
        const props = propertiesMap.get(params.id) ?? [];

        const statusProp = props.find((p) => p.name === "Status");
        const priorityProp = props.find((p) => p.name === "Priority");
        const assigneeProp = props.find((p) => p.name === "Assignee");
        const dueDateProp = props.find((p) => p.name === "Due Date");
        const tagsProp = props.find((p) => p.name === "Tags");

        const status = normalizeStatusValue(normalizeSelectValue(statusProp?.value));
        const priority = normalizePriorityValue(normalizeSelectValue(priorityProp?.value));
        const assignees = parseAssigneeValue(assigneeProp?.value);
        const dueDate = normalizeDateValue(dueDateProp?.value);
        const tags = normalizeTagsValue(tagsProp?.value).map((tag) => tag.name);

        const enrichedData = {
          ...data,
          status,
          priority,
          assignees,
          tags,
          due_date: dueDate,
        };

        return {
          data: {
            type: "block",
            id: data.id,
            name: data.template_name ?? `${data.type} block`,
            data: enrichedData,
            context: {
              workspace_id: workspaceId,
              project_id: tabs.project_id,
              project_name: tabs.projects.name,
              tab_id: data.tab_id,
              tab_name: tabs.name,
            },
          },
          error: null,
        };
      }

      case "doc": {
        const { data, error } = await supabase
          .from("docs")
          .select("*")
          .eq("id", params.id)
          .eq("workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Doc not found" };

        return {
          data: {
            type: "doc",
            id: data.id,
            name: data.title,
            data: data,
            context: { workspace_id: data.workspace_id },
          },
          error: null,
        };
      }

      case "table": {
        const { data, error } = await supabase
          .from("tables")
          .select("*, projects(name)")
          .eq("id", params.id)
          .eq("workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Table not found" };

        const project = coerceRelation<{ name: string }>(data.projects);
        if (!project) {
          return { data: null, error: "Tab project not found" };
        }

        return {
          data: {
            type: "table",
            id: data.id,
            name: data.title,
            data: data,
            context: {
              workspace_id: data.workspace_id,
              project_id: data.project_id ?? undefined,
              project_name: project?.name ?? undefined,
            },
          },
          error: null,
        };
      }

      case "table_row": {
        const { data, error } = await supabase
          .from("table_rows")
          .select("*, tables!inner(workspace_id, title, project_id, projects(name))")
          .eq("id", params.id)
          .eq("tables.workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Table row not found" };

        const tables = data.tables as { title: string; project_id: string | null; projects: { name: string } | null };
        const propertiesMap = await enrichEntitiesWithProperties(supabase, workspaceId, "table_row", [params.id]);
        const props = propertiesMap.get(params.id) ?? [];

        const assigneeProp = props.find((p) => p.name === "Assignee");
        const tagsProp = props.find((p) => p.name === "Tags");
        const statusProp = props.find((p) => p.name === "Status");
        const priorityProp = props.find((p) => p.name === "Priority");
        const dueDateProp = props.find((p) => p.name === "Due Date");

        const assignees = parseAssigneeValue(assigneeProp?.value);
        const tags = normalizeTagsValue(tagsProp?.value).map((tag) => tag.name);
        const status = normalizeStatusValue(normalizeSelectValue(statusProp?.value));
        const priority = normalizePriorityValue(normalizeSelectValue(priorityProp?.value));
        const dueDate = normalizeDateValue(dueDateProp?.value);

        const enrichedData = {
          ...data,
          status,
          priority,
          assignees,
          tags,
          due_date: dueDate,
        };

        return {
          data: {
            type: "table_row",
            id: data.id,
            name: `Row in ${tables.title}`,
            data: enrichedData,
            context: {
              workspace_id: workspaceId,
              project_id: tables.project_id ?? undefined,
              project_name: tables.projects?.name ?? undefined,
            },
          },
          error: null,
        };
      }

      case "timeline_event": {
        const { data, error } = await supabase
          .from("timeline_events")
          .select("*, blocks:timeline_block_id(tab_id, tabs(project_id, projects(name)))")
          .eq("id", params.id)
          .eq("workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Timeline event not found" };

        const blocks = data.blocks as { tabs: { project_id: string; projects: { name: string } | null } | null } | null;
        const propertiesMap = await enrichEntitiesWithProperties(supabase, workspaceId, "timeline_event", [params.id]);
        const props = propertiesMap.get(params.id) ?? [];

        const assigneeProp = props.find((p) => p.name === "Assignee");
        const tagsProp = props.find((p) => p.name === "Tags");
        const statusProp = props.find((p) => p.name === "Status");
        const priorityProp = props.find((p) => p.name === "Priority");
        const dueDateProp = props.find((p) => p.name === "Due Date");

        const assignees = parseAssigneeValue(assigneeProp?.value);
        const tags = normalizeTagsValue(tagsProp?.value).map((tag) => tag.name);
        const rawStatus = normalizeSelectValue(statusProp?.value) ?? (typeof data.status === "string" ? data.status : null);
        const status = normalizeStatusValue(rawStatus);
        const rawPriority = normalizeSelectValue(priorityProp?.value) ?? (typeof data.priority === "string" ? data.priority : null);
        const priority = normalizePriorityValue(rawPriority);
        const dueDate = normalizeDateValue(dueDateProp?.value);

        const enrichedData = {
          ...data,
          status,
          priority,
          assignees,
          tags,
          due_date: dueDate,
        };

        return {
          data: {
            type: "timeline_event",
            id: data.id,
            name: data.title,
            data: enrichedData,
            context: {
              workspace_id: data.workspace_id,
              project_id: blocks?.tabs?.project_id ?? undefined,
              project_name: blocks?.tabs?.projects?.name ?? undefined,
            },
          },
          error: null,
        };
      }

      case "file": {
        const { data, error } = await supabase
          .from("files")
          .select("*, projects(name)")
          .eq("id", params.id)
          .eq("workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "File not found" };

        const project = coerceRelation<{ name: string }>(data.projects);
        if (!project) {
          return { data: null, error: "Tab project not found" };
        }

        return {
          data: {
            type: "file",
            id: data.id,
            name: data.file_name,
            data: data,
            context: {
              workspace_id: data.workspace_id,
              project_id: data.project_id,
              project_name: project?.name ?? undefined,
            },
          },
          error: null,
        };
      }

      case "payment": {
        const { data, error } = await supabase
          .from("payments")
          .select("*, projects(name), clients(name)")
          .eq("id", params.id)
          .eq("workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Payment not found" };

        const project = coerceRelation<{ name: string }>(data.projects);
        if (!project) {
          return { data: null, error: "Tab project not found" };
        }
        const client = coerceRelation<{ name: string }>(data.clients);

        return {
          data: {
            type: "payment",
            id: data.id,
            name: data.payment_number ?? `Payment ${data.id.slice(0, 8)}`,
            data: data,
            context: {
              workspace_id: data.workspace_id,
              project_id: data.project_id ?? undefined,
              project_name: project?.name ?? undefined,
              client_id: data.client_id ?? undefined,
              client_name: client?.name ?? undefined,
            },
          },
          error: null,
        };
      }

      case "tag": {
        const { data, error } = await supabase
          .from("task_tags")
          .select("*")
          .eq("id", params.id)
          .eq("workspace_id", workspaceId)
          .single();

        if (error || !data) return { data: null, error: error?.message ?? "Tag not found" };

        return {
          data: {
            type: "tag",
            id: data.id,
            name: data.name,
            data: data,
            context: { workspace_id: data.workspace_id },
          },
          error: null,
        };
      }

      default:
        return { data: null, error: `Unsupported entity type: ${params.entityType}` };
    }
  } catch (err) {
    console.error("getEntityById exception:", err);
    return { data: null, error: "Failed to get entity" };
  }
}

/**
 * Retrieves an entity with expanded context including properties, links, and relationships.
 * Use this when you need full context about an entity for decision-making.
 *
 * @param params.entityType - The type of entity (must be linkable: block, task, timeline_event, table_row)
 * @param params.id - The entity ID
 * @param params.includeProperties - Whether to include entity properties (default: true)
 * @param params.includeLinks - Whether to include entity links (default: true)
 */
export async function getEntityContext(params: {
  entityType: "block" | "task" | "subtask" | "timeline_event" | "table_row";
  id: string;
  includeProperties?: boolean;
  includeLinks?: boolean;
  authContext?: AuthContext;
}): Promise<{ data: EntityContextResult | null; error: string | null }> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const includeProperties = params.includeProperties ?? true;
  const includeLinks = params.includeLinks ?? true;

  try {
    // Get base entity
    const entityResult = await getEntityById({ entityType: params.entityType, id: params.id });
    if (entityResult.error || !entityResult.data) {
      return { data: null, error: entityResult.error ?? "Entity not found" };
    }

    const result: EntityContextResult = { ...entityResult.data };

    // Get entity properties
    if (includeProperties) {
      const { data: properties } = await supabase
        .from("entity_properties")
        .select("*, property_definitions(name, type)")
        .eq("entity_type", params.entityType)
        .eq("entity_id", params.id)
        .eq("workspace_id", workspaceId);

      if (properties && properties.length > 0) {
        result.properties = properties.map((p) => {
          const def = coerceRelation<{ name: string; type: string }>(p.property_definitions);
          return {
            id: p.property_definition_id,
            name: def?.name ?? "Unknown",
            type: def?.type ?? "unknown",
            value: p.value,
          };
        });
      }
    }

    // Get entity links (both directions)
    if (includeLinks) {
      const [outgoingResult, incomingResult] = await Promise.all([
        supabase
          .from("entity_links")
          .select("*")
          .eq("source_entity_type", params.entityType)
          .eq("source_entity_id", params.id)
          .eq("workspace_id", workspaceId),
        supabase
          .from("entity_links")
          .select("*")
          .eq("target_entity_type", params.entityType)
          .eq("target_entity_id", params.id)
          .eq("workspace_id", workspaceId),
      ]);

      const links: EntityContextResult["links"] = [];

      for (const link of outgoingResult.data ?? []) {
        links.push({
          direction: "outgoing",
          linked_entity_type: link.target_entity_type,
          linked_entity_id: link.target_entity_id,
        });
      }

      for (const link of incomingResult.data ?? []) {
        links.push({
          direction: "incoming",
          linked_entity_type: link.source_entity_type,
          linked_entity_id: link.source_entity_id,
        });
      }

      if (links.length > 0) {
        result.links = links;
      }
    }

    return { data: result, error: null };
  } catch (err) {
    console.error("getEntityContext exception:", err);
    return { data: null, error: "Failed to get entity context" };
  }
}

/**
 * Retrieves full context for any entity type including properties, links, and parent/children relationships.
 * Extended version of getEntityContext that works with all entity types.
 *
 * @param params.entityType - The type of entity to retrieve
 * @param params.id - The entity ID
 * @param params.includeProperties - Whether to include entity properties (default: true)
 * @param params.includeLinks - Whether to include entity links (default: true)
 * @param params.includeRelationships - Whether to include parent/children (default: true)
 */
export async function getEntityContextById(params: {
  entityType: EntityType;
  id: string;
  includeProperties?: boolean;
  includeLinks?: boolean;
  includeRelationships?: boolean;
  authContext?: AuthContext;
}): Promise<{ data: EntityContextResult | null; error: string | null }> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const includeProperties = params.includeProperties ?? true;
  const includeLinks = params.includeLinks ?? true;
  const includeRelationships = params.includeRelationships ?? true;

  try {
    // Get base entity
    const entityResult = await getEntityById({ entityType: params.entityType, id: params.id });
    if (entityResult.error || !entityResult.data) {
      return { data: null, error: entityResult.error ?? "Entity not found" };
    }

    const result: EntityContextResult = { ...entityResult.data };

    // Get entity properties (only for entity types that support properties)
    const propertyEntityTypes = ["task", "subtask", "block", "timeline_event"];
    if (includeProperties && propertyEntityTypes.includes(params.entityType)) {
      const { data: properties } = await supabase
        .from("entity_properties")
        .select("*, property_definitions(name, type)")
        .eq("entity_type", params.entityType)
        .eq("entity_id", params.id)
        .eq("workspace_id", workspaceId);

      if (properties && properties.length > 0) {
        result.properties = properties.map((p) => {
          const def = coerceRelation<{ name: string; type: string }>(p.property_definitions);
          return {
            id: p.property_definition_id,
            name: def?.name ?? "Unknown",
            type: def?.type ?? "unknown",
            value: p.value,
          };
        });
      }
    }

    // Get entity links (both directions)
    if (includeLinks) {
      const [outgoingResult, incomingResult] = await Promise.all([
        supabase
          .from("entity_links")
          .select("*")
          .eq("source_entity_type", params.entityType)
          .eq("source_entity_id", params.id)
          .eq("workspace_id", workspaceId),
        supabase
          .from("entity_links")
          .select("*")
          .eq("target_entity_type", params.entityType)
          .eq("target_entity_id", params.id)
          .eq("workspace_id", workspaceId),
      ]);

      const links: EntityContextResult["links"] = [];

      for (const link of outgoingResult.data ?? []) {
        links.push({
          direction: "outgoing",
          linked_entity_type: link.target_entity_type,
          linked_entity_id: link.target_entity_id,
        });
      }

      for (const link of incomingResult.data ?? []) {
        links.push({
          direction: "incoming",
          linked_entity_type: link.source_entity_type,
          linked_entity_id: link.source_entity_id,
        });
      }

      if (links.length > 0) {
        result.links = links;
      }
    }

    // Get parent/children relationships based on entity type
    if (includeRelationships) {
      switch (params.entityType) {
        case "tab": {
          // Tabs can have parent tabs and child tabs
          const entityData = entityResult.data.data as { parent_tab_id?: string };
          if (entityData.parent_tab_id) {
            const { data: parentTab } = await supabase
              .from("tabs")
              .select("id, name")
              .eq("id", entityData.parent_tab_id)
              .single();
            if (parentTab) {
              result.parent = { type: "tab", id: parentTab.id, name: parentTab.name };
            }
          }
          // Get child tabs
          const { data: childTabs } = await supabase
            .from("tabs")
            .select("id, name")
            .eq("parent_tab_id", params.id)
            .order("position");
          if (childTabs && childTabs.length > 0) {
            result.children = childTabs.map((t) => ({ type: "tab", id: t.id, name: t.name }));
          }
          break;
        }

        case "block": {
          // Blocks can have parent blocks and child blocks
          const entityData = entityResult.data.data as { parent_block_id?: string };
          if (entityData.parent_block_id) {
            const { data: parentBlock } = await supabase
              .from("blocks")
              .select("id, type, template_name")
              .eq("id", entityData.parent_block_id)
              .single();
            if (parentBlock) {
              result.parent = {
                type: "block",
                id: parentBlock.id,
                name: parentBlock.template_name ?? `${parentBlock.type} block`,
              };
            }
          }
          // Get child blocks
          const { data: childBlocks } = await supabase
            .from("blocks")
            .select("id, type, template_name")
            .eq("parent_block_id", params.id)
            .order("position");
          if (childBlocks && childBlocks.length > 0) {
            result.children = childBlocks.map((b) => ({
              type: "block",
              id: b.id,
              name: b.template_name ?? `${b.type} block`,
            }));
          }
          break;
        }

        case "project": {
          // Projects have tabs as children
          const { data: tabs } = await supabase
            .from("tabs")
            .select("id, name")
            .eq("project_id", params.id)
            .is("parent_tab_id", null)
            .order("position");
          if (tabs && tabs.length > 0) {
            result.children = tabs.map((t) => ({ type: "tab", id: t.id, name: t.name }));
          }
          break;
        }

        case "table": {
          // Tables have rows as children (limited)
          const { data: rows } = await supabase
            .from("table_rows")
            .select("id, order")
            .eq("table_id", params.id)
            .order("order")
            .limit(20);
          if (rows && rows.length > 0) {
            result.children = rows.map((r) => ({ type: "table_row", id: r.id, name: `Row ${r.order}` }));
          }
          break;
        }

        case "task": {
          // Tasks belong to a task block (parent)
          const entityData = entityResult.data.data as { task_block_id?: string };
          if (entityData.task_block_id) {
            const { data: taskBlock } = await supabase
              .from("blocks")
              .select("id, type, template_name")
              .eq("id", entityData.task_block_id)
              .single();
            if (taskBlock) {
              result.parent = {
                type: "block",
                id: taskBlock.id,
                name: taskBlock.template_name ?? `${taskBlock.type} block`,
              };
            }
          }
          break;
        }

        case "table_row": {
          // Table rows belong to a table (parent)
          const entityData = entityResult.data.data as { table_id?: string };
          if (entityData.table_id) {
            const { data: table } = await supabase
              .from("tables")
              .select("id, title")
              .eq("id", entityData.table_id)
              .single();
            if (table) {
              result.parent = { type: "table", id: table.id, name: table.title };
            }
          }
          break;
        }

        case "timeline_event": {
          // Timeline events belong to a timeline block (parent)
          const entityData = entityResult.data.data as { timeline_block_id?: string };
          if (entityData.timeline_block_id) {
            const { data: block } = await supabase
              .from("blocks")
              .select("id, type, template_name")
              .eq("id", entityData.timeline_block_id)
              .single();
            if (block) {
              result.parent = {
                type: "block",
                id: block.id,
                name: block.template_name ?? `${block.type} block`,
              };
            }
          }
          break;
        }

        case "file": {
          // Files belong to a project (parent)
          const entityData = entityResult.data.data as { project_id?: string };
          if (entityData.project_id) {
            const { data: project } = await supabase
              .from("projects")
              .select("id, name")
              .eq("id", entityData.project_id)
              .single();
            if (project) {
              result.parent = { type: "project", id: project.id, name: project.name };
            }
          }
          break;
        }

        case "payment": {
          // Payments can belong to a project (parent)
          const entityData = entityResult.data.data as { project_id?: string };
          if (entityData.project_id) {
            const { data: project } = await supabase
              .from("projects")
              .select("id, name")
              .eq("id", entityData.project_id)
              .single();
            if (project) {
              result.parent = { type: "project", id: project.id, name: project.name };
            }
          }
          break;
        }

        // client, member, doc, tag don't have standard parent/child relationships
        default:
          break;
      }
    }

    return { data: result, error: null };
  } catch (err) {
    console.error("getEntityContextById exception:", err);
    return { data: null, error: "Failed to get entity context" };
  }
}

/**
 * Retrieves the complete schema for a table including all fields, views, and row count.
 * Essential for understanding table structure before querying rows.
 *
 * @param params.tableId - The table ID
 */
export async function getTableSchema(params: {
  tableId: string;
  authContext?: AuthContext;
}): Promise<{ data: TableSchemaResult | null; error: string | null }> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;

  try {
    // Get table with project info
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("*, projects(name)")
      .eq("id", params.tableId)
      .eq("workspace_id", workspaceId)
      .single();

    if (tableError || !table) {
      return { data: null, error: tableError?.message ?? "Table not found" };
    }

    // Get fields, views, and row count in parallel
    const [fieldsResult, viewsResult, countResult] = await Promise.all([
      supabase
        .from("table_fields")
        .select("id, name, type, config, order, is_primary")
        .eq("table_id", params.tableId)
        .order("order"),
      supabase
        .from("table_views")
        .select("id, name, type, is_default")
        .eq("table_id", params.tableId)
        .order("created_at"),
      supabase
        .from("table_rows")
        .select("id", { count: "exact", head: true })
        .eq("table_id", params.tableId),
    ]);

    const project = coerceRelation<{ name: string }>(table.projects);

    return {
      data: {
        id: table.id,
        title: table.title,
        description: table.description,
        project_id: table.project_id,
        project_name: project?.name ?? null,
        fields: (fieldsResult.data ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          config: f.config as Record<string, unknown>,
          order: f.order,
          is_primary: f.is_primary,
        })),
        views: (viewsResult.data ?? []).map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          is_default: v.is_default,
        })),
        row_count: countResult.count ?? 0,
      },
      error: null,
    };
  } catch (err) {
    console.error("getTableSchema exception:", err);
    return { data: null, error: "Failed to get table schema" };
  }
}

/**
 * Lists all entity links for a given entity in both directions.
 * Useful for understanding relationships between entities.
 *
 * @param params.entityType - The entity type
 * @param params.entityId - The entity ID
 * @param params.direction - Filter by link direction (optional)
 * @param params.linkedEntityType - Filter by linked entity type (optional)
 */
export async function listEntityLinks(params: {
  entityType: string;
  entityId: string;
  direction?: "outgoing" | "incoming" | "both";
  linkedEntityType?: string;
  authContext?: AuthContext;
}): Promise<SearchResponse<{
  id: string;
  direction: "outgoing" | "incoming";
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
}>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const direction = params.direction ?? "both";

  try {
    const results: Array<{
      id: string;
      direction: "outgoing" | "incoming";
      source_entity_type: string;
      source_entity_id: string;
      target_entity_type: string;
      target_entity_id: string;
    }> = [];

    // Get outgoing links
    if (direction === "both" || direction === "outgoing") {
      let outgoingQuery = supabase
        .from("entity_links")
        .select("*")
        .eq("source_entity_type", params.entityType)
        .eq("source_entity_id", params.entityId)
        .eq("workspace_id", workspaceId);

      if (params.linkedEntityType) {
        outgoingQuery = outgoingQuery.eq("target_entity_type", params.linkedEntityType);
      }

      const { data: outgoing } = await outgoingQuery;

      for (const link of outgoing ?? []) {
        results.push({
          id: link.id,
          direction: "outgoing",
          source_entity_type: link.source_entity_type,
          source_entity_id: link.source_entity_id,
          target_entity_type: link.target_entity_type,
          target_entity_id: link.target_entity_id,
        });
      }
    }

    // Get incoming links
    if (direction === "both" || direction === "incoming") {
      let incomingQuery = supabase
        .from("entity_links")
        .select("*")
        .eq("target_entity_type", params.entityType)
        .eq("target_entity_id", params.entityId)
        .eq("workspace_id", workspaceId);

      if (params.linkedEntityType) {
        incomingQuery = incomingQuery.eq("source_entity_type", params.linkedEntityType);
      }

      const { data: incoming } = await incomingQuery;

      for (const link of incoming ?? []) {
        results.push({
          id: link.id,
          direction: "incoming",
          source_entity_type: link.source_entity_type,
          source_entity_id: link.source_entity_id,
          target_entity_type: link.target_entity_type,
          target_entity_id: link.target_entity_id,
        });
      }
    }

    return { data: results, error: null };
  } catch (err) {
    console.error("listEntityLinks exception:", err);
    return { data: null, error: "Failed to list entity links" };
  }
}

// ============================================================================
// ENTITY RESOLUTION
// ============================================================================

/**
 * Resolves a human-readable name to entity IDs.
 * Uses context-aware matching: if a projectId is provided, searches within that project first.
 * Returns matches ranked by confidence (exact > high > partial).
 *
 * @param params.entityType - The type of entity to resolve
 * @param params.name - The name to search for
 * @param params.projectId - Optional project context for scoped search
 * @param params.limit - Maximum results (default 5)
 */
export async function resolveEntityByName(params: {
  entityType: EntityType;
  name: string;
  projectId?: string;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<ResolvedEntity>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 5;
  const searchName = params.name.toLowerCase().trim();

  try {
    const results: ResolvedEntity[] = [];

    switch (params.entityType) {
      case "task": {
        const { data } = await supabase
          .from("task_items")
          .select("id, title, project_id, source_task_id, projects(name)")
          .eq("workspace_id", workspaceId)
          .is("source_task_id", null)
          .ilike("title", `%${searchName}%`)
          .limit(limit * 2);

        for (const task of data ?? []) {
          const titleLower = task.title.toLowerCase();
          const project = coerceRelation<{ name: string }>(task.projects);

          let confidence: "exact" | "high" | "partial" = "partial";
          if (titleLower === searchName) confidence = "exact";
          else if (titleLower.startsWith(searchName)) confidence = "high";

          const inTargetProject = params.projectId && task.project_id === params.projectId;

          results.push({
            id: task.id,
            name: task.title,
            type: "task",
            confidence: inTargetProject && confidence === "partial" ? "high" : confidence,
            context: {
              project_id: task.project_id ?? undefined,
              project_name: project?.name ?? undefined,
            },
          });
        }
        break;
      }

      case "subtask": {
        const { data } = await supabase
          .from("task_subtasks")
          .select(
            `
            id,
            title,
            task_id,
            task_items!inner(
              id,
              title,
              workspace_id,
              project_id,
              projects(name)
            )
          `
          )
          .eq("task_items.workspace_id", workspaceId)
          .ilike("title", `%${searchName}%`)
          .limit(limit * 2);

        for (const subtask of data ?? []) {
          const titleLower = subtask.title.toLowerCase();
          const task = coerceRelation<{ title?: string; project_id?: string | null; projects?: unknown }>(subtask.task_items);
          const project = coerceRelation<{ name: string }>(task?.projects);

          let confidence: "exact" | "high" | "partial" = "partial";
          if (titleLower === searchName) confidence = "exact";
          else if (titleLower.startsWith(searchName)) confidence = "high";

          const inTargetProject = params.projectId && task?.project_id === params.projectId;

          results.push({
            id: subtask.id,
            name: subtask.title,
            type: "subtask",
            confidence: inTargetProject && confidence === "partial" ? "high" : confidence,
            context: {
              project_id: task?.project_id ?? undefined,
              project_name: project?.name ?? undefined,
            },
          });
        }
        break;
      }

      case "project": {
        const { data } = await supabase
          .from("projects")
          .select("id, name, client_id, clients(name)")
          .eq("workspace_id", workspaceId)
          .ilike("name", `%${searchName}%`)
          .limit(limit * 2);

        for (const project of data ?? []) {
          const nameLower = project.name.toLowerCase();
          const client = coerceRelation<{ name: string }>(project.clients);

          let confidence: "exact" | "high" | "partial" = "partial";
          if (nameLower === searchName) confidence = "exact";
          else if (nameLower.startsWith(searchName)) confidence = "high";

          results.push({
            id: project.id,
            name: project.name,
            type: "project",
            confidence,
            context: {
              client_id: project.client_id ?? undefined,
              client_name: client?.name ?? undefined,
            },
          });
        }
        break;
      }

      case "client": {
        const { data } = await supabase
          .from("clients")
          .select("id, name")
          .eq("workspace_id", workspaceId)
          .ilike("name", `%${searchName}%`)
          .limit(limit * 2);

        for (const client of data ?? []) {
          const nameLower = client.name.toLowerCase();

          let confidence: "exact" | "high" | "partial" = "partial";
          if (nameLower === searchName) confidence = "exact";
          else if (nameLower.startsWith(searchName)) confidence = "high";

          results.push({
            id: client.id,
            name: client.name,
            type: "client",
            confidence,
          });
        }
        break;
      }

      case "member": {
        const { data: members } = await supabase
          .from("workspace_members")
          .select("id, user_id")
          .eq("workspace_id", workspaceId);

        if (members && members.length > 0) {
          const userIds = members.map((m) => m.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", userIds);

          for (const profile of profiles ?? []) {
            const nameLower = (profile.name ?? "").toLowerCase();
            const emailLower = profile.email.toLowerCase();
            const displayName = profile.name ?? profile.email;

            let confidence: "exact" | "high" | "partial" | null = null;

            if (nameLower === searchName || emailLower === searchName) {
              confidence = "exact";
            } else if (nameLower.startsWith(searchName) || emailLower.startsWith(searchName)) {
              confidence = "high";
            } else if (nameLower.includes(searchName) || emailLower.includes(searchName)) {
              confidence = "partial";
            }

            if (confidence) {
              results.push({
                id: profile.id,
                name: displayName,
                type: "member",
                confidence,
              });
            }
          }
        }
        break;
      }

      case "tab": {
        const { data } = await supabase
          .from("tabs")
          .select("id, name, project_id, projects!inner(workspace_id, name)")
          .eq("projects.workspace_id", workspaceId)
          .ilike("name", `%${searchName}%`)
          .limit(limit * 2);

        for (const tab of data ?? []) {
          const nameLower = tab.name.toLowerCase();
          const project = coerceRelation<{ name: string }>(tab.projects);

          let confidence: "exact" | "high" | "partial" = "partial";
          if (nameLower === searchName) confidence = "exact";
          else if (nameLower.startsWith(searchName)) confidence = "high";

          const inTargetProject = params.projectId && tab.project_id === params.projectId;

          results.push({
            id: tab.id,
            name: tab.name,
            type: "tab",
            confidence: inTargetProject && confidence === "partial" ? "high" : confidence,
            context: {
              project_id: tab.project_id,
              project_name: project?.name ?? undefined,
            },
          });
        }
        break;
      }

      case "doc": {
        const { data } = await supabase
          .from("docs")
          .select("id, title")
          .eq("workspace_id", workspaceId)
          .ilike("title", `%${searchName}%`)
          .limit(limit * 2);

        for (const doc of data ?? []) {
          const titleLower = doc.title.toLowerCase();

          let confidence: "exact" | "high" | "partial" = "partial";
          if (titleLower === searchName) confidence = "exact";
          else if (titleLower.startsWith(searchName)) confidence = "high";

          results.push({
            id: doc.id,
            name: doc.title,
            type: "doc",
            confidence,
          });
        }
        break;
      }

      case "table": {
        const { data } = await supabase
          .from("tables")
          .select("id, title, project_id, projects(name)")
          .eq("workspace_id", workspaceId)
          .ilike("title", `%${searchName}%`)
          .limit(limit * 2);

        for (const table of data ?? []) {
          const titleLower = table.title.toLowerCase();
          const project = coerceRelation<{ name: string }>(table.projects);

          let confidence: "exact" | "high" | "partial" = "partial";
          if (titleLower === searchName) confidence = "exact";
          else if (titleLower.startsWith(searchName)) confidence = "high";

          const inTargetProject = params.projectId && table.project_id === params.projectId;

          results.push({
            id: table.id,
            name: table.title,
            type: "table",
            confidence: inTargetProject && confidence === "partial" ? "high" : confidence,
            context: {
              project_id: table.project_id ?? undefined,
              project_name: project?.name ?? undefined,
            },
          });
        }
        break;
      }

      case "timeline_event": {
        const { data } = await supabase
          .from("timeline_events")
          .select("id, title")
          .eq("workspace_id", workspaceId)
          .ilike("title", `%${searchName}%`)
          .limit(limit * 2);

        for (const event of data ?? []) {
          const titleLower = event.title.toLowerCase();

          let confidence: "exact" | "high" | "partial" = "partial";
          if (titleLower === searchName) confidence = "exact";
          else if (titleLower.startsWith(searchName)) confidence = "high";

          results.push({
            id: event.id,
            name: event.title,
            type: "timeline_event",
            confidence,
          });
        }
        break;
      }

      case "file": {
        const { data } = await supabase
          .from("files")
          .select("id, file_name, project_id, projects(name)")
          .eq("workspace_id", workspaceId)
          .ilike("file_name", `%${searchName}%`)
          .limit(limit * 2);

        for (const file of data ?? []) {
          const nameLower = file.file_name.toLowerCase();
          const project = coerceRelation<{ name: string }>(file.projects);

          let confidence: "exact" | "high" | "partial" = "partial";
          if (nameLower === searchName) confidence = "exact";
          else if (nameLower.startsWith(searchName)) confidence = "high";

          const inTargetProject = params.projectId && file.project_id === params.projectId;

          results.push({
            id: file.id,
            name: file.file_name,
            type: "file",
            confidence: inTargetProject && confidence === "partial" ? "high" : confidence,
            context: {
              project_id: file.project_id,
              project_name: project?.name ?? undefined,
            },
          });
        }
        break;
      }

      case "payment": {
        const { data } = await supabase
          .from("payments")
          .select("id, payment_number, description, project_id, projects(name), client_id, clients(name)")
          .eq("workspace_id", workspaceId)
          .or(buildOrIlikeFilter(["payment_number", "description"], searchName))
          .limit(limit * 2);

        for (const payment of data ?? []) {
          const displayName = payment.payment_number ?? payment.description ?? `Payment ${payment.id.slice(0, 8)}`;
          const nameLower = displayName.toLowerCase();
          const project = coerceRelation<{ name: string }>(payment.projects);
          const client = coerceRelation<{ name: string }>(payment.clients);

          let confidence: "exact" | "high" | "partial" = "partial";
          if (nameLower === searchName) confidence = "exact";
          else if (nameLower.startsWith(searchName)) confidence = "high";

          const inTargetProject = params.projectId && payment.project_id === params.projectId;

          results.push({
            id: payment.id,
            name: displayName,
            type: "payment",
            confidence: inTargetProject && confidence === "partial" ? "high" : confidence,
            context: {
              project_id: payment.project_id ?? undefined,
              project_name: project?.name ?? undefined,
              client_id: payment.client_id ?? undefined,
              client_name: client?.name ?? undefined,
            },
          });
        }
        break;
      }

      case "tag": {
        const { data } = await supabase
          .from("task_tags")
          .select("id, name")
          .eq("workspace_id", workspaceId)
          .ilike("name", `%${searchName}%`)
          .limit(limit * 2);

        for (const tag of data ?? []) {
          const nameLower = tag.name.toLowerCase();

          let confidence: "exact" | "high" | "partial" = "partial";
          if (nameLower === searchName) confidence = "exact";
          else if (nameLower.startsWith(searchName)) confidence = "high";

          results.push({
            id: tag.id,
            name: tag.name,
            type: "tag",
            confidence,
          });
        }
        break;
      }

      default:
        break;
    }

    // Sort: exact > high > partial, then by project context match
    results.sort((a, b) => {
      const confidenceOrder = { exact: 0, high: 1, partial: 2 };
      const aOrder = confidenceOrder[a.confidence];
      const bOrder = confidenceOrder[b.confidence];

      if (aOrder !== bOrder) return aOrder - bOrder;

      if (params.projectId) {
        const aInProject = a.context?.project_id === params.projectId;
        const bInProject = b.context?.project_id === params.projectId;
        if (aInProject && !bInProject) return -1;
        if (!aInProject && bInProject) return 1;
      }

      return 0;
    });

    return { data: results.slice(0, limit), error: null };
  } catch (err) {
    console.error("resolveEntityByName exception:", err);
    return { data: null, error: "Failed to resolve entity" };
  }
}

// ============================================================================
// TABLE FIELD RESOLUTION
// ============================================================================

interface ResolvedTableField {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  order: number;
  is_primary: boolean;
  confidence: "exact" | "high" | "partial";
}

interface TableRowWithFieldNames {
  id: string;
  order: number;
  table_id: string;
  created_at: string;
  updated_at: string;
  data: Record<string, unknown>;
  fields: Record<string, { field_id: string; field_name: string; field_type: string; value: unknown }>;
}

/**
 * Resolves a field name to its field ID within a specific table.
 * Uses fuzzy matching to find the best match.
 *
 * @param params.tableId - The table ID
 * @param params.fieldName - The field name to resolve
 * @param params.limit - Maximum results (default 5)
 */
export async function resolveTableFieldByName(params: {
  tableId: string;
  fieldName: string;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<ResolvedTableField>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 5;
  const searchName = params.fieldName.toLowerCase().trim();

  try {
    // Verify table belongs to workspace
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("id")
      .eq("id", params.tableId)
      .eq("workspace_id", workspaceId)
      .single();

    if (tableError || !table) {
      return { data: null, error: "Table not found or not accessible" };
    }

    // Get all fields for the table
    const { data: fields, error: fieldsError } = await supabase
      .from("table_fields")
      .select("id, name, type, config, order, is_primary")
      .eq("table_id", params.tableId)
      .order("order");

    if (fieldsError) {
      return { data: null, error: fieldsError.message };
    }

    const results: ResolvedTableField[] = [];

    for (const field of fields ?? []) {
      const fieldNameLower = field.name.toLowerCase();

      let confidence: "exact" | "high" | "partial" | null = null;

      if (fieldNameLower === searchName) {
        confidence = "exact";
      } else if (fieldNameLower.startsWith(searchName) || searchName.startsWith(fieldNameLower)) {
        confidence = "high";
      } else if (fieldNameLower.includes(searchName) || searchName.includes(fieldNameLower)) {
        confidence = "partial";
      }

      if (confidence) {
        results.push({
          id: field.id,
          name: field.name,
          type: field.type,
          config: field.config as Record<string, unknown>,
          order: field.order,
          is_primary: field.is_primary,
          confidence,
        });
      }
    }

    // Sort by confidence
    results.sort((a, b) => {
      const confidenceOrder = { exact: 0, high: 1, partial: 2 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });

    return { data: results.slice(0, limit), error: null };
  } catch (err) {
    console.error("resolveTableFieldByName exception:", err);
    return { data: null, error: "Failed to resolve table field" };
  }
}

/**
 * Query table rows using human-readable field names instead of field IDs.
 * Automatically resolves field names to IDs and translates the response.
 *
 * @param params.tableId - The table ID
 * @param params.filters - Object with field names as keys and filter values
 * @param params.searchText - Optional text to search across all text fields
 * @param params.limit - Maximum results (default 50)
 */
export async function queryTableRowsByFieldNames(params: {
  tableId: string;
  filters?: Record<string, unknown>;
  searchText?: string;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<TableRowWithFieldNames>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;
  const limit = params.limit ?? 50;

  try {
    // Get table schema first
    const schemaResult = await getTableSchema({ tableId: params.tableId });
    if (schemaResult.error || !schemaResult.data) {
      return { data: null, error: schemaResult.error ?? "Table not found" };
    }

    const schema = schemaResult.data;

    // Build field name to ID/info mapping
    const fieldByName = new Map<string, { id: string; type: string }>();
    const fieldById = new Map<string, { name: string; type: string }>();

    for (const field of schema.fields) {
      const nameLower = field.name.toLowerCase();
      fieldByName.set(nameLower, { id: field.id, type: field.type });
      fieldById.set(field.id, { name: field.name, type: field.type });
    }

    // Resolve filter field names to IDs
    const resolvedFilters: Record<string, unknown> = {};

    if (params.filters) {
      for (const [fieldName, filterValue] of Object.entries(params.filters)) {
        const fieldInfo = fieldByName.get(fieldName.toLowerCase());
        if (fieldInfo) {
          resolvedFilters[fieldInfo.id] = filterValue;
        } else {
          // Try fuzzy match
          const resolved = await resolveTableFieldByName({
            tableId: params.tableId,
            fieldName,
            limit: 1,
          });
          if (resolved.data && resolved.data.length > 0 && resolved.data[0].confidence !== "partial") {
            resolvedFilters[resolved.data[0].id] = filterValue;
          }
        }
      }
    }

    // Build query
    let query = supabase
      .from("table_rows")
      .select("*")
      .eq("table_id", params.tableId);

    // Apply field filters using JSONB containment
    for (const [fieldId, filterValue] of Object.entries(resolvedFilters)) {
      // Use containment operator for JSONB filtering
      query = query.contains("data", { [fieldId]: filterValue });
    }

    const { data: rows, error: rowsError } = await query.order("order").limit(limit);

    if (rowsError) {
      return { data: null, error: rowsError.message };
    }

    // Transform results to include field names
    const results: TableRowWithFieldNames[] = [];

    for (const row of rows ?? []) {
      const data = row.data as Record<string, unknown>;
      const fields: Record<string, { field_id: string; field_name: string; field_type: string; value: unknown }> = {};

      // Translate field IDs to names
      for (const [fieldId, value] of Object.entries(data)) {
        const fieldInfo = fieldById.get(fieldId);
        if (fieldInfo) {
          fields[fieldInfo.name] = {
            field_id: fieldId,
            field_name: fieldInfo.name,
            field_type: fieldInfo.type,
            value,
          };
        }
      }

      // Apply text search filter on text fields
      if (params.searchText) {
        const searchLower = params.searchText.toLowerCase();
        const hasMatch = Object.values(fields).some((f) => {
          if (typeof f.value === "string") {
            return f.value.toLowerCase().includes(searchLower);
          }
          return false;
        });
        if (!hasMatch) continue;
      }

      results.push({
        id: row.id,
        order: row.order,
        table_id: row.table_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        data,
        fields,
      });
    }

    return { data: results, error: null };
  } catch (err) {
    console.error("queryTableRowsByFieldNames exception:", err);
    return { data: null, error: "Failed to query table rows" };
  }
}

/**
 * Bulk resolve multiple field names for a table.
 * More efficient than calling resolveTableFieldByName multiple times.
 *
 * @param params.tableId - The table ID
 * @param params.fieldNames - Array of field names to resolve
 */
export async function resolveTableFieldsByNames(params: {
  tableId: string;
  fieldNames: string[];
  authContext?: AuthContext;
}): Promise<{
  data: Record<string, { id: string; type: string; confidence: "exact" | "high" | "partial" } | null> | null;
  error: string | null;
}> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const { supabase, workspaceId } = ctx;

  try {
    // Verify table belongs to workspace
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("id")
      .eq("id", params.tableId)
      .eq("workspace_id", workspaceId)
      .single();

    if (tableError || !table) {
      return { data: null, error: "Table not found or not accessible" };
    }

    // Get all fields for the table
    const { data: fields, error: fieldsError } = await supabase
      .from("table_fields")
      .select("id, name, type")
      .eq("table_id", params.tableId);

    if (fieldsError) {
      return { data: null, error: fieldsError.message };
    }

    // Build result map
    const result: Record<string, { id: string; type: string; confidence: "exact" | "high" | "partial" } | null> = {};

    for (const searchName of params.fieldNames) {
      const searchLower = searchName.toLowerCase().trim();
      let bestMatch: { id: string; type: string; confidence: "exact" | "high" | "partial" } | null = null;

      for (const field of fields ?? []) {
        const fieldNameLower = field.name.toLowerCase();

        if (fieldNameLower === searchLower) {
          bestMatch = { id: field.id, type: field.type, confidence: "exact" };
          break; // Exact match, no need to continue
        } else if (fieldNameLower.startsWith(searchLower) || searchLower.startsWith(fieldNameLower)) {
          if (!bestMatch || bestMatch.confidence === "partial") {
            bestMatch = { id: field.id, type: field.type, confidence: "high" };
          }
        } else if (fieldNameLower.includes(searchLower) || searchLower.includes(fieldNameLower)) {
          if (!bestMatch) {
            bestMatch = { id: field.id, type: field.type, confidence: "partial" };
          }
        }
      }

      result[searchName] = bestMatch;
    }

    return { data: result, error: null };
  } catch (err) {
    console.error("resolveTableFieldsByNames exception:", err);
    return { data: null, error: "Failed to resolve table fields" };
  }
}

// ============================================================================
// UNIVERSAL ENTITY PROPERTY SEARCH
// ============================================================================

/**
 * Universal entity property search across tasks, subtasks, blocks, timeline events, and table rows.
 * Intended for broad queries like "everything not done".
 */
export async function searchEntitiesByProperties(params: {
  scope?: "workspace" | "project" | "tab";
  projectId?: string;
  tabId?: string;
  entityTypes?: Array<"task" | "subtask" | "block" | "timeline_event" | "table_row">;
  status?: string | string[];
  statusOperator?: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  priority?: string | string[];
  priorityOperator?: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  includeInherited?: boolean;
  includeWorkflowRepresentations?: boolean;
  limit?: number;
  authContext?: AuthContext;
}): Promise<SearchResponse<EntityReference>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error };

  const supabase = ctx.supabase!;
  const workspaceId = ctx.workspaceId!;

  try {
    const propDefs = await getPropertyDefinitionIds(supabase, workspaceId);
    const findPropDef = (name: string) =>
      propDefs.get(name) ||
      propDefs.get(name.toLowerCase()) ||
      propDefs.get(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());

    const properties: PropertyFilter[] = [];

    const statusValues = normalizeArrayFilter(params.status) ?? null;
    if (statusValues && statusValues.length > 0) {
      const statusPropDef = findPropDef("Status");
      if (statusPropDef) {
        properties.push({
          property_definition_id: statusPropDef.id,
          operator: params.statusOperator ?? "equals",
          value: statusValues[0],
        });
      }
    }

    const priorityValues = normalizeArrayFilter(params.priority) ?? null;
    if (priorityValues && priorityValues.length > 0) {
      const priorityPropDef = findPropDef("Priority");
      if (priorityPropDef) {
        properties.push({
          property_definition_id: priorityPropDef.id,
          operator: params.priorityOperator ?? "equals",
          value: priorityValues[0],
        });
      }
    }

    const scope =
      params.scope ??
      (params.tabId ? "tab" : params.projectId ? "project" : "workspace");

    const queryParams: QueryEntitiesParams = {
      scope,
      workspace_id: workspaceId,
      project_id: params.projectId,
      tab_id: params.tabId,
      entity_types: params.entityTypes,
      properties,
      include_inherited: params.includeInherited ?? true,
      include_workflow_representations: params.includeWorkflowRepresentations ?? false,
    };

    const result = await queryEntities({ ...queryParams, authContext: params.authContext });
    if ("error" in result) {
      return { data: null, error: result.error };
    }

    const data = params.limit ? result.data.slice(0, params.limit) : result.data;
    return { data, error: null };
  } catch (err) {
    console.error("searchEntitiesByProperties error:", err);
    return { data: null, error: "Failed to search entities by properties" };
  }
}

// ============================================================================
// UNIFIED SEARCH
// ============================================================================

interface SearchAllResult {
  type: EntityType | "block" | "comment";
  id: string;
  name: string;
  description?: string;
  context?: {
    project_id?: string;
    project_name?: string;
    tab_id?: string;
    tab_name?: string;
    client_id?: string;
    client_name?: string;
  };
}

interface PaginatedSearchResponse<T> {
  data: T[] | null;
  error: string | null;
  hasMore: boolean;
  totalCount?: number;
}

/**
 * Search across all entity types in the workspace.
 * Useful when the entity type is unknown.
 * Returns results from all entity types, sorted by relevance.
 * Now includes blocks, tabs, subtasks, table rows, and comments.
 *
 * @param params.searchText - The text to search for
 * @param params.projectId - Optional project context to prioritize
 * @param params.entityTypes - Optional array of entity types to search (default: all)
 * @param params.includeContent - Whether to search doc content (default: false for performance)
 * @param params.limit - Maximum results per entity type (default 5)
 * @param params.offset - Offset for pagination (default 0)
 */
export async function searchAll(params: {
  searchText: string;
  projectId?: string;
  entityTypes?: Array<EntityType | "block" | "comment">;
  includeContent?: boolean;
  limit?: number;
  offset?: number;
  authContext?: AuthContext;
}): Promise<PaginatedSearchResponse<SearchAllResult>> {
  const ctx = await getSearchContext({ authContext: params.authContext });
  if (ctx.error !== null) return { data: null, error: ctx.error, hasMore: false };

  const limitPerType = params.limit ?? 5;
  const offset = params.offset ?? 0;
  const includeContent = params.includeContent ?? false;
  const results: SearchAllResult[] = [];

  // Determine which entity types to search
  const allTypes: Array<EntityType | "block" | "comment"> = [
    "task",
    "subtask",
    "project",
    "client",
    "member",
    "tab",
    "block",
    "doc",
    "table",
    "table_row",
    "timeline_event",
    "file",
    "payment",
    "tag",
    "comment",
  ];
  const typesToSearch = params.entityTypes ?? allTypes;

  try {
    // Build search promises based on selected types
    const searchPromises: Promise<unknown>[] = [];
    const typeOrder: string[] = [];

    if (typesToSearch.includes("task")) {
      searchPromises.push(searchTasks({ searchText: params.searchText, projectId: params.projectId, limit: limitPerType }));
      typeOrder.push("task");
    }
    if (typesToSearch.includes("subtask")) {
      searchPromises.push(searchSubtasks({ searchText: params.searchText, projectId: params.projectId, limit: limitPerType }));
      typeOrder.push("subtask");
    }
    if (typesToSearch.includes("project")) {
      searchPromises.push(searchProjects({ searchText: params.searchText, limit: limitPerType }));
      typeOrder.push("project");
    }
    if (typesToSearch.includes("client")) {
      searchPromises.push(searchClients({ searchText: params.searchText, limit: limitPerType }));
      typeOrder.push("client");
    }
    if (typesToSearch.includes("member")) {
      searchPromises.push(searchWorkspaceMembers({ searchText: params.searchText, limit: limitPerType }));
      typeOrder.push("member");
    }
    if (typesToSearch.includes("tab")) {
      searchPromises.push(searchTabs({ searchText: params.searchText, projectId: params.projectId, limit: limitPerType }));
      typeOrder.push("tab");
    }
    if (typesToSearch.includes("block")) {
      searchPromises.push(searchBlocks({ searchText: params.searchText, projectId: params.projectId, limit: limitPerType }));
      typeOrder.push("block");
    }
    if (typesToSearch.includes("doc")) {
      searchPromises.push(searchDocs({
        searchText: params.searchText,
        searchBoth: includeContent,
        limit: limitPerType
      }));
      typeOrder.push("doc");
    }
    if (typesToSearch.includes("table")) {
      searchPromises.push(searchTables({ searchText: params.searchText, projectId: params.projectId, limit: limitPerType }));
      typeOrder.push("table");
    }
    if (typesToSearch.includes("table_row")) {
      searchPromises.push(searchTableRows({ searchText: params.searchText, projectId: params.projectId, limit: limitPerType }));
      typeOrder.push("table_row");
    }
    if (typesToSearch.includes("timeline_event")) {
      searchPromises.push(searchTimelineEvents({ searchText: params.searchText, projectId: params.projectId, limit: limitPerType }));
      typeOrder.push("timeline_event");
    }
    if (typesToSearch.includes("file")) {
      searchPromises.push(searchFiles({ searchText: params.searchText, projectId: params.projectId, limit: limitPerType }));
      typeOrder.push("file");
    }
    if (typesToSearch.includes("payment")) {
      searchPromises.push(searchPayments({ searchText: params.searchText, projectId: params.projectId, limit: limitPerType }));
      typeOrder.push("payment");
    }
    if (typesToSearch.includes("tag")) {
      searchPromises.push(searchTags({ searchText: params.searchText, limit: limitPerType }));
      typeOrder.push("tag");
    }
    if (typesToSearch.includes("comment")) {
      searchPromises.push(searchComments({ searchText: params.searchText, limit: limitPerType }));
      typeOrder.push("comment");
    }

    const searchResults = await Promise.all(searchPromises);

    // Process results by type
    for (let i = 0; i < typeOrder.length; i++) {
      const entityType = typeOrder[i];
      const result = searchResults[i] as SearchResponse<unknown>;

      if (!result.data) continue;

      switch (entityType) {
        case "task":
          for (const task of result.data as TaskResult[]) {
            results.push({
              type: "task",
              id: task.id,
              name: task.title,
              description: task.description ?? undefined,
              context: {
                project_id: task.project_id ?? undefined,
                project_name: task.project_name ?? undefined,
                tab_id: task.tab_id ?? undefined,
                tab_name: task.tab_name ?? undefined,
              },
            });
          }
          break;
        case "subtask":
          for (const subtask of result.data as SubtaskResult[]) {
            results.push({
              type: "subtask",
              id: subtask.id,
              name: subtask.title,
              description: subtask.description ?? undefined,
              context: {
                project_id: subtask.project_id ?? undefined,
                project_name: subtask.project_name ?? undefined,
                tab_id: subtask.tab_id ?? undefined,
                tab_name: subtask.tab_name ?? undefined,
              },
            });
          }
          break;

        case "project":
          for (const project of result.data as ProjectResult[]) {
            results.push({
              type: "project",
              id: project.id,
              name: project.name,
              context: {
                client_id: project.client_id ?? undefined,
                client_name: project.client_name ?? undefined,
              },
            });
          }
          break;

        case "client":
          for (const client of result.data as ClientResult[]) {
            results.push({
              type: "client",
              id: client.id,
              name: client.name,
              description: client.company ?? undefined,
            });
          }
          break;

        case "member":
          for (const member of result.data as WorkspaceMemberResult[]) {
            results.push({
              type: "member",
              id: member.user_id,
              name: member.name ?? member.email,
              description: member.role,
            });
          }
          break;

        case "tab":
          for (const tab of result.data as TabResult[]) {
            results.push({
              type: "tab",
              id: tab.id,
              name: tab.name,
              context: {
                project_id: tab.project_id,
                project_name: tab.project_name ?? undefined,
              },
            });
          }
          break;

        case "block":
          for (const block of result.data as BlockResult[]) {
            results.push({
              type: "block",
              id: block.id,
              name: block.template_name ?? `${block.type} block`,
              description: block.type,
              context: {
                project_id: block.project_id ?? undefined,
                project_name: block.project_name ?? undefined,
                tab_id: block.tab_id,
                tab_name: block.tab_name ?? undefined,
              },
            });
          }
          break;

        case "doc":
          for (const doc of result.data as DocResult[]) {
            results.push({
              type: "doc",
              id: doc.id,
              name: doc.title,
            });
          }
          break;

        case "table":
          for (const table of result.data as TableResult[]) {
            results.push({
              type: "table",
              id: table.id,
              name: table.title,
              description: table.description ?? undefined,
              context: {
                project_id: table.project_id ?? undefined,
                project_name: table.project_name ?? undefined,
              },
            });
          }
          break;

        case "table_row":
          for (const row of result.data as TableRowResult[]) {
            results.push({
              type: "table_row",
              id: row.id,
              name: `Row in ${row.table_title ?? "table"}`,
              description: JSON.stringify(row.data).slice(0, 100),
              context: {
                project_id: row.project_id ?? undefined,
                project_name: row.project_name ?? undefined,
              },
            });
          }
          break;

        case "timeline_event":
          for (const event of result.data as TimelineEventResult[]) {
            results.push({
              type: "timeline_event",
              id: event.id,
              name: event.title,
              description: event.notes ?? undefined,
              context: {
                project_id: event.project_id ?? undefined,
                project_name: event.project_name ?? undefined,
              },
            });
          }
          break;

        case "file":
          for (const file of result.data as FileResult[]) {
            results.push({
              type: "file",
              id: file.id,
              name: file.file_name,
              description: file.file_type ?? undefined,
              context: {
                project_id: file.project_id,
                project_name: file.project_name ?? undefined,
              },
            });
          }
          break;

        case "payment":
          for (const payment of result.data as PaymentResult[]) {
            results.push({
              type: "payment",
              id: payment.id,
              name: payment.payment_number ?? `Payment ${payment.id.slice(0, 8)}`,
              description: payment.description ?? undefined,
              context: {
                project_id: payment.project_id ?? undefined,
                project_name: payment.project_name ?? undefined,
                client_id: payment.client_id ?? undefined,
                client_name: payment.client_name ?? undefined,
              },
            });
          }
          break;

        case "tag":
          for (const tag of result.data as TagResult[]) {
            results.push({
              type: "tag",
              id: tag.id,
              name: tag.name,
            });
          }
          break;

        case "comment":
          for (const comment of result.data as CommentResult[]) {
            results.push({
              type: "comment" as EntityType,
              id: comment.id,
              name: comment.text.slice(0, 50) + (comment.text.length > 50 ? "..." : ""),
              description: `${comment.target_type} comment by ${comment.user_name ?? "unknown"}`,
            });
          }
          break;
      }
    }

    // Sort by relevance
    const searchLower = params.searchText.toLowerCase();
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === searchLower;
      const bExact = b.name.toLowerCase() === searchLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      if (params.projectId) {
        const aInProject = a.context?.project_id === params.projectId;
        const bInProject = b.context?.project_id === params.projectId;
        if (aInProject && !bInProject) return -1;
        if (!aInProject && bInProject) return 1;
      }

      const aStarts = a.name.toLowerCase().startsWith(searchLower);
      const bStarts = b.name.toLowerCase().startsWith(searchLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return 0;
    });

    // Apply pagination
    const totalCount = results.length;
    const paginatedResults = results.slice(offset, offset + (limitPerType * typesToSearch.length));
    const hasMore = offset + paginatedResults.length < totalCount;

    return { data: paginatedResults, error: null, hasMore, totalCount };
  } catch (err) {
    console.error("searchAll exception:", err);
    return { data: null, error: "Failed to search", hasMore: false };
  }
}

// ============================================================================
// SUMMARY
// ============================================================================

/*
AI SEARCH FUNCTIONS SUMMARY
===========================

This module provides comprehensive search capabilities for the AI assistant to find
and resolve entities before performing actions on them.

SEARCH FUNCTIONS (with overfetch strategy for post-query filters):
------------------------------------------------------------------
1.  searchTasks - Search tasks with assignees, tags, project/tab context
    - NEW: assigneeName, tagName params for fuzzy name matching
    - Overfetches 10x when post-filters applied to prevent missing results
2.  searchProjects - Search projects with client names
3.  searchClients - Search clients by name, email, company
4.  searchWorkspaceMembers - Search members with profile info (name, email)
5.  searchTabs - Search tabs with project context
6.  searchBlocks - Search blocks with tab/project context
    - NEW: projectName param for fuzzy project matching
    - Overfetches when post-filters applied
7.  searchDocs - Search documents by title AND/OR content
    - NEW: contentSearch param for searching doc body text
    - NEW: searchBoth flag to search title + content simultaneously
8.  searchDocContent - NEW: Extract text snippets from doc content
9.  searchTables - Search tables with project context
10. searchTableFields - Search table columns/fields
11. searchTableRows - Search table rows by JSONB data content
    - Overfetches when post-filters applied
12. searchTimelineEvents - Search timeline events with assignee names
    - NEW: assigneeName, projectName params for fuzzy matching
    - Overfetches when post-filters applied
13. searchFiles - Search files with uploader and project info
14. searchComments - Search comments on blocks/tabs/projects
15. searchTaskComments - Search task-specific comments
16. searchPayments - Search payments with client/project context
17. searchTags - Search task tags
18. searchPropertyDefinitions - Search custom property definitions
19. searchEntityLinks - Search links between entities

ENTITY RETRIEVAL PRIMITIVES:
----------------------------
getEntityById - Fetch any entity by type and ID with full context
  - Supports all 14 entity types
  - Returns workspace/project/client context

getEntityContext - Get entity with properties, links, and relationships
  - Includes custom properties from property_definitions
  - Bidirectional entity links
  - For linkable entities: block, task, timeline_event, table_row

getTableSchema - Get complete table structure for AI interpretation
  - All fields with types, configs, order
  - All views
  - Row count

listEntityLinks - Query entity links bidirectionally
  - Filter by direction: outgoing, incoming, both
  - Filter by linked entity type

TABLE FIELD RESOLUTION:
-----------------------
resolveTableFieldByName - Resolve field name to field ID within a table
  - Fuzzy matching with confidence levels
  - Essential for AI to translate "Status" → field_id_xxx

queryTableRowsByFieldNames - Query rows using human-readable field names
  - Automatically resolves field names to IDs
  - Returns data with both field IDs and names
  - Supports JSONB containment filters

resolveTableFieldsByNames - Bulk resolve multiple field names efficiently
  - Single query for multiple field name lookups
  - Returns map of name → { id, type, confidence }

ENTITY RESOLUTION:
------------------
resolveEntityByName - Converts human-readable names to entity IDs
  - Context-aware: prioritizes matches in specified project
  - Returns confidence levels: exact, high, partial
  - Supports all entity types

UNIFIED SEARCH:
---------------
searchAll - Search across all entity types at once
  - NOW includes: blocks, tabs, table_rows, comments (was missing)
  - NEW: entityTypes param to filter which types to search
  - NEW: includeContent param for doc content search
  - NEW: Pagination with offset, hasMore, totalCount
  - Returns results sorted by relevance
  - Prioritizes project context matches

COMMON FEATURES:
----------------
- All functions scope to current workspace for security
- DateFilter interface for date range queries: { eq?, gte?, lte?, isNull? }
- Array filters accept single value or array
- Rich results include related entity names (not just IDs)
- Consistent { data, error } response shape
- ILIKE fuzzy text search
- Configurable result limits
- Overfetch strategy prevents post-query filter misses

USAGE EXAMPLES:
---------------
// Find John's tasks in a specific project (using name, not ID)
const tasks = await searchTasks({
  assigneeName: 'John',
  projectId: 'some-project-id',
  status: ['todo', 'in-progress']
});

// Search everything for "website" with pagination
const results = await searchAll({
  searchText: 'website',
  projectId: currentProjectId,
  entityTypes: ['task', 'doc', 'project'],
  includeContent: true,
  limit: 10,
  offset: 0
});

// Query table rows by human-readable field names
const rows = await queryTableRowsByFieldNames({
  tableId: 'table-id',
  filters: { 'Status': 'Blocked', 'Owner': 'John' }
});

// Get full context for a task
const context = await getEntityContext({
  entityType: 'task',
  id: 'task-id',
  includeProperties: true,
  includeLinks: true
});

// Resolve field names before updating table row
const fields = await resolveTableFieldsByNames({
  tableId: 'table-id',
  fieldNames: ['Status', 'Priority', 'Due Date']
});
*/
