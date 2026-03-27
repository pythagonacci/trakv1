'use server'

import { revalidatePath } from 'next/cache'
import { getServerUser } from '@/lib/auth/get-server-user'
import { safeRevalidatePath } from './workspace'
import type { AuthContext } from '@/lib/auth-context'
import { createTab } from './tab'
import { createBlock } from './block'
import type { BlockType } from './block';
import { syncTagsFieldConfigsForProject } from '@/lib/tables/tag-field-config';
import { assertCanCreateProject } from '@/lib/billing/limits';
import { assertCanUseProjectTemplates } from '@/lib/billing/entitlements';
import { planMeetsRequirement, type PlanKey } from '@/lib/billing/config';
import { createServiceClient } from '@/lib/supabase/service';
import { IndexingQueue } from '@/lib/search/job-queue';

// Type for project status
type ProjectStatus = 'not_started' | 'in_progress' | 'complete'

// Type for project type
type ProjectType = 'project' | 'internal'

// Project priority (optional, same idea as due date)
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent' | null

// Type for project data
type ProjectData = {
  name: string
  project_type?: ProjectType
  client_id?: string | null
  client_name?: string  // For creating new clients on the fly
  status?: ProjectStatus
  due_date_date?: string | null  // ISO date string
  due_date_text?: string | null
  priority?: ProjectPriority
  member_ids?: string[] | 'all'  // Project permissions: 'all' or array of user IDs
  assigned_tags?: string[]  // Tags on the project itself (stored in projects.tags)
  tag_bank?: string[]  // Initial tag bank for tasks (inserted into project_tags, create only)
}

type ProjectTemplateCreationData = ProjectData & {
  template_id: string
}

// Type for project filters
type ProjectFilters = {
  project_type?: ProjectType;
  status?: ProjectStatus;
  client_id?: string;
  internal_group_id?: string | null;
  search?: string; // NEW: Search by project name or client name
  sort_by?: "created_at" | "updated_at" | "due_date_date" | "name";
  sort_order?: "asc" | "desc";
  /** Inclusive start (ISO date) for due_date_date filter */
  due_date_start?: string | null;
  /** Inclusive end (ISO date) for due_date_date filter */
  due_date_end?: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  due_date_date: string | null;
  due_date_text: string | null;
  client_id: string | null;
  internal_group_id: string | null;
  created_at: string;
  updated_at: string;
  client: {
    id: string;
    name: string | null;
    company?: string | null;
  } | null;
};

type BlockPreviewPayload = {
  summary: string;
  detailLines?: string[];
  meta?: string;
};

type TabPreviewBlock = {
  id: string;
  type: BlockType;
  column: number | null;
  position: number | null;
  summary: string;
  detailLines?: string[];
  meta?: string;
};

export type ProjectFirstTabPreview = {
  tab_id: string;
  tab_name: string;
  blocks: TabPreviewBlock[];
};

type ProjectWithPreview = ProjectRow & {
  first_tab_preview?: ProjectFirstTabPreview | null;
};

type ProjectQueryOptions = {
  includeFirstTabPreview?: boolean;
};

type PreviewContext = {
  pdfFileNames?: Map<string, string>;
  taskItemsByBlock?: Map<string, Array<{ id: string; title: string; status: string }>>;
};

