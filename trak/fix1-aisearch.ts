"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import type { BlockType } from "@/app/actions/block";
import type { PropertyDefinition } from "@/types/properties";

interface SearchResponse<T> {
  data: T[] | null;
  error: string | null;
}

interface TaskSearchResult {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  task_block_id: string | null;
  tab_id: string | null;
  project_id: string | null;
  workspace_id: string;
  assignees: Array<{ id: string | null; name: string }>;
  tags: string[];
  taskType: "block";
  created_at: string;
  updated_at: string;
}

interface BlockSearchResult {
  id: string;
  tab_id: string;
  parent_block_id: string | null;
  type: BlockType;
  content: Record<string, unknown>;
  position: number;
  column: number;
  is_template: boolean;
  template_name: string | null;
  original_block_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TableRowSearchResult {
  id: string;
  table_id: string;
  table_title: string | null;
  project_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface DocSearchResult {
  id: string;
  title: string;
  content: Record<string, unknown> | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectSearchResult {
  id: string;
  name: string;
  client_id: string | null;
  status: string;
  due_date_date: string | null;
  due_date_text: string | null;
  project_type: string;
  created_at: string;
  updated_at: string;
}

interface ClientSearchResult {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  created_at: string;
}

interface TabSearchResult {
  id: string;
  project_id: string;
  name: string;
  parent_tab_id: string | null;
  position: number;
  is_client_visible: boolean;
  client_title: string | null;
  created_at: string;
}

interface TableSearchResult {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

interface TableFieldSearchResult {
  id: string;
  table_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  order: number;
  is_primary: boolean;
  width: number | null;
  created_at: string;
  updated_at: string;
}

interface TimelineEventSearchResult {
  id: string;
  timeline_block_id: string;
  workspace_id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string | null;
  assignee_id: string | null;
  progress: number;
  notes: string | null;
  color: string | null;
  is_milestone: boolean;
  created_at: string;
  updated_at: string;
}

interface FileSearchResult {
  id: string;
  file_id: string;
  workspace_id: string;
  project_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number;
  storage_path: string;
  bucket: string;
  uploaded_by: string;
  created_at: string;
  block_id: string | null;
  display_mode: string | null;
  attachment_id: string | null;
  is_attached: boolean;
}

interface CommentSearchResult {
  id: string;
  source: "comment" | "task_comment" | "table_comment";
  target_type: string;
  target_id: string;
  user_id: string | null;
  text: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface WorkspaceMemberSearchResult {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  name: string | null;
  email: string | null;
}

interface EntityLinkSearchResult {
  id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  workspace_id: string;
  created_at: string;
}

interface EntityPropertySearchResult {
  id: string;
  entity_type: string;
  entity_id: string;
  workspace_id: string;
  status: string | null;
  priority: string | null;
  assignee_id: string | null;
  due_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface BlockTemplateSearchResult {
  id: string;
  template_name: string | null;
  type: BlockType;
  content: Record<string, unknown>;
  tab_id: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectTemplateSearchResult {
  id: string;
  name: string;
  project_type: string;
  created_at: string;
  updated_at: string;
}

interface PropertyDefinitionSearchResult extends PropertyDefinition {}

const DEFAULT_LIMIT = 100;

async function getSearchContext() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return { error: "No workspace selected" as const };
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized" as const };
  }

  const supabase = await createClient();
  return { workspaceId, supabase };
}

function normalizeArrayFilter(value?: string | string[]) {
  if (!value) return null;
  return Array.isArray(value) ? value : [value];
}

export async function searchTasks(params: {
  assignee?: string;
  assigneeId?: string;
  status?: string | string[];
  priority?: string | string[];
  tags?: string[];
  searchText?: string;
  dueAfter?: string;
  dueBefore?: string;
  projectId?: string;
  tabId?: string;
  includeArchived?: boolean;
  limit?: number;
}): Promise<SearchResponse<TaskSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();
  const statusFilter = normalizeArrayFilter(params.status);
  const priorityFilter = normalizeArrayFilter(params.priority);

  try {
    let query = supabase
      .from("task_items")
      .select(
        "id, title, status, priority, due_date, task_block_id, tab_id, project_id, workspace_id, created_at, updated_at, task_assignees(assignee_id, assignee_name), task_tag_links(task_tags(name))"
      )
      .eq("workspace_id", workspaceId);

    if (statusFilter) {
      query = query.in("status", statusFilter);
    }

    if (priorityFilter) {
      query = query.in("priority", priorityFilter);
    }

    if (searchText) {
      query = query.ilike("title", `%${searchText}%`);
    }

    if (params.dueAfter) {
      query = query.gte("due_date", params.dueAfter);
    }

    if (params.dueBefore) {
      query = query.lte("due_date", params.dueBefore);
    }

    if (params.projectId) {
      query = query.eq("project_id", params.projectId);
    }

    if (params.tabId) {
      query = query.eq("tab_id", params.tabId);
    }

    query = query.limit(limit);

    const { data: taskItems, error: taskItemsError } = await query;

    if (taskItemsError) {
      console.error("searchTasks task_items error:", taskItemsError);
      return { data: null, error: taskItemsError.message };
    }

    const mappedTaskItems: TaskSearchResult[] = (taskItems ?? []).map((item: any) => {
      const assignees = Array.isArray(item.task_assignees)
        ? item.task_assignees.map((assignee: any) => ({
            id: assignee.assignee_id,
            name: assignee.assignee_name,
          }))
        : [];
      const tags = Array.isArray(item.task_tag_links)
        ? item.task_tag_links
            .map((link: any) => link.task_tags?.name)
            .filter((name: string | undefined) => Boolean(name))
        : [];

      return {
        id: item.id,
        title: item.title,
        status: item.status,
        priority: item.priority,
        due_date: item.due_date,
        task_block_id: item.task_block_id,
        tab_id: item.tab_id,
        project_id: item.project_id,
        workspace_id: item.workspace_id,
        assignees,
        tags,
        taskType: "block",
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
    });

    let standaloneQuery = supabase
      .from("standalone_tasks")
      .select("id, workspace_id, text, status, priority, due_date, tags, assignees, created_at, updated_at")
      .eq("workspace_id", workspaceId);

    if (statusFilter) {
      standaloneQuery = standaloneQuery.in("status", statusFilter);
    }

    if (priorityFilter) {
      standaloneQuery = standaloneQuery.in("priority", priorityFilter);
    }

    if (searchText) {
      standaloneQuery = standaloneQuery.ilike("text", `%${searchText}%`);
    }

    if (params.dueAfter) {
      standaloneQuery = standaloneQuery.gte("due_date", params.dueAfter);
    }

    if (params.dueBefore) {
      standaloneQuery = standaloneQuery.lte("due_date", params.dueBefore);
    }

    standaloneQuery = standaloneQuery.limit(limit);

    const { data: standaloneTasks, error: standaloneError } = await standaloneQuery;

    if (standaloneError) {
      console.error("searchTasks standalone_tasks error:", standaloneError);
      return { data: null, error: standaloneError.message };
    }

    const mappedStandaloneTasks: TaskSearchResult[] = (standaloneTasks ?? []).map((task: any) => ({
      id: task.id,
      title: task.text,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      task_block_id: null,
      tab_id: null,
      project_id: null,
      workspace_id: task.workspace_id,
      assignees: Array.isArray(task.assignees)
        ? task.assignees.map((name: string) => ({ id: null, name }))
        : [],
      tags: Array.isArray(task.tags) ? task.tags : [],
      taskType: "standalone",
      created_at: task.created_at,
      updated_at: task.updated_at,
    }));

    let combined = [...mappedTaskItems, ...mappedStandaloneTasks];

    if (params.assignee) {
      const assigneeLower = params.assignee.toLowerCase();
      combined = combined.filter((task) =>
        task.assignees.some((assignee) => assignee.name?.toLowerCase().includes(assigneeLower))
      );
    }

    if (params.assigneeId) {
      combined = combined.filter((task) =>
        task.assignees.some((assignee) => assignee.id === params.assigneeId)
      );
    }

    if (params.tags && params.tags.length > 0) {
      combined = combined.filter((task) => params.tags!.some((tag) => task.tags.includes(tag)));
    }

    return { data: combined.slice(0, limit), error: null };
  } catch (error) {
    console.error("searchTasks error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchBlocks(params: {
  type?: BlockType | BlockType[];
  tabId?: string;
  parentBlockId?: string;
  searchText?: string;
  includeArchived?: boolean;
  limit?: number;
}): Promise<SearchResponse<BlockSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();
  const typeFilter = normalizeArrayFilter(params.type as string | string[] | undefined);

  try {
    let query = supabase
      .from("blocks")
      .select(
        "id, tab_id, parent_block_id, type, content, position, column, is_template, template_name, original_block_id, created_at, updated_at, tabs!inner(id, project_id, projects!inner(workspace_id))"
      )
      .eq("tabs.projects.workspace_id", workspaceId);

    if (typeFilter) {
      query = query.in("type", typeFilter);
    }

    if (params.tabId) {
      query = query.eq("tab_id", params.tabId);
    }

    if (params.parentBlockId) {
      query = query.eq("parent_block_id", params.parentBlockId);
    }

    if (searchText) {
      query = query.ilike("content::text", `%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchBlocks error:", error);
      return { data: null, error: error.message };
    }

    const mapped = (data ?? []).map((block: any) => ({
      id: block.id,
      tab_id: block.tab_id,
      parent_block_id: block.parent_block_id,
      type: block.type,
      content: block.content,
      position: block.position,
      column: block.column,
      is_template: block.is_template,
      template_name: block.template_name,
      original_block_id: block.original_block_id,
      project_id: block.tabs?.project_id ?? null,
      created_at: block.created_at,
      updated_at: block.updated_at,
    }));

    return { data: mapped, error: null };
  } catch (error) {
    console.error("searchBlocks error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchTableRows(params: {
  tableId?: string;
  searchText?: string;
  fieldFilters?: Record<string, unknown>;
  limit?: number;
}): Promise<SearchResponse<TableRowSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();

  try {
    let query = supabase
      .from("table_rows")
      .select("id, table_id, data, created_at, updated_at, tables!inner(id, workspace_id, project_id, title)")
      .eq("tables.workspace_id", workspaceId);

    if (params.tableId) {
      query = query.eq("table_id", params.tableId);
    }

    if (searchText) {
      query = query.ilike("data::text", `%${searchText}%`);
    }

    if (params.fieldFilters) {
      Object.entries(params.fieldFilters).forEach(([fieldId, value]) => {
        query = query.contains("data", { [fieldId]: value });
      });
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchTableRows error:", error);
      return { data: null, error: error.message };
    }

    const mapped = (data ?? []).map((row: any) => ({
      id: row.id,
      table_id: row.table_id,
      table_title: row.tables?.title ?? null,
      project_id: row.tables?.project_id ?? null,
      data: row.data,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return { data: mapped, error: null };
  } catch (error) {
    console.error("searchTableRows error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchDocs(params: {
  searchText?: string;
  includeArchived?: boolean;
  limit?: number;
}): Promise<SearchResponse<DocSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();

  try {
    let query = supabase
      .from("docs")
      .select("id, title, content, is_archived, created_at, updated_at")
      .eq("workspace_id", workspaceId);

    if (params.includeArchived === false) {
      query = query.eq("is_archived", false);
    }

    if (searchText) {
      query = query.or(`title.ilike.%${searchText}%,content::text.ilike.%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchDocs error:", error);
      return { data: null, error: error.message };
    }

    const mapped = (data ?? []).map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      is_archived: doc.is_archived,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    }));

    return { data: mapped, error: null };
  } catch (error) {
    console.error("searchDocs error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchProjects(params: {
  searchText?: string;
  clientId?: string;
  includeArchived?: boolean;
  limit?: number;
}): Promise<SearchResponse<ProjectSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();

  try {
    let query = supabase
      .from("projects")
      .select("id, name, client_id, status, due_date_date, due_date_text, project_type, created_at, updated_at")
      .eq("workspace_id", workspaceId);

    if (params.includeArchived === false) {
      query = query.eq("is_archived", false);
    }

    if (params.clientId) {
      query = query.eq("client_id", params.clientId);
    }

    if (searchText) {
      query = query.ilike("name", `%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchProjects error:", error);
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch (error) {
    console.error("searchProjects error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchClients(params: {
  searchText?: string;
  includeArchived?: boolean;
  limit?: number;
}): Promise<SearchResponse<ClientSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();

  try {
    let query = supabase
      .from("clients")
      .select("id, name, email, company, phone, created_at")
      .eq("workspace_id", workspaceId);

    if (searchText) {
      query = query.or(
        `name.ilike.%${searchText}%,email.ilike.%${searchText}%,company.ilike.%${searchText}%`
      );
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchClients error:", error);
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch (error) {
    console.error("searchClients error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchTabs(params: {
  searchText?: string;
  projectId?: string;
  limit?: number;
}): Promise<SearchResponse<TabSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();

  try {
    let query = supabase
      .from("tabs")
      .select("id, project_id, name, parent_tab_id, position, is_client_visible, client_title, created_at, projects!inner(workspace_id)")
      .eq("projects.workspace_id", workspaceId);

    if (params.projectId) {
      query = query.eq("project_id", params.projectId);
    }

    if (searchText) {
      query = query.or(`name.ilike.%${searchText}%,client_title.ilike.%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchTabs error:", error);
      return { data: null, error: error.message };
    }

    const mapped = (data ?? []).map((tab: any) => ({
      id: tab.id,
      project_id: tab.project_id,
      name: tab.name,
      parent_tab_id: tab.parent_tab_id ?? null,
      position: tab.position,
      is_client_visible: tab.is_client_visible,
      client_title: tab.client_title ?? null,
      created_at: tab.created_at,
    }));

    return { data: mapped, error: null };
  } catch (error) {
    console.error("searchTabs error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchTables(params: {
  searchText?: string;
  projectId?: string;
  limit?: number;
}): Promise<SearchResponse<TableSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();

  try {
    let query = supabase
      .from("tables")
      .select("id, workspace_id, project_id, title, description, icon, created_at, updated_at")
      .eq("workspace_id", workspaceId);

    if (params.projectId) {
      query = query.eq("project_id", params.projectId);
    }

    if (searchText) {
      query = query.or(`title.ilike.%${searchText}%,description.ilike.%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchTables error:", error);
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch (error) {
    console.error("searchTables error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchTableFields(params: {
  tableId?: string;
  searchText?: string;
  limit?: number;
}): Promise<SearchResponse<TableFieldSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();

  try {
    let query = supabase
      .from("table_fields")
      .select("id, table_id, name, type, config, order, is_primary, width, created_at, updated_at, tables!inner(workspace_id)")
      .eq("tables.workspace_id", workspaceId);

    if (params.tableId) {
      query = query.eq("table_id", params.tableId);
    }

    if (searchText) {
      query = query.ilike("name", `%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchTableFields error:", error);
      return { data: null, error: error.message };
    }

    const mapped = (data ?? []).map((field: any) => ({
      id: field.id,
      table_id: field.table_id,
      name: field.name,
      type: field.type,
      config: field.config,
      order: field.order,
      is_primary: field.is_primary,
      width: field.width,
      created_at: field.created_at,
      updated_at: field.updated_at,
    }));

    return { data: mapped, error: null };
  } catch (error) {
    console.error("searchTableFields error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchTimelineEvents(params: {
  searchText?: string;
  status?: string | string[];
  assigneeId?: string;
  startAfter?: string;
  endBefore?: string;
  limit?: number;
}): Promise<SearchResponse<TimelineEventSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();
  const statusFilter = normalizeArrayFilter(params.status);

  try {
    let query = supabase
      .from("timeline_events")
      .select(
        "id, timeline_block_id, workspace_id, title, start_date, end_date, status, assignee_id, progress, notes, color, is_milestone, created_at, updated_at"
      )
      .eq("workspace_id", workspaceId);

    if (statusFilter) {
      query = query.in("status", statusFilter);
    }

    if (params.assigneeId) {
      query = query.eq("assignee_id", params.assigneeId);
    }

    if (params.startAfter) {
      query = query.gte("start_date", params.startAfter);
    }

    if (params.endBefore) {
      query = query.lte("end_date", params.endBefore);
    }

    if (searchText) {
      query = query.or(`title.ilike.%${searchText}%,notes.ilike.%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchTimelineEvents error:", error);
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch (error) {
    console.error("searchTimelineEvents error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchFiles(params: {
  searchText?: string;
  blockId?: string;
  projectId?: string;
  limit?: number;
}): Promise<SearchResponse<FileSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();

  try {
    let query = supabase
      .from("files")
      .select(
        "id, workspace_id, file_name, file_size, file_type, storage_path, bucket, project_id, uploaded_by, created_at, file_attachments(id, block_id, display_mode)"
      )
      .eq("workspace_id", workspaceId);

    if (params.blockId) {
      query = query.eq("file_attachments.block_id", params.blockId);
    }

    if (params.projectId) {
      query = query.eq("project_id", params.projectId);
    }

    if (searchText) {
      query = query.ilike("file_name", `%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchFiles error:", error);
      return { data: null, error: error.message };
    }

    const mapped = (data ?? []).map((file: any) => {
      const attachment =
        Array.isArray(file.file_attachments) && file.file_attachments.length > 0
          ? file.file_attachments[0]
          : null;

      return {
        id: file.id,
        file_id: file.id,
        workspace_id: file.workspace_id,
        project_id: file.project_id,
        file_name: file.file_name,
        file_type: file.file_type,
        file_size: file.file_size,
        storage_path: file.storage_path,
        bucket: file.bucket,
        uploaded_by: file.uploaded_by,
        created_at: file.created_at,
        block_id: attachment?.block_id ?? null,
        display_mode: attachment?.display_mode ?? null,
        attachment_id: attachment?.id ?? null,
        is_attached: Boolean(attachment),
      };
    });

    return { data: mapped, error: null };
  } catch (error) {
    console.error("searchFiles error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchComments(params: {
  searchText?: string;
  targetType?: "project" | "tab" | "block" | "task" | "table_row";
  targetId?: string;
  limit?: number;
}): Promise<SearchResponse<CommentSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();
  const results: CommentSearchResult[] = [];

  try {
    const projectIds: string[] = [];
    const tabIds: string[] = [];
    const blockIds: string[] = [];

    if (!params.targetType || params.targetType === "project") {
      if (params.targetId) {
        projectIds.push(params.targetId);
      } else {
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("id")
          .eq("workspace_id", workspaceId);
        if (projectsError) {
          console.error("searchComments projects error:", projectsError);
          return { data: null, error: projectsError.message };
        }
        projectIds.push(...(projects ?? []).map((project: any) => project.id));
      }
    }

    if (!params.targetType || params.targetType === "tab") {
      if (params.targetId) {
        tabIds.push(params.targetId);
      } else {
        const { data: tabs, error: tabsError } = await supabase
          .from("tabs")
          .select("id, projects!inner(workspace_id)")
          .eq("projects.workspace_id", workspaceId);
        if (tabsError) {
          console.error("searchComments tabs error:", tabsError);
          return { data: null, error: tabsError.message };
        }
        tabIds.push(...(tabs ?? []).map((tab: any) => tab.id));
      }
    }

    if (!params.targetType || params.targetType === "block") {
      if (params.targetId) {
        blockIds.push(params.targetId);
      } else {
        const { data: blocks, error: blocksError } = await supabase
          .from("blocks")
          .select("id, tabs!inner(id, projects!inner(workspace_id))")
          .eq("tabs.projects.workspace_id", workspaceId);
        if (blocksError) {
          console.error("searchComments blocks error:", blocksError);
          return { data: null, error: blocksError.message };
        }
        blockIds.push(...(blocks ?? []).map((block: any) => block.id));
      }
    }

    if (projectIds.length > 0) {
      let query = supabase
        .from("comments")
        .select("id, target_type, target_id, user_id, text, created_at, updated_at, deleted_at")
        .eq("target_type", "project")
        .in("target_id", projectIds);

      if (searchText) {
        query = query.ilike("text", `%${searchText}%`);
      }

      const { data, error } = await query.limit(limit);
      if (error) {
        console.error("searchComments project comments error:", error);
        return { data: null, error: error.message };
      }

      results.push(
        ...(data ?? []).map((comment: any) => ({
          id: comment.id,
          source: "comment",
          target_type: comment.target_type,
          target_id: comment.target_id,
          user_id: comment.user_id,
          text: comment.text,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          deleted_at: comment.deleted_at,
        }))
      );
    }

    if (tabIds.length > 0) {
      let query = supabase
        .from("comments")
        .select("id, target_type, target_id, user_id, text, created_at, updated_at, deleted_at")
        .eq("target_type", "tab")
        .in("target_id", tabIds);

      if (searchText) {
        query = query.ilike("text", `%${searchText}%`);
      }

      const { data, error } = await query.limit(limit);
      if (error) {
        console.error("searchComments tab comments error:", error);
        return { data: null, error: error.message };
      }

      results.push(
        ...(data ?? []).map((comment: any) => ({
          id: comment.id,
          source: "comment",
          target_type: comment.target_type,
          target_id: comment.target_id,
          user_id: comment.user_id,
          text: comment.text,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          deleted_at: comment.deleted_at,
        }))
      );
    }

    if (blockIds.length > 0) {
      let query = supabase
        .from("comments")
        .select("id, target_type, target_id, user_id, text, created_at, updated_at, deleted_at")
        .eq("target_type", "block")
        .in("target_id", blockIds);

      if (searchText) {
        query = query.ilike("text", `%${searchText}%`);
      }

      const { data, error } = await query.limit(limit);
      if (error) {
        console.error("searchComments block comments error:", error);
        return { data: null, error: error.message };
      }

      results.push(
        ...(data ?? []).map((comment: any) => ({
          id: comment.id,
          source: "comment",
          target_type: comment.target_type,
          target_id: comment.target_id,
          user_id: comment.user_id,
          text: comment.text,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          deleted_at: comment.deleted_at,
        }))
      );
    }

    if (!params.targetType || params.targetType === "task") {
      let query = supabase
        .from("task_comments")
        .select("id, task_id, author_id, text, created_at, updated_at, task_items!inner(workspace_id)")
        .eq("task_items.workspace_id", workspaceId);

      if (params.targetId) {
        query = query.eq("task_id", params.targetId);
      }

      if (searchText) {
        query = query.ilike("text", `%${searchText}%`);
      }

      const { data, error } = await query.limit(limit);
      if (error) {
        console.error("searchComments task_comments error:", error);
        return { data: null, error: error.message };
      }

      results.push(
        ...(data ?? []).map((comment: any) => ({
          id: comment.id,
          source: "task_comment",
          target_type: "task",
          target_id: comment.task_id,
          user_id: comment.author_id,
          text: comment.text,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
        }))
      );
    }

    if (!params.targetType || params.targetType === "table_row") {
      let query = supabase
        .from("table_comments")
        .select("id, row_id, user_id, content, created_at, updated_at, table_rows!inner(id, tables!inner(workspace_id))")
        .eq("table_rows.tables.workspace_id", workspaceId);

      if (params.targetId) {
        query = query.eq("row_id", params.targetId);
      }

      if (searchText) {
        query = query.ilike("content", `%${searchText}%`);
      }

      const { data, error } = await query.limit(limit);
      if (error) {
        console.error("searchComments table_comments error:", error);
        return { data: null, error: error.message };
      }

      results.push(
        ...(data ?? []).map((comment: any) => ({
          id: comment.id,
          source: "table_comment",
          target_type: "table_row",
          target_id: comment.row_id,
          user_id: comment.user_id,
          text: comment.content,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
        }))
      );
    }

    return { data: results.slice(0, limit), error: null };
  } catch (error) {
    console.error("searchComments error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchWorkspaceMembers(params: {
  searchText?: string;
  limit?: number;
}): Promise<SearchResponse<WorkspaceMemberSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim().toLowerCase();

  try {
    const { data: members, error: membersError } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, created_at")
      .eq("workspace_id", workspaceId)
      .limit(limit);

    if (membersError) {
      console.error("searchWorkspaceMembers error:", membersError);
      return { data: null, error: membersError.message };
    }

    const userIds = (members ?? []).map((member: any) => member.user_id);

    let profiles: Record<string, { name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      if (profilesError) {
        console.error("searchWorkspaceMembers profiles error:", profilesError);
        return { data: null, error: profilesError.message };
      }

      profiles = (profileRows ?? []).reduce(
        (acc: Record<string, { name: string | null; email: string | null }>, profile: any) => {
          acc[profile.id] = { name: profile.name ?? null, email: profile.email ?? null };
          return acc;
        },
        {}
      );
    }

    const mapped = (members ?? []).map((member: any) => {
      const profile = profiles[member.user_id] ?? { name: null, email: null };
      return {
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        created_at: member.created_at,
        name: profile.name,
        email: profile.email,
      };
    });

    const filtered = searchText
      ? mapped.filter((member) => {
          const name = member.name?.toLowerCase() ?? "";
          const email = member.email?.toLowerCase() ?? "";
          return name.includes(searchText) || email.includes(searchText);
        })
      : mapped;

    return { data: filtered.slice(0, limit), error: null };
  } catch (error) {
    console.error("searchWorkspaceMembers error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchEntityLinks(params: {
  sourceEntityType?: string;
  sourceEntityId?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  limit?: number;
}): Promise<SearchResponse<EntityLinkSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;

  try {
    let query = supabase
      .from("entity_links")
      .select("id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, workspace_id, created_at")
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

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchEntityLinks error:", error);
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch (error) {
    console.error("searchEntityLinks error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchEntityProperties(params: {
  entityType?: string;
  entityId?: string;
  status?: string | string[];
  priority?: string | string[];
  assigneeId?: string;
  dueAfter?: string;
  dueBefore?: string;
  tags?: string[];
  limit?: number;
}): Promise<SearchResponse<EntityPropertySearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const statusFilter = normalizeArrayFilter(params.status);
  const priorityFilter = normalizeArrayFilter(params.priority);

  try {
    let query = supabase
      .from("entity_properties")
      .select("id, entity_type, entity_id, workspace_id, status, priority, assignee_id, due_date, tags, created_at, updated_at")
      .eq("workspace_id", workspaceId);

    if (params.entityType) {
      query = query.eq("entity_type", params.entityType);
    }

    if (params.entityId) {
      query = query.eq("entity_id", params.entityId);
    }

    if (statusFilter) {
      query = query.in("status", statusFilter);
    }

    if (priorityFilter) {
      query = query.in("priority", priorityFilter);
    }

    if (params.assigneeId) {
      query = query.eq("assignee_id", params.assigneeId);
    }

    if (params.dueAfter) {
      query = query.gte("due_date", params.dueAfter);
    }

    if (params.dueBefore) {
      query = query.lte("due_date", params.dueBefore);
    }

    if (params.tags?.length) {
      query = query.contains("tags", params.tags);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchEntityProperties error:", error);
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch (error) {
    console.error("searchEntityProperties error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchBlockTemplates(params: {
  searchText?: string;
  type?: BlockType | BlockType[];
  limit?: number;
}): Promise<SearchResponse<BlockTemplateSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();
  const typeFilter = normalizeArrayFilter(params.type as string | string[] | undefined);

  try {
    let query = supabase
      .from("blocks")
      .select("id, template_name, type, content, tab_id, created_at, updated_at, tabs!inner(project_id, projects!inner(workspace_id))")
      .eq("is_template", true)
      .eq("tabs.projects.workspace_id", workspaceId);

    if (typeFilter) {
      query = query.in("type", typeFilter);
    }

    if (searchText) {
      query = query.or(`template_name.ilike.%${searchText}%,content::text.ilike.%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchBlockTemplates error:", error);
      return { data: null, error: error.message };
    }

    const mapped = (data ?? []).map((block: any) => ({
      id: block.id,
      template_name: block.template_name,
      type: block.type,
      content: block.content,
      tab_id: block.tab_id,
      project_id: block.tabs?.project_id ?? null,
      created_at: block.created_at,
      updated_at: block.updated_at,
    }));

    return { data: mapped, error: null };
  } catch (error) {
    console.error("searchBlockTemplates error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchProjectTemplates(params: {
  searchText?: string;
  limit?: number;
}): Promise<SearchResponse<ProjectTemplateSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();

  try {
    let query = supabase
      .from("projects")
      .select("id, name, project_type, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("project_type", "internal");

    if (searchText) {
      query = query.ilike("name", `%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchProjectTemplates error:", error);
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch (error) {
    console.error("searchProjectTemplates error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function searchPropertyDefinitions(params: {
  searchText?: string;
  limit?: number;
}): Promise<SearchResponse<PropertyDefinitionSearchResult>> {
  const context = await getSearchContext();
  if ("error" in context) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const searchText = params.searchText?.trim();

  try {
    let query = supabase
      .from("property_definitions")
      .select("id, workspace_id, name, type, options, created_at, updated_at")
      .eq("workspace_id", workspaceId);

    if (searchText) {
      query = query.ilike("name", `%${searchText}%`);
    }

    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      console.error("searchPropertyDefinitions error:", error);
      return { data: null, error: error.message };
    }

    return { data: (data ?? []) as PropertyDefinitionSearchResult[], error: null };
  } catch (error) {
    console.error("searchPropertyDefinitions error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