function truncatePreviewText(input?: string | null, maxLength: number = 80) {
  if (!input) return "";
  const clean = input.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1)}…`;
}

function getTitle(input?: unknown) {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
}

function extractPlainTextLines(text: string | undefined, maxLines = 3) {
  if (!text) return [];
  const normalized = text
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#+\s/g, "")
    .replace(/[-+] /g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return normalized.slice(0, maxLines);
}

function summarizeBlockPreview(
  block: { type: BlockType; content?: Record<string, any> | null },
  context: PreviewContext = {}
): BlockPreviewPayload {
  const content = (block.content ?? {}) as Record<string, any>;

  switch (block.type) {
    case "text": {
      const lines = extractPlainTextLines(content.text, 3);
      return {
        summary: lines[0] || "Empty text block",
        detailLines: lines.slice(1),
      };
    }
    case "task": {
      const taskItems = context.taskItemsByBlock?.get((block as any).id) || [];
      const tasks = taskItems.length > 0 ? taskItems : (Array.isArray(content.tasks) ? content.tasks : []);
      const completed = tasks.filter(
        (task: any) => task.completed || task.done || task.status === "done"
      ).length;
      const title = getTitle(content.title);
      const detailLines: string[] = [];
      if (tasks.length) {
        detailLines.push(`${completed}/${tasks.length} tasks done`);
      } else {
        detailLines.push("No tasks yet");
      }
      detailLines.push(
        ...tasks.slice(0, 3).map((task: any) => {
          const label = task.title || task.text || "Untitled task";
          const icon = task.completed || task.done || task.status === "done" ? "✓" : "•";
          return `${icon} ${label}`;
        })
      );

      return {
        summary: title || (tasks.length ? "Task list" : "Tasks"),
        detailLines,
      };
    }
    case "link":
      return {
        summary: truncatePreviewText(content.title || content.url, 80) || "Link",
        detailLines: content.description ? [truncatePreviewText(content.description, 90)] : undefined,
        meta: content.url ? truncatePreviewText(content.url, 90) : undefined,
      };
    case "divider":
      return { summary: "Divider" };
    case "table": {
      const title = getTitle(content.title);
      const rows =
        typeof content.rows === "number"
          ? content.rows
          : Array.isArray(content.cells)
          ? content.cells.length
          : undefined;
      const cols =
        typeof content.cols === "number"
          ? content.cols
          : Array.isArray(content.cells) && Array.isArray(content.cells[0])
          ? content.cells[0].length
          : undefined;
      const firstRow =
        Array.isArray(content.cells) && Array.isArray(content.cells[0])
          ? content.cells[0].slice(0, 3).map((cell: string) => truncatePreviewText(cell, 30))
          : null;
      return {
        summary: title || (rows && cols ? `${rows}×${cols} table` : "Table"),
        detailLines: [
          ...(rows && cols ? [`${rows} rows · ${cols} columns`] : []),
          ...(firstRow ? [`Row 1: ${firstRow.join(" | ")}`] : []),
        ],
      };
    }
    case "chart": {
      const title = getTitle(content.title);
      const chartType = typeof content.chartType === "string" ? content.chartType : "chart";
      const detailLines: string[] = [];
      if (content.metadata?.isSimulation) detailLines.push("Simulation");
      return {
        summary: title || `${chartType} chart`,
        detailLines: detailLines.length ? detailLines : undefined,
      };
    }
    case "timeline": {
      const events = Array.isArray(content.events) ? content.events.length : 0;
      const title = getTitle(content.title);
      const eventLines =
        events && Array.isArray(content.events)
          ? content.events.slice(0, 3).map((event: any) => truncatePreviewText(event.title || event.name || "Untitled event"))
          : [];
      return {
        summary: title || "Timeline",
        detailLines: [
          events ? `${events} scheduled` : "No events yet",
          ...eventLines,
        ].filter(Boolean) as string[],
      };
    }
    case "file": {
      const files = Array.isArray(content.files) ? content.files.length : 0;
      const detailLines = content.files
        ? content.files.slice(0, 3).map((file: any) => file.name || file.fileName || "Attachment")
        : undefined;
      return {
        summary: files ? `${files} file${files === 1 ? "" : "s"}` : "File block",
        detailLines,
      };
    }
    case "video":
      return {
        summary: content.caption || "Video",
        meta: content.url || content.provider || undefined,
      };
    case "image":
      return {
        summary: content.caption || "Image",
        meta: content.alt || undefined,
      };
    case "gallery": {
      const items = Array.isArray(content.items) ? content.items : [];
      const withImages = items.filter((item: any) => item?.fileId).length;
      const layout = typeof content.layout === "string" ? content.layout : undefined;
      const detailLines = items.length
        ? [`${withImages}/${items.length} images`]
        : ["No images yet"];
      return {
        summary: layout ? `Gallery ${layout}` : "Gallery",
        detailLines,
      };
    }
    case "embed":
      return {
        summary: truncatePreviewText(content.title || content.url, 70) || "Embed",
        meta: content.url || undefined,
      };
    case "pdf": {
      const fileId = typeof content.fileId === "string" ? content.fileId : undefined;
      const fileName = fileId ? context.pdfFileNames?.get(fileId) : undefined;
      const summary = truncatePreviewText(content.title || fileName || content.fileName, 90) || "PDF";
      return {
        summary,
        meta: fileName && summary !== fileName ? fileName : undefined,
      };
    }
    case "section":
      return {
        summary: content.title || "Section",
        detailLines: content.description ? [truncatePreviewText(content.description, 80)] : undefined,
      };
    case "doc_reference":
      return {
        summary: content.docTitle || content.title || "Linked document",
        detailLines: content.description ? [truncatePreviewText(content.description, 80)] : undefined,
      };
    default:
      return { summary: String(block.type).replace(/_/g, " ") };
  }
}

type TemplateCloneMaps = {
  tab: Map<string, string>;
  block: Map<string, string>;
  task: Map<string, string>;
  subtask: Map<string, string>;
  table: Map<string, string>;
  field: Map<string, string>;
  row: Map<string, string>;
  timelineEvent: Map<string, string>;
};

function createTemplateCloneMaps(): TemplateCloneMaps {
  return {
    tab: new Map(),
    block: new Map(),
    task: new Map(),
    subtask: new Map(),
    table: new Map(),
    field: new Map(),
    row: new Map(),
    timelineEvent: new Map(),
  };
}

function cloneJsonValue<T>(value: T): T {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function remapUuid(value: string, maps: TemplateCloneMaps) {
  return (
    maps.tab.get(value) ||
    maps.block.get(value) ||
    maps.task.get(value) ||
    maps.subtask.get(value) ||
    maps.table.get(value) ||
    maps.field.get(value) ||
    maps.row.get(value) ||
    maps.timelineEvent.get(value) ||
    value
  );
}

function remapKnownIdsInValue(value: any, maps: TemplateCloneMaps): any {
  if (Array.isArray(value)) {
    return value.map((item) => remapKnownIdsInValue(item, maps));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, remapKnownIdsInValue(nested, maps)])
    );
  }

  if (typeof value === "string") {
    return remapUuid(value, maps);
  }

  return value;
}

function sanitizeClonedBlockContent(content: Record<string, any> | null | undefined, maps: TemplateCloneMaps): Record<string, any> {
  const walk = (value: any, key?: string): any => {
    if (Array.isArray(value)) {
      if (key === "files") return [];
      return value.map((item) => walk(item));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([nestedKey, nestedValue]) => {
          if (nestedKey === "files") return [nestedKey, []];
          if (nestedKey === "fileId" || nestedKey === "file_id") return [nestedKey, null];
          return [nestedKey, walk(nestedValue, nestedKey)];
        })
      );
    }

    if (typeof value === "string") {
      if (key === "fileId" || key === "file_id") return null;
      return remapUuid(value, maps);
    }

    return value;
  };

  return walk(cloneJsonValue(content ?? {}));
}

function sanitizeTemplateFieldConfig(config: Record<string, any> | null | undefined, maps: TemplateCloneMaps) {
  const original = (cloneJsonValue(config) ?? {}) as Record<string, any>;
  const next = remapKnownIdsInValue(original, maps) as Record<string, any>;
  const relatedTableId = (original.relation_table_id as string | undefined) || (original.linkedTableId as string | undefined);
  const reverseFieldId = (original.reverse_field_id as string | undefined) || (original.reverseFieldId as string | undefined);
  const displayFieldId = (original.display_field_id as string | undefined) || (original.displayFieldId as string | undefined);
  const relationFieldId = (original.relation_field_id as string | undefined) || (original.relationFieldId as string | undefined);

  if (relatedTableId && !maps.table.has(relatedTableId)) {
    delete next.relation_table_id;
    delete next.linkedTableId;
    delete next.reverse_field_id;
    delete next.reverseFieldId;
    delete next.display_field_id;
    delete next.displayFieldId;
    delete next.relation_field_id;
    delete next.relationFieldId;
  }

  if (reverseFieldId && !maps.field.has(reverseFieldId)) {
    delete next.reverse_field_id;
    delete next.reverseFieldId;
  }

  if (displayFieldId && !maps.field.has(displayFieldId)) {
    delete next.display_field_id;
    delete next.displayFieldId;
  }

  if (relationFieldId && !maps.field.has(relationFieldId)) {
    delete next.relation_field_id;
    delete next.relationFieldId;
  }

  return next;
}

function remapTableRowData(data: Record<string, any> | null | undefined, maps: TemplateCloneMaps) {
  const source = (cloneJsonValue(data) ?? {}) as Record<string, any>;
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [maps.field.get(key) || key, remapKnownIdsInValue(value, maps)])
  );
}

function sanitizeSourceLinkedRecord<T extends Record<string, any>>(record: T): T {
  const next = { ...record } as Record<string, any>;
  if ("source_entity_type" in next) next.source_entity_type = null;
  if ("source_entity_id" in next) next.source_entity_id = null;
  if ("source_sync_mode" in next) next.source_sync_mode = null;
  if ("source_task_id" in next) next.source_task_id = null;
  if ("edited" in next) next.edited = false;
  return next as T;
}

function sanitizeAssignmentFields<T extends Record<string, any>>(record: T): T {
  const next = { ...record } as Record<string, any>;
  if ("assignee_id" in next) next.assignee_id = null;
  if ("assignee_team_id" in next) next.assignee_team_id = null;
  if ("assignees" in next) next.assignees = [];
  return next as T;
}

function sanitizeEntityPropertyValue(fieldName: string, value: any) {
  if (fieldName === "assignee_id") return null;
  if (fieldName === "assignee_ids") return [];
  if (fieldName === "assignees") return [];
  return cloneJsonValue(value);
}

function remapReferenceTarget(referenceType: string, referenceId: string, maps: TemplateCloneMaps) {
  switch (referenceType) {
    case "block":
      return maps.block.get(referenceId) || null;
    case "tab":
      return maps.tab.get(referenceId) || null;
    case "task":
      return maps.task.get(referenceId) || null;
    case "table_row":
      return maps.row.get(referenceId) || null;
    default:
      return null;
  }
}

async function resolveProjectClientId(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>> | Awaited<ReturnType<typeof createServiceClient>>,
  workspaceId: string,
  projectData: Pick<ProjectData, "client_id" | "client_name">
) {
  let finalClientId = projectData.client_id;

  if (projectData.client_name && !projectData.client_id) {
    const { data: newClient, error: clientCreateError } = await supabase
      .from('clients')
      .insert({
        workspace_id: workspaceId,
        name: projectData.client_name.trim(),
      })
      .select('id')
      .single();

    if (clientCreateError) {
      return { error: `Failed to create client: ${clientCreateError.message}` };
    }

    finalClientId = newClient.id;
  } else if (finalClientId) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('workspace_id')
      .eq('id', finalClientId)
      .single();

    if (clientError) {
      return { error: 'Client not found' };
    }

    if (client.workspace_id !== workspaceId) {
      return { error: 'Client does not belong to this workspace' };
    }
  }

  return { data: finalClientId || null };
}

async function insertProjectMembers(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>> | Awaited<ReturnType<typeof createServiceClient>>,
  workspaceId: string,
  projectId: string,
  userId: string,
  memberIds?: string[] | 'all'
) {
  if (!memberIds || memberIds === 'all') return;

  const memberIdsToAssign = new Set(memberIds);
  memberIdsToAssign.add(userId);
  const memberIdsArray = Array.from(memberIdsToAssign);

  const { data: validMembers } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .in('user_id', memberIdsArray);

  const validUserIds = validMembers?.map((member) => member.user_id) || [];

  if (validUserIds.length === 0) return;

  await supabase
    .from('project_members')
    .insert(validUserIds.map((uid) => ({ project_id: projectId, user_id: uid, added_by: userId })));
}

async function upsertProjectTagBank(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>> | Awaited<ReturnType<typeof createServiceClient>>,
  projectId: string,
  tagNames: string[]
) {
  const normalized = Array.from(new Set(tagNames.map((tag) => tag.trim()).filter((tag) => tag.length > 0)));
  if (normalized.length === 0) return;

  const { error } = await supabase
    .from('project_tags')
    .insert(normalized.map((name) => ({ project_id: projectId, name })));

  if (error) {
    console.error('Failed to add project tag bank:', error);
    return;
  }

  await syncTagsFieldConfigsForProject(supabase as any, projectId);
}

async function ensureWorkspaceTaskTags(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  workspaceId: string,
  tags: Array<{ name: string; color: string | null }>
) {
  const normalized = Array.from(
    new Map(
      tags
        .filter((tag) => tag.name.trim().length > 0)
        .map((tag) => [tag.name.trim().toLowerCase(), { name: tag.name.trim(), color: tag.color ?? null }])
    ).values()
  );

  if (normalized.length === 0) return new Map<string, string>();

  const { data: existing } = await supabase
    .from("task_tags")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .in("name", normalized.map((tag) => tag.name));

  const tagIdByName = new Map<string, string>((existing ?? []).map((tag: any) => [String(tag.name).toLowerCase(), String(tag.id)]));
  const missing = normalized.filter((tag) => !tagIdByName.has(tag.name.toLowerCase()));

  if (missing.length > 0) {
    const { data: inserted, error } = await supabase
      .from("task_tags")
      .insert(missing.map((tag) => ({ workspace_id: workspaceId, name: tag.name, color: tag.color })))
      .select("id, name");

    if (error) {
      throw new Error(`Failed to clone task tags: ${error.message}`);
    }

    for (const row of inserted ?? []) {
      tagIdByName.set(String((row as any).name).toLowerCase(), String((row as any).id));
    }
  }

  return tagIdByName;
}

// 1. CREATE PROJECT
export async function createProject(workspaceId: string, projectData: ProjectData, opts?: { authContext?: AuthContext }) {
  try {
    let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
    let userId: string
    if (opts?.authContext) {
      supabase = opts.authContext.supabase
      userId = opts.authContext.userId
    } else {
      const authResult = await getServerUser()
      if (!authResult) return { error: 'Unauthorized' }
      supabase = authResult.supabase
      userId = authResult.user.id
    }

    // Check if user is a member of the workspace
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle()

    if (memberError || !membership) {
      return { error: 'You must be a workspace member to create projects' }
    }

    await assertCanCreateProject(workspaceId, projectData.project_type || 'project')

    let finalClientId = projectData.client_id;

  // If client_name is provided (new client), create it first
  if (projectData.client_name && !projectData.client_id) {
    const { data: newClient, error: clientCreateError } = await supabase
      .from('clients')
      .insert({
        workspace_id: workspaceId,
        name: projectData.client_name.trim(),
      })
      .select('id')
      .single();

    if (clientCreateError) {
      return { error: `Failed to create client: ${clientCreateError.message}` };
    }

    finalClientId = newClient.id;
  }
  // If client_id is provided, verify it belongs to the same workspace
  else if (finalClientId) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('workspace_id')
      .eq('id', finalClientId)
      .single()

    if (clientError) {
      return { error: 'Client not found' }
    }

    if (client.workspace_id !== workspaceId) {
      return { error: 'Client does not belong to this workspace' }
    }
  }

  // Create the project
  const { data: project, error: createError } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: projectData.name,
      project_type: projectData.project_type || 'project',
      client_id: finalClientId || null,
      status: projectData.status || 'not_started',
      due_date_date: projectData.due_date_date || null,
      due_date_text: projectData.due_date_text || null,
      priority: projectData.priority ?? null,
      tags: projectData.assigned_tags ?? [],
    })
    .select('*, client:clients(name)')
    .single()

  if (createError) {
    return { error: createError.message }
  }

  // Automatically create a default tab named "Untitled"
  const tabResult = await createTab({
    projectId: project.id,
    name: "Untitled",
  });

  if (tabResult.error) {
    // Log error but don't fail project creation if tab creation fails
    console.error("Failed to create default tab:", tabResult.error);
  }

  // Handle project permissions
  if (projectData.member_ids && projectData.member_ids !== 'all') {
    // Auto-include the project creator if not already included
    const memberIdsToAssign = new Set(projectData.member_ids);
    memberIdsToAssign.add(userId);
    const memberIdsArray = Array.from(memberIdsToAssign);

    // Validate that all member_ids are workspace members
    const { data: validMembers } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .in('user_id', memberIdsArray);

    const validUserIds = validMembers?.map(m => m.user_id) || [];

    if (validUserIds.length > 0) {
      // Insert project members
      const projectMembersToInsert = validUserIds.map(uid => ({
        project_id: project.id,
        user_id: uid,
        added_by: userId
      }));

      const { error: membersError } = await supabase
        .from('project_members')
        .insert(projectMembersToInsert);

      if (membersError) {
        console.error('Failed to add project members:', membersError);
        // Don't fail project creation, just log the error
      }
    }
  }
  // If member_ids === 'all' or undefined, don't insert any rows (= accessible to all)

  // Insert initial tag bank (for tasks) if provided
  const tagBankNames = (projectData.tag_bank || [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  if (tagBankNames.length > 0) {
    const tagRows = tagBankNames.map((name) => ({ project_id: project.id, name }))
    const { error: tagsError } = await supabase.from('project_tags').insert(tagRows)
    if (tagsError) {
      console.error('Failed to add initial tag bank:', tagsError)
    }
    await syncTagsFieldConfigsForProject(supabase, project.id)
  }

  await safeRevalidatePath('/dashboard')
    return { data: project }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create project' }
  }
}

export async function createProjectFromTemplate(
  workspaceId: string,
  projectData: ProjectTemplateCreationData,
  opts?: { authContext?: AuthContext }
) {
  try {
    let userId: string
    if (opts?.authContext) {
      userId = opts.authContext.userId
    } else {
      const authResult = await getServerUser()
      if (!authResult) return { error: 'Unauthorized' }
      userId = authResult.user.id
    }

    const serviceSupabase = await createServiceClient()

    const { data: membership, error: memberError } = await serviceSupabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle()

    if (memberError || !membership) {
      return { error: 'You must be a workspace member to create projects' }
    }

    const entitlements = await assertCanUseProjectTemplates(workspaceId)

    const { data: template, error: templateError } = await serviceSupabase
      .from('project_templates')
      .select('id, source_project_id, min_plan, is_active')
      .eq('id', projectData.template_id)
      .eq('is_active', true)
      .single()

    if (templateError || !template) {
      return { error: 'Template not found' }
    }

    const minimumPlan = (template.min_plan ?? 'standard') as PlanKey
    if (!planMeetsRequirement(entitlements.planKey, minimumPlan)) {
      return { error: `This template requires the ${minimumPlan} plan.` }
    }

    const { data: sourceProject, error: sourceProjectError } = await serviceSupabase
      .from('projects')
      .select('id, name, project_type, status, due_date_date, due_date_text, priority, tags')
      .eq('id', template.source_project_id)
      .single()

    if (sourceProjectError || !sourceProject) {
      return { error: 'Template source project not found' }
    }

    await assertCanCreateProject(workspaceId, (sourceProject.project_type as ProjectType | undefined) || 'project')

    const clientResolution = await resolveProjectClientId(serviceSupabase, workspaceId, projectData)
    if ('error' in clientResolution) {
      return { error: clientResolution.error }
    }

    const [
      sourceProjectTagsResult,
      sourceTabsResult,
    ] = await Promise.all([
      serviceSupabase.from('project_tags').select('name').eq('project_id', sourceProject.id).order('name'),
      serviceSupabase
        .from('tabs')
        .select('id, parent_tab_id, name, position, is_client_visible, client_title, is_workflow_page, workflow_metadata')
        .eq('project_id', sourceProject.id)
        .order('position', { ascending: true }),
    ])

    if (sourceTabsResult.error) {
      return { error: 'Failed to load template tabs' }
    }

    const sourceTabs = sourceTabsResult.data ?? []
    const sourceTabIds = sourceTabs.map((tab: any) => String(tab.id))

    const { data: sourceBlocks, error: sourceBlocksError } = sourceTabIds.length === 0
      ? { data: [] as any[], error: null }
      : await serviceSupabase
          .from('blocks')
          .select('id, tab_id, parent_block_id, type, content, position, column, locked')
          .in('tab_id', sourceTabIds)
          .order('position', { ascending: true })

    if (sourceBlocksError) {
      return { error: 'Failed to load template blocks' }
    }

    const blocks = sourceBlocks ?? []
    const sourceTaskBlockIds = blocks.filter((block: any) => block.type === 'task').map((block: any) => String(block.id))
    const sourceTimelineBlockIds = blocks.filter((block: any) => block.type === 'timeline').map((block: any) => String(block.id))
    const sourceTableIds = uniqueStrings(
      blocks
        .filter((block: any) => block.type === 'table')
        .map((block: any) => {
          const content = (block.content ?? {}) as Record<string, any>
          const tableId = content.tableId || content.table_id
          return typeof tableId === 'string' ? tableId : null
        })
    )

    const [
      sourceTaskItemsResult,
      sourceTimelineEventsResult,
      sourceTablesResult,
      sourceFieldsResult,
      sourceRowsResult,
      sourceViewsResult,
      sourceRelationsResult,
    ] = await Promise.all([
      sourceTaskBlockIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : serviceSupabase
            .from('task_items')
            .select('*')
            .in('task_block_id', sourceTaskBlockIds)
            .order('display_order', { ascending: true }),
      sourceTimelineBlockIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : serviceSupabase
            .from('timeline_events')
            .select('*')
            .in('timeline_block_id', sourceTimelineBlockIds)
            .order('display_order', { ascending: true }),
      sourceTableIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : serviceSupabase.from('tables').select('*').in('id', sourceTableIds),
      sourceTableIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : serviceSupabase.from('table_fields').select('*').in('table_id', sourceTableIds).order('order', { ascending: true }),
      sourceTableIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : serviceSupabase.from('table_rows').select('*').in('table_id', sourceTableIds).order('order', { ascending: true }),
      sourceTableIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : serviceSupabase.from('table_views').select('*').in('table_id', sourceTableIds),
      sourceTableIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : serviceSupabase
            .from('table_relations')
            .select('*')
            .in('from_table_id', sourceTableIds)
            .in('to_table_id', sourceTableIds),
    ])

    if (sourceTaskItemsResult.error) return { error: 'Failed to load template tasks' }
    if (sourceTimelineEventsResult.error) return { error: 'Failed to load template timeline events' }
    if (sourceTablesResult.error || sourceFieldsResult.error || sourceRowsResult.error || sourceViewsResult.error || sourceRelationsResult.error) {
      return { error: 'Failed to load template table data' }
    }

    const taskItems = sourceTaskItemsResult.data ?? []
    const timelineEvents = sourceTimelineEventsResult.data ?? []
    const tableRows = sourceRowsResult.data ?? []

    const sourceTaskIds = taskItems.map((task: any) => String(task.id))
    const sourceSubtaskIdsPromise = sourceTaskIds.length === 0
      ? Promise.resolve({ data: [] as any[], error: null })
      : serviceSupabase.from('task_subtasks').select('*').in('task_id', sourceTaskIds).order('display_order', { ascending: true })

    const sourceTaskTagLinksPromise = sourceTaskIds.length === 0
      ? Promise.resolve({ data: [] as any[], error: null })
      : serviceSupabase
          .from('task_tag_links')
          .select('task_id, tag:task_tags(id, name, color)')
          .in('task_id', sourceTaskIds)

    const sourceTimelineEventIds = timelineEvents.map((event: any) => String(event.id))
    const sourceDependenciesPromise = sourceTimelineBlockIds.length === 0
      ? Promise.resolve({ data: [] as any[], error: null })
      : serviceSupabase.from('timeline_dependencies').select('*').in('timeline_block_id', sourceTimelineBlockIds)

    const sourceTimelineRefsPromise = sourceTimelineEventIds.length === 0
      ? Promise.resolve({ data: [] as any[], error: null })
      : serviceSupabase.from('timeline_references').select('*').in('event_id', sourceTimelineEventIds)

    const sourceEntityPropsPromise = Promise.all([
      blocks.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : serviceSupabase.from('entity_properties').select('*').eq('entity_type', 'block').in('entity_id', blocks.map((block: any) => String(block.id))),
      sourceTaskIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : serviceSupabase.from('entity_properties').select('*').eq('entity_type', 'task').in('entity_id', sourceTaskIds),
      sourceTimelineEventIds.length === 0
        ? Promise.resolve({ data: [] as any[], error: null })
        : serviceSupabase.from('entity_properties').select('*').eq('entity_type', 'timeline_event').in('entity_id', sourceTimelineEventIds),
    ])

    const [
      sourceSubtasksResult,
      sourceTaskTagLinksResult,
      sourceDependenciesResult,
      sourceTimelineRefsResult,
      sourceEntityPropsResults,
    ] = await Promise.all([
      sourceSubtaskIdsPromise,
      sourceTaskTagLinksPromise,
      sourceDependenciesPromise,
      sourceTimelineRefsPromise,
      sourceEntityPropsPromise,
    ])

    if (sourceSubtasksResult.error) return { error: 'Failed to load template subtasks' }
    if (sourceTaskTagLinksResult.error) return { error: 'Failed to load template task tags' }
    if (sourceDependenciesResult.error || sourceTimelineRefsResult.error) return { error: 'Failed to load template timeline metadata' }
    if (sourceEntityPropsResults.some((result) => result.error)) return { error: 'Failed to load template entity properties' }

    const sourceSubtasks = sourceSubtasksResult.data ?? []
    const sourceSubtaskIds = sourceSubtasks.map((subtask: any) => String(subtask.id))

    const sourceSubtaskRefsResult = sourceSubtaskIds.length === 0
      ? { data: [] as any[], error: null }
      : await serviceSupabase.from('task_subtask_references').select('*').in('subtask_id', sourceSubtaskIds)

    const sourceSubtaskPropsResult = sourceSubtaskIds.length === 0
      ? { data: [] as any[], error: null }
      : await serviceSupabase.from('entity_properties').select('*').eq('entity_type', 'subtask').in('entity_id', sourceSubtaskIds)

    if (sourceSubtaskRefsResult.error || sourceSubtaskPropsResult.error) {
      return { error: 'Failed to load template subtask metadata' }
    }

    const maps = createTemplateCloneMaps()
    sourceTabs.forEach((tab: any) => maps.tab.set(String(tab.id), crypto.randomUUID()))
    blocks.forEach((block: any) => maps.block.set(String(block.id), crypto.randomUUID()))
    taskItems.forEach((task: any) => maps.task.set(String(task.id), crypto.randomUUID()))
    sourceSubtasks.forEach((subtask: any) => maps.subtask.set(String(subtask.id), crypto.randomUUID()))
    ;(sourceTablesResult.data ?? []).forEach((table: any) => maps.table.set(String(table.id), crypto.randomUUID()))
    ;(sourceFieldsResult.data ?? []).forEach((field: any) => maps.field.set(String(field.id), crypto.randomUUID()))
    tableRows.forEach((row: any) => maps.row.set(String(row.id), crypto.randomUUID()))
    timelineEvents.forEach((event: any) => maps.timelineEvent.set(String(event.id), crypto.randomUUID()))

    const assignedTags = Array.from(new Set([...(sourceProject.tags ?? []), ...(projectData.assigned_tags ?? [])]))

    const { data: project, error: createError } = await serviceSupabase
      .from('projects')
      .insert({
        workspace_id: workspaceId,
        client_id: clientResolution.data,
        name: projectData.name || sourceProject.name,
        status: projectData.status || sourceProject.status || 'not_started',
        due_date_date: projectData.due_date_date ?? sourceProject.due_date_date ?? null,
        due_date_text: projectData.due_date_text ?? sourceProject.due_date_text ?? null,
        project_type: sourceProject.project_type || 'project',
        priority: projectData.priority ?? sourceProject.priority ?? null,
        tags: assignedTags,
        source_template_id: template.id,
        client_page_enabled: false,
        client_comments_enabled: false,
        client_editing_enabled: false,
        public_token: null,
        folder_id: null,
        internal_group_id: null,
      })
      .select('*, client:clients(name)')
      .single()

    if (createError || !project) {
      return { error: createError?.message || 'Failed to create project from template' }
    }

    await insertProjectMembers(serviceSupabase, workspaceId, project.id, userId, projectData.member_ids)

    const mergedTagBank = Array.from(
      new Set([
        ...((sourceProjectTagsResult.data ?? []).map((row: any) => String(row.name))),
        ...(projectData.tag_bank ?? []),
      ])
    )
    await upsertProjectTagBank(serviceSupabase, project.id, mergedTagBank)

    if (sourceTabs.length === 0) {
      const defaultTabId = crypto.randomUUID()
      const { error: defaultTabError } = await serviceSupabase.from('tabs').insert({
        id: defaultTabId,
        project_id: project.id,
        parent_tab_id: null,
        name: 'Untitled',
        position: 0,
      })

      if (defaultTabError) {
        return { error: 'Project created but failed to create default tab' }
      }
    } else {
      const tabPayload = sourceTabs.map((tab: any) => ({
        id: maps.tab.get(String(tab.id)),
        project_id: project.id,
        parent_tab_id: tab.parent_tab_id ? maps.tab.get(String(tab.parent_tab_id)) || null : null,
        name: tab.name,
        position: tab.position,
        is_client_visible: Boolean(tab.is_client_visible),
        client_title: tab.client_title ?? null,
        is_workflow_page: Boolean(tab.is_workflow_page),
        workflow_metadata: remapKnownIdsInValue(cloneJsonValue(tab.workflow_metadata ?? {}), maps),
      }))

      const { error: tabInsertError } = await serviceSupabase.from('tabs').insert(tabPayload)
      if (tabInsertError) {
        return { error: `Failed to clone tabs: ${tabInsertError.message}` }
      }
    }

    if ((sourceTablesResult.data ?? []).length > 0) {
      const tablePayload = (sourceTablesResult.data ?? []).map((table: any) => ({
        id: maps.table.get(String(table.id)),
        workspace_id: workspaceId,
        project_id: project.id,
        tab_id: table.tab_id ? maps.tab.get(String(table.tab_id)) || null : null,
        title: table.title,
        description: table.description ?? null,
        icon: table.icon ?? null,
        created_by: userId,
      }))

      const { error: tableInsertError } = await serviceSupabase.from('tables').insert(tablePayload)
      if (tableInsertError) {
        return { error: `Failed to clone tables: ${tableInsertError.message}` }
      }

      const fieldPayload = (sourceFieldsResult.data ?? []).map((field: any) => ({
        id: maps.field.get(String(field.id)),
        table_id: maps.table.get(String(field.table_id)),
        name: field.name,
        type: field.type,
        config: sanitizeTemplateFieldConfig(field.config, maps),
        order: field.order,
        is_primary: Boolean(field.is_primary),
        width: field.width ?? null,
      }))

      if (fieldPayload.length > 0) {
        const { error: fieldInsertError } = await serviceSupabase.from('table_fields').insert(fieldPayload)
        if (fieldInsertError) {
          return { error: `Failed to clone table fields: ${fieldInsertError.message}` }
        }
      }

      const rowPayload = tableRows.map((row: any) => {
        const sanitizedRow = sanitizeSourceLinkedRecord(row)
        return {
          id: maps.row.get(String(row.id)),
          table_id: maps.table.get(String(row.table_id)),
          data: remapTableRowData(sanitizedRow.data, maps),
          order: row.order,
          created_by: userId,
          updated_by: userId,
          source_entity_type: sanitizedRow.source_entity_type ?? null,
          source_entity_id: sanitizedRow.source_entity_id ?? null,
          source_sync_mode: sanitizedRow.source_sync_mode ?? null,
          edited: Boolean(sanitizedRow.edited),
        }
      })

      if (rowPayload.length > 0) {
        const { error: rowInsertError } = await serviceSupabase.from('table_rows').insert(rowPayload)
        if (rowInsertError) {
          return { error: `Failed to clone table rows: ${rowInsertError.message}` }
        }
      }

      const viewPayload = (sourceViewsResult.data ?? []).map((view: any) => ({
        table_id: maps.table.get(String(view.table_id)),
        name: view.name,
        type: view.type,
        config: remapKnownIdsInValue(cloneJsonValue(view.config ?? {}), maps),
        is_default: Boolean(view.is_default),
        created_by: userId,
      }))

      if (viewPayload.length > 0) {
        const { error: viewInsertError } = await serviceSupabase.from('table_views').insert(viewPayload)
        if (viewInsertError) {
          return { error: `Failed to clone table views: ${viewInsertError.message}` }
        }
      }

      const relationPayload = (sourceRelationsResult.data ?? [])
        .map((relation: any) => {
          const fromTableId = maps.table.get(String(relation.from_table_id))
          const toTableId = maps.table.get(String(relation.to_table_id))
          const fromFieldId = maps.field.get(String(relation.from_field_id))
          const fromRowId = maps.row.get(String(relation.from_row_id))
          const toRowId = maps.row.get(String(relation.to_row_id))
          if (!fromTableId || !toTableId || !fromFieldId || !fromRowId || !toRowId) return null
          return {
            from_table_id: fromTableId,
            from_field_id: fromFieldId,
            from_row_id: fromRowId,
            to_table_id: toTableId,
            to_row_id: toRowId,
          }
        })
        .filter(Boolean)

      if (relationPayload.length > 0) {
        const { error: relationInsertError } = await serviceSupabase.from('table_relations').insert(relationPayload)
        if (relationInsertError) {
          return { error: `Failed to clone table relations: ${relationInsertError.message}` }
        }
      }
    }

    if (blocks.length > 0) {
      const blockPayload = blocks.map((block: any) => ({
        id: maps.block.get(String(block.id)),
        tab_id: maps.tab.get(String(block.tab_id)),
        parent_block_id: block.parent_block_id ? maps.block.get(String(block.parent_block_id)) || null : null,
        type: block.type,
        content: sanitizeClonedBlockContent(block.content, maps),
        position: block.position,
        column: block.column,
        original_block_id: null,
        is_template: false,
        template_name: null,
        locked: Boolean(block.locked),
      }))

      const { error: blockInsertError } = await serviceSupabase.from('blocks').insert(blockPayload)
      if (blockInsertError) {
        return { error: `Failed to clone blocks: ${blockInsertError.message}` }
      }
    }

    if (taskItems.length > 0) {
      const taskPayload = taskItems.map((task: any) => {
        const sanitizedTask = sanitizeAssignmentFields(sanitizeSourceLinkedRecord(task))
        return {
          id: maps.task.get(String(task.id)),
          task_block_id: maps.block.get(String(task.task_block_id)),
          workspace_id: workspaceId,
          project_id: project.id,
          tab_id: task.tab_id ? maps.tab.get(String(task.tab_id)) || null : null,
          title: task.title,
          description: task.description ?? null,
          due_date: task.due_date ?? null,
          due_time: task.due_time ?? null,
          start_date: task.start_date ?? null,
          hide_icons: Boolean(task.hide_icons),
          display_order: task.display_order,
          recurring_enabled: Boolean(task.recurring_enabled),
          recurring_frequency: task.recurring_frequency ?? null,
          recurring_interval: task.recurring_interval ?? 1,
          created_by: userId,
          updated_by: userId,
          assignee_id: sanitizedTask.assignee_id ?? null,
          due_time_end: task.due_time_end ?? null,
          source_task_id: null,
          source_sync_mode: sanitizedTask.source_sync_mode ?? null,
          source_entity_type: sanitizedTask.source_entity_type ?? null,
          source_entity_id: sanitizedTask.source_entity_id ?? null,
          edited: Boolean(sanitizedTask.edited),
          priorities: cloneJsonValue(task.priorities ?? []),
          statuses: cloneJsonValue(task.statuses ?? []),
          is_placeholder: Boolean(task.is_placeholder),
          assignees: [],
          due_dates: cloneJsonValue(task.due_dates ?? []),
        }
      })

      const { error: taskInsertError } = await serviceSupabase.from('task_items').insert(taskPayload)
      if (taskInsertError) {
        return { error: `Failed to clone tasks: ${taskInsertError.message}` }
      }
    }

    if (sourceSubtasks.length > 0) {
      const subtaskPayload = sourceSubtasks.map((subtask: any) => {
        const sanitizedSubtask = sanitizeSourceLinkedRecord(subtask)
        return {
          id: maps.subtask.get(String(subtask.id)),
          task_id: maps.task.get(String(subtask.task_id)),
          title: subtask.title,
          completed: Boolean(subtask.completed),
          display_order: subtask.display_order,
          description: subtask.description ?? null,
          source_entity_type: sanitizedSubtask.source_entity_type ?? null,
          source_entity_id: sanitizedSubtask.source_entity_id ?? null,
          source_sync_mode: sanitizedSubtask.source_sync_mode ?? null,
        }
      })

      const { error: subtaskInsertError } = await serviceSupabase.from('task_subtasks').insert(subtaskPayload)
      if (subtaskInsertError) {
        return { error: `Failed to clone subtasks: ${subtaskInsertError.message}` }
      }
    }

    const taskTagLinks = sourceTaskTagLinksResult.data ?? []
    if (taskTagLinks.length > 0) {
      const workspaceTagIds = await ensureWorkspaceTaskTags(
        serviceSupabase,
        workspaceId,
        taskTagLinks
          .map((link: any) => link.tag)
          .filter((tag: any) => tag?.name)
          .map((tag: any) => ({ name: String(tag.name), color: tag.color ? String(tag.color) : null }))
      )

      const tagLinkPayload = taskTagLinks
        .map((link: any) => {
          const taskId = maps.task.get(String(link.task_id))
          const tagName = link.tag?.name ? String(link.tag.name).toLowerCase() : null
          const tagId = tagName ? workspaceTagIds.get(tagName) : null
          if (!taskId || !tagId) return null
          return { task_id: taskId, tag_id: tagId }
        })
        .filter(Boolean)

      if (tagLinkPayload.length > 0) {
        const { error: tagLinkInsertError } = await serviceSupabase.from('task_tag_links').insert(tagLinkPayload)
        if (tagLinkInsertError) {
          return { error: `Failed to clone task tags: ${tagLinkInsertError.message}` }
        }
      }
    }

    const subtaskRefPayload = (sourceSubtaskRefsResult.data ?? [])
      .map((reference: any) => {
        const subtaskId = maps.subtask.get(String(reference.subtask_id))
        const referenceId = remapReferenceTarget(String(reference.reference_type), String(reference.reference_id), maps)
        if (!subtaskId || !referenceId) return null
        return {
          workspace_id: workspaceId,
          subtask_id: subtaskId,
          reference_type: reference.reference_type,
          reference_id: referenceId,
          table_id: reference.table_id ? maps.table.get(String(reference.table_id)) || null : null,
          created_by: userId,
        }
      })
      .filter(Boolean)

    if (subtaskRefPayload.length > 0) {
      const { error: subtaskRefInsertError } = await serviceSupabase.from('task_subtask_references').insert(subtaskRefPayload)
      if (subtaskRefInsertError) {
        return { error: `Failed to clone subtask references: ${subtaskRefInsertError.message}` }
      }
    }

    if (timelineEvents.length > 0) {
      const timelinePayload = timelineEvents.map((event: any) => {
        const sanitizedEvent = sanitizeAssignmentFields(sanitizeSourceLinkedRecord(event))
        return {
          id: maps.timelineEvent.get(String(event.id)),
          timeline_block_id: maps.block.get(String(event.timeline_block_id)),
          workspace_id: workspaceId,
          title: event.title,
          start_date: event.start_date,
          end_date: event.end_date,
          assignee_id: null,
          progress: event.progress ?? 0,
          notes: event.notes ?? null,
          color: event.color,
          is_milestone: Boolean(event.is_milestone),
          baseline_start: event.baseline_start ?? null,
          baseline_end: event.baseline_end ?? null,
          display_order: event.display_order,
          created_by: userId,
          updated_by: userId,
          source_entity_type: sanitizedEvent.source_entity_type ?? null,
          source_entity_id: sanitizedEvent.source_entity_id ?? null,
          source_sync_mode: sanitizedEvent.source_sync_mode ?? null,
          edited: Boolean(sanitizedEvent.edited),
          priorities: cloneJsonValue(event.priorities ?? []),
          statuses: cloneJsonValue(event.statuses ?? []),
          assignee_team_id: null,
          parent_event_id: event.parent_event_id ? maps.timelineEvent.get(String(event.parent_event_id)) || null : null,
          assignees: [],
          tags: cloneJsonValue(event.tags ?? []),
        }
      })

      const { error: timelineInsertError } = await serviceSupabase.from('timeline_events').insert(timelinePayload)
      if (timelineInsertError) {
        return { error: `Failed to clone timeline events: ${timelineInsertError.message}` }
      }
    }

    const dependencyPayload = (sourceDependenciesResult.data ?? [])
      .map((dependency: any) => {
        const timelineBlockId = maps.block.get(String(dependency.timeline_block_id))
        const fromId = maps.timelineEvent.get(String(dependency.from_id))
        const toId = maps.timelineEvent.get(String(dependency.to_id))
        if (!timelineBlockId || !fromId || !toId) return null
        return {
          timeline_block_id: timelineBlockId,
          workspace_id: workspaceId,
          from_id: fromId,
          to_id: toId,
          dependency_type: dependency.dependency_type,
          created_by: userId,
        }
      })
      .filter(Boolean)

    if (dependencyPayload.length > 0) {
      const { error: dependencyInsertError } = await serviceSupabase.from('timeline_dependencies').insert(dependencyPayload)
      if (dependencyInsertError) {
        return { error: `Failed to clone timeline dependencies: ${dependencyInsertError.message}` }
      }
    }

    const timelineRefPayload = (sourceTimelineRefsResult.data ?? [])
      .map((reference: any) => {
        const eventId = maps.timelineEvent.get(String(reference.event_id))
        const referenceId = remapReferenceTarget(String(reference.reference_type), String(reference.reference_id), maps)
        if (!eventId || !referenceId) return null
        return {
          workspace_id: workspaceId,
          event_id: eventId,
          reference_type: reference.reference_type,
          reference_id: referenceId,
          table_id: reference.table_id ? maps.table.get(String(reference.table_id)) || null : null,
          created_by: userId,
        }
      })
      .filter(Boolean)

    if (timelineRefPayload.length > 0) {
      const { error: timelineRefInsertError } = await serviceSupabase.from('timeline_references').insert(timelineRefPayload)
      if (timelineRefInsertError) {
        return { error: `Failed to clone timeline references: ${timelineRefInsertError.message}` }
      }
    }

    const entityPropertyRows = [
      ...(sourceEntityPropsResults[0].data ?? []).map((row: any) => ({ ...row, entity_type: 'block' })),
      ...(sourceEntityPropsResults[1].data ?? []).map((row: any) => ({ ...row, entity_type: 'task' })),
      ...(sourceEntityPropsResults[2].data ?? []).map((row: any) => ({ ...row, entity_type: 'timeline_event' })),
      ...(sourceSubtaskPropsResult.data ?? []).map((row: any) => ({ ...row, entity_type: 'subtask' })),
    ]

    const entityPropertyPayload = entityPropertyRows
      .map((row: any) => {
        const entityType = String(row.entity_type)
        const sourceId = String(row.entity_id)
        const entityId =
          entityType === 'block'
            ? maps.block.get(sourceId)
            : entityType === 'task'
            ? maps.task.get(sourceId)
            : entityType === 'subtask'
            ? maps.subtask.get(sourceId)
            : entityType === 'timeline_event'
            ? maps.timelineEvent.get(sourceId)
            : null

        if (!entityId) return null

        return {
          entity_id: entityId,
          entity_type: entityType,
          field_name: row.field_name,
          field_type: row.field_type,
          value: sanitizeEntityPropertyValue(String(row.field_name), row.value),
          workspace_id: workspaceId,
        }
      })
      .filter(Boolean)

    if (entityPropertyPayload.length > 0) {
      const { error: entityPropertyInsertError } = await serviceSupabase.from('entity_properties').insert(entityPropertyPayload)
      if (entityPropertyInsertError) {
        return { error: `Failed to clone entity properties: ${entityPropertyInsertError.message}` }
      }
    }

    if (blocks.length > 0) {
      try {
        const queue = new IndexingQueue(serviceSupabase as any)
        await queue.bulkEnqueue(
          blocks.map((block: any) => ({
            workspaceId,
            resourceType: 'block',
            resourceId: maps.block.get(String(block.id))!,
          }))
        )
      } catch (error) {
        console.error('Failed to enqueue cloned blocks for indexing:', error)
      }
    }

    revalidatePath('/dashboard')
    await safeRevalidatePath('/dashboard')
    return { data: project }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create project from template' }
  }
}

/** Get all tags for a project (tag bank). */
export async function getProjectTags(
  projectId: string,
  opts?: { authContext?: AuthContext }
): Promise<{ data: string[] } | { error: string }> {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
  }

  const { data: rows, error } = await supabase
    .from('project_tags')
    .select('name')
    .eq('project_id', projectId)
    .order('name')

  if (error) return { error: error.message }
  return { data: (rows || []).map((r) => r.name) }
}

/** Add a tag to a project's tag bank (idempotent). Creates the tag if it doesn't exist. */
export async function addProjectTag(
  projectId: string,
  name: string,
  opts?: { authContext?: AuthContext }
): Promise<{ data: null } | { error: string }> {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
  }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Tag name cannot be empty' }

  const { error } = await supabase.from('project_tags').insert({ project_id: projectId, name: trimmed })

  if (error) {
    if (error.code === '23505') return { data: null }
    return { error: error.message }
  }
  await syncTagsFieldConfigsForProject(supabase, projectId)
  return { data: null }
}

/** Remove a tag from a project's tag bank (case-insensitive match). */
export async function removeProjectTag(
  projectId: string,
  name: string,
  opts?: { authContext?: AuthContext }
): Promise<{ data: null } | { error: string }> {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
  }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Tag name cannot be empty' }

  const { data: rows, error: selectError } = await supabase
    .from('project_tags')
    .select('id, name')
    .eq('project_id', projectId)

  if (selectError) return { error: selectError.message }
  const toDelete = (rows || []).find((r: { name: string }) => r.name.trim().toLowerCase() === trimmed.toLowerCase())
  if (!toDelete) return { data: null }

  const { error } = await supabase.from('project_tags').delete().eq('id', toDelete.id)
  if (error) return { error: error.message }
  await syncTagsFieldConfigsForProject(supabase, projectId)
  return { data: null }
}

/**
 * Create a project from a Shopify product. The project name is the product title,
 * and the first tab (non-overview) gets a shopify_product block rendering that product.
 */
export async function createProjectFromProduct(
  workspaceId: string,
  productId: string,
  opts?: { authContext?: AuthContext }
) {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  let userId: string
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
    userId = opts.authContext.userId
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
    userId = authResult.user.id
  }

  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to create projects' }
  }

  const { data: product, error: productError } = await supabase
    .from('trak_products')
    .select('id, title')
    .eq('id', productId)
    .single()

  if (productError || !product) {
    return { error: 'Product not found' }
  }

  // Get or create default client "Product" for projects created from Shopify products
  const { data: existingProductClient } = await supabase
    .from('clients')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('name', 'Product')
    .maybeSingle()

  let productClientId = existingProductClient?.id
  if (!productClientId) {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({ workspace_id: workspaceId, name: 'Product' })
      .select('id')
      .single()
    if (!clientError && newClient) productClientId = newClient.id
  }

  const projectName = (product.title && String(product.title).trim()) || 'Untitled Project'
  const createResult = await createProject(
    workspaceId,
    {
      name: projectName,
      status: 'not_started',
      client_id: productClientId ?? undefined,
    },
    { authContext: { supabase, userId } }
  )

  if (createResult.error) {
    return { error: createResult.error }
  }

  const project = createResult.data as { id: string }

  const { data: firstTab, error: tabError } = await supabase
    .from('tabs')
    .select('id, name')
    .eq('project_id', project.id)
    .is('parent_tab_id', null)
    .order('position', { ascending: true })
    .limit(1)
    .single()

  if (tabError || !firstTab) {
    return { data: { projectId: project.id, projectName, tabId: null, tabName: null } }
  }

  let tabName = firstTab.name ?? null

  const { error: renameTabError } = await supabase
    .from('tabs')
    .update({ name: 'Product' })
    .eq('id', firstTab.id)

  if (renameTabError) {
    console.error('Failed to rename product tab:', renameTabError)
  } else {
    tabName = 'Product'
  }

  const blockResult = await createBlock({
    tabId: firstTab.id,
    type: 'shopify_product',
    content: { product_id: productId, shopifyExpanded: true },
    authContext: { supabase, userId },
  })

  if (blockResult.error) {
    console.error('Failed to add product block to tab:', blockResult.error)
  }

  return { data: { projectId: project.id, projectName, tabId: firstTab.id, tabName } }
}

/**
 * Get or create a default "Files" internal space for standalone file uploads
 */
export async function getOrCreateFilesSpace(workspaceId: string) {
  const authResult = await getServerUser();

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' };
  }
  const { supabase, user } = authResult;

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError || !membership) {
    return { error: 'You must be a workspace member' };
  }

  // Try to find existing "Files" space
  const { data: existingSpace, error: findError } = await supabase
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .eq('project_type', 'internal')
    .eq('name', 'Files')
    .maybeSingle();

  if (findError) {
    console.error('Error finding Files space:', findError);
    // Continue to create new space
  }

  if (existingSpace) {
    return { data: existingSpace };
  }

  await assertCanCreateProject(workspaceId, 'internal');

  // Create "Files" space if it doesn't exist
  const { data: newSpace, error: createError } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name: 'Files',
      project_type: 'internal',
      status: 'in_progress',
    })
    .select('id, name')
    .single();

  if (createError) {
    console.error('Error creating Files space:', createError);
    return { error: createError.message };
  }

  // Create a default tab for the Files space
  const { error: tabError } = await supabase
    .from('tabs')
    .insert({
      project_id: newSpace.id,
      name: 'All Files',
      position: 0,
    });

  if (tabError) {
    console.error('Failed to create default tab for Files space:', tabError);
    // Still return the space even if tab creation fails
  }

  await safeRevalidatePath('/dashboard/internal');
  return { data: newSpace };
}

// 2. GET ALL PROJECTS (with filters and search) - OPTIMIZED
export async function getAllProjects(
  workspaceId: string,
  filters?: ProjectFilters,
  options?: ProjectQueryOptions
) {
  const authResult = await getServerUser()
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return { error: 'You must be a workspace member to view projects' }
  }

  // 🚀 Build optimized query - select only needed fields
  let query = supabase
    .from('projects')
    .select(`
      id,
      name,
      status,
      due_date_date,
      due_date_text,
      client_id,
      folder_id,
      internal_group_id,
      created_at,
      updated_at,
      client:clients (
        id,
        name,
        company
      )
    `)
    .eq('workspace_id', workspaceId)

  // Apply project type filter (defaults to 'project' if not specified)
  if (filters?.project_type !== undefined) {
    query = query.eq('project_type', filters.project_type)
  } else {
    query = query.eq('project_type', 'project')
  }

  // Apply status filter
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  // Apply client filter
  if (filters?.client_id) {
    query = query.eq('client_id', filters.client_id)
  }

  // Apply internal group (initiative) filter
  if (filters?.internal_group_id !== undefined && filters?.internal_group_id !== null) {
    query = query.eq('internal_group_id', filters.internal_group_id)
  }

  // Apply due date range (e.g. "due this week")
  if (filters?.due_date_start) {
    query = query.gte('due_date_date', filters.due_date_start)
  }
  if (filters?.due_date_end) {
    query = query.lte('due_date_date', filters.due_date_end)
  }

  // 🚀 Optimized search - use OR clause in database, not post-fetch filtering
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,client.name.ilike.%${filters.search}%,client.company.ilike.%${filters.search}%`)
  }

  // Apply sorting
  const sortBy = filters?.sort_by || 'created_at'
  const sortOrder = filters?.sort_order || 'desc'
  
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })
  
  // 🚀 Limit results for faster loading (add pagination later if needed)
  query = query.limit(100)

  const { data: projects, error: fetchError } = await query

  if (fetchError) {
    return { error: fetchError.message }
  }

  const normalizedProjects: ProjectRow[] = (projects || []).map((project: any) => {
    const rawClient = Array.isArray(project.client) ? project.client[0] : project.client;
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      due_date_date: project.due_date_date,
      due_date_text: project.due_date_text,
      client_id: project.client_id,
      internal_group_id: project.internal_group_id ?? null,
      created_at: project.created_at,
      updated_at: project.updated_at,
      client: rawClient
        ? {
            id: rawClient.id,
            name: rawClient.name ?? null,
            company: rawClient.company ?? null,
          }
        : null,
    };
  });

  let enrichedProjects = normalizedProjects

  if (options?.includeFirstTabPreview && enrichedProjects.length > 0) {
    try {
      const projectIds = enrichedProjects.map((project) => project.id)
      const { data: tabs, error: tabsError } = await supabase
        .from('tabs')
        .select('id, project_id, name, position, parent_tab_id')
        .in('project_id', projectIds)
        .is('parent_tab_id', null)
        .order('project_id', { ascending: true })
        .order('position', { ascending: true })

      if (tabsError) {
        console.error('Failed to fetch tabs for previews:', tabsError)
      } else {
        const firstTabByProject = new Map<string, { id: string; name: string }>()
        tabs?.forEach((tab) => {
          if (!firstTabByProject.has(tab.project_id)) {
            firstTabByProject.set(tab.project_id, { id: tab.id, name: tab.name })
          }
        })

        const tabIds = Array.from(firstTabByProject.values()).map((tab) => tab.id)
        const previewBlocksByTab = new Map<string, TabPreviewBlock[]>()

        if (tabIds.length > 0) {
          // Note: Fetches full content JSONB - could be optimized by only selecting specific keys
          // but summarizeBlockPreview() needs the full content object structure
          const { data: blocks, error: blocksError } = await supabase
            .from('blocks')
            .select('id, tab_id, type, content, column, position, parent_block_id')
            .in('tab_id', tabIds)
            .is('parent_block_id', null)
            .lte('position', 3)
            .order('column', { ascending: true })
            .order('position', { ascending: true })

          if (blocksError) {
            console.error('Failed to fetch block previews:', blocksError)
          } else if (blocks && blocks.length > 0) {
            const pdfFileIds = Array.from(
              new Set(
                blocks
                  .filter((block) => block.type === 'pdf')
                  .map((block) => {
                    const content = (block.content ?? {}) as Record<string, any>;
                    const fileId = content?.fileId;
                    return typeof fileId === 'string' ? fileId : null;
                  })
                  .filter((value): value is string => Boolean(value))
              )
            )

            const pdfFileNames = new Map<string, string>()
            if (pdfFileIds.length > 0) {
              const { data: pdfFiles, error: pdfError } = await supabase
                .from('files')
                .select('id, file_name')
                .in('id', pdfFileIds)

              if (pdfError) {
                console.error('Failed to fetch pdf filenames for previews:', pdfError)
              } else {
                pdfFiles?.forEach((file) => {
                  if (file?.id && file?.file_name) {
                    pdfFileNames.set(file.id, file.file_name)
                  }
                })
              }
            }

            const taskBlockIds = blocks
              .filter((block) => block.type === 'task')
              .map((block) => block.id)
            const taskItemsByBlock = new Map<string, Array<{ id: string; title: string; status: string }>>()

            if (taskBlockIds.length > 0) {
              const { data: taskItems, error: taskError } = await supabase
                .from('task_items')
                .select('id, title, status, task_block_id, display_order')
                .in('task_block_id', taskBlockIds)
                .order('display_order', { ascending: true })

              if (taskError) {
                console.error('Failed to fetch task previews:', taskError)
              } else {
                taskItems?.forEach((task) => {
                  const list = taskItemsByBlock.get(task.task_block_id) || []
                  list.push({ id: task.id, title: task.title, status: task.status })
                  taskItemsByBlock.set(task.task_block_id, list)
                })
              }
            }

            blocks.forEach((block) => {
              const preview = summarizeBlockPreview(block as any, { pdfFileNames, taskItemsByBlock })
              const previewEntry: TabPreviewBlock = {
                id: block.id,
                type: block.type as BlockType,
                column: block.column,
                position: block.position,
                summary: preview.summary || block.type,
                detailLines: preview.detailLines,
                meta: preview.meta,
              }

              const existing = previewBlocksByTab.get(block.tab_id) || []
              if (existing.length < 6) {
                existing.push(previewEntry)
                previewBlocksByTab.set(block.tab_id, existing)
              }
            })
          }
        }

        enrichedProjects = enrichedProjects.map((project) => {
          const firstTab = firstTabByProject.get(project.id)
          if (!firstTab) {
            return { ...project, first_tab_preview: null }
          }

          return {
            ...project,
            first_tab_preview: {
              tab_id: firstTab.id,
              tab_name: firstTab.name,
              blocks: previewBlocksByTab.get(firstTab.id) || [],
            },
          }
        })
      }
    } catch (error) {
      console.error('Failed to build project previews:', error)
    }
  }

  return { data: enrichedProjects as ProjectWithPreview[] }
}

// 3. GET SINGLE PROJECT (with full details)
export async function getSingleProject(projectId: string) {
  const authResult = await getServerUser()

  // Get authenticated user
  if (!authResult) {
    return { error: 'Unauthorized' }
  }
  const { supabase, user } = authResult

  // Get project with workspace and client info
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select(`
      *,
      workspace:workspaces (
        id,
        name
      ),
      client:clients (
        id,
        name,
        company,
        email
      )
    `)
    .eq('id', projectId)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  // Check if user is a member of the project's workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to view this project' }
  }

  return { data: project }
}

// 4. UPDATE PROJECT
export async function updateProject(projectId: string, updates: Partial<ProjectData>, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  let userId: string
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
    userId = opts.authContext.userId
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
    userId = authResult.user.id
  }

  // Get project to find workspace_id
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('workspace_id, client_id')
    .eq('id', projectId)
    .single()

  if (fetchError) {
    return { error: 'Project not found' }
  }

  // Check if user is a member of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'You must be a workspace member to update projects' }
  }

  // If updating client_id, verify it belongs to the same workspace
  if (updates.client_id !== undefined && updates.client_id !== null) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('workspace_id')
      .eq('id', updates.client_id)
      .single()

    if (clientError) {
      return { error: 'Client not found' }
    }

    if (client.workspace_id !== project.workspace_id) {
      return { error: 'Client does not belong to this workspace' }
    }
  }

  // Map assigned_tags to DB column "tags"
  const dbUpdates = { ...updates, updated_at: new Date().toISOString() }
  if ('assigned_tags' in dbUpdates) {
    (dbUpdates as Record<string, unknown>).tags = dbUpdates.assigned_tags
    delete (dbUpdates as Record<string, unknown>).assigned_tags
  }

  // Update the project (including updated_at)
  const { data: updatedProject, error: updateError } = await supabase
    .from('projects')
    .update(dbUpdates)
    .eq('id', projectId)
    .select()
    .single()

  if (updateError) {
    return { error: updateError.message }
  }

  await safeRevalidatePath('/dashboard')
  return { data: updatedProject }
}

// 5. DELETE PROJECT
export async function deleteProject(projectId: string, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
  let userId: string
  if (opts?.authContext) {
    supabase = opts.authContext.supabase
    userId = opts.authContext.userId
  } else {
    const authResult = await getServerUser()
    if (!authResult) return { error: 'Unauthorized' }
    supabase = authResult.supabase
    userId = authResult.user.id
  }

  // Get project to find workspace_id
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .single()

  if (fetchError) {
    return { error: 'Project not found' }
  }

  // Check if user is admin or owner of the workspace
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', project.workspace_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'Unauthorized' }
  }

  if (membership.role !== 'admin' && membership.role !== 'owner') {
    return { error: 'Only admins and owners can delete projects' }
  }

  // TODO: In future tasks, check for dependencies (tasks, files, etc.)
  // For now, we'll just delete the project

  // Delete the project
  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  await safeRevalidatePath('/dashboard')
  return { data: { success: true, message: 'Project deleted successfully' } }
}
