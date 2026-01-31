"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import type { TaskItem } from "@/types/task";
import type { Table, TableRow, TableField } from "@/types/table";
import type { TimelineEvent } from "@/types/timeline";
import type { Tab } from "@/app/actions/tab";
import type { Block } from "@/app/actions/block";
import type { Doc } from "@/app/actions/doc";

interface ContextResponse<T> {
  data: T | null;
  error: string | null;
}

interface TaskWithContext {
  task: TaskItem;
  assignees: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string; color: string | null }>;
  references: Array<{
    id: string;
    reference_type: string;
    reference_id: string;
    table_id: string | null;
  }>;
  comments: Array<{
    id: string;
    author_id: string | null;
    text: string;
    created_at: string;
  }>;
  block: {
    id: string;
    type: string;
    tab_id: string;
  };
  tab: {
    id: string;
    name: string;
    project_id: string;
  };
  project: {
    id: string;
    name: string;
    status: string;
    client_id: string | null;
  };
  client?: {
    id: string;
    name: string;
    company: string | null;
  };
}

interface ProjectWithContext {
  project: {
    id: string;
    workspace_id: string;
    client_id: string | null;
    name: string;
    status: string;
    due_date_date: string | null;
    due_date_text: string | null;
    project_type: string;
    created_at: string;
    updated_at: string;
  };
  client?: {
    id: string;
    name: string;
    email: string | null;
    company: string | null;
  };
  tabs: Array<{
    id: string;
    name: string;
    position: number;
    is_client_visible: boolean;
  }>;
  taskSummary: {
    total: number;
    byStatus: {
      todo: number;
      "in-progress": number;
      done: number;
    };
    overdue: number;
  };
  files: Array<{
    id: string;
    file_name: string;
    file_type: string | null;
    file_size: number;
    created_at: string;
  }>;
  timelineEvents: Array<{
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    status: string | null;
  }>;
}

interface BlockWithContext {
  block: Pick<
    Block,
    "id" | "tab_id" | "parent_block_id" | "type" | "content" | "position" | "column" | "created_at" | "updated_at"
  >;
  properties: {
    id: string;
    status: string | null;
    priority: string | null;
    assignee_id: string | null;
    due_date: string | null;
    tags: string[];
    created_at: string;
    updated_at: string;
  } | null;
  links: Array<{
    id: string;
    source_entity_type: string;
    source_entity_id: string;
    target_entity_type: string;
    target_entity_id: string;
    created_at: string;
  }>;
  parent?: Pick<Block, "id" | "type" | "content">;
  children: Array<Pick<Block, "id" | "type" | "position">>;
  tab: Pick<Tab, "id" | "name" | "project_id">;
  project: {
    id: string;
    name: string;
  };
}

interface TableWithRows {
  table: Pick<Table, "id" | "workspace_id" | "project_id" | "title" | "description" | "icon" | "created_at">;
  fields: Array<Pick<TableField, "id" | "name" | "type" | "config" | "order" | "is_primary" | "width">>;
  rows: Array<Pick<TableRow, "id" | "data" | "order" | "created_at" | "updated_at">>;
  rowCount: number;
}

interface DocWithContext {
  doc: Doc;
  referencedInProjects: Array<{
    project_id: string;
    project_name: string;
  }>;
  referencedInTasks: Array<{
    task_id: string;
    task_title: string;
  }>;
}

interface TimelineEventWithContext {
  event: Pick<
    TimelineEvent,
    | "id"
    | "timeline_block_id"
    | "workspace_id"
    | "title"
    | "start_date"
    | "end_date"
    | "status"
    | "assignee_id"
    | "progress"
    | "notes"
    | "color"
    | "is_milestone"
    | "created_at"
  >;
  assignee?: {
    id: string;
    name: string | null;
    email: string;
  };
  references: Array<{
    id: string;
    reference_type: string;
    reference_id: string;
  }>;
  block: {
    id: string;
    tab_id: string;
  };
  project: {
    id: string;
    name: string;
  };
}

interface ClientWithContext {
  client: {
    id: string;
    workspace_id: string;
    name: string;
    email: string | null;
    company: string | null;
    phone: string | null;
    address: string | null;
    website: string | null;
    notes: string | null;
    created_at: string;
  };
  projects: Array<{
    id: string;
    name: string;
    status: string;
    due_date_date: string | null;
    created_at: string;
  }>;
  taskSummary: {
    total: number;
    byStatus: {
      todo: number;
      "in-progress": number;
      done: number;
    };
  };
}

interface TabWithContext {
  tab: Pick<Tab, "id" | "project_id" | "parent_tab_id" | "name" | "position" | "created_at"> & {
    is_client_visible: boolean;
    client_title: string | null;
  };
  project: {
    id: string;
    name: string;
    status: string;
    client_id: string | null;
  };
  parentTab?: {
    id: string;
    name: string;
  };
  childTabs: Array<{
    id: string;
    name: string;
    position: number;
  }>;
  blocksSummary: {
    total: number;
    byType: Record<string, number>;
  };
}

interface FileWithContext {
  file: {
    id: string;
    workspace_id: string;
    uploaded_by: string;
    file_name: string;
    file_size: number;
    file_type: string | null;
    bucket: string;
    storage_path: string;
    created_at: string;
    project_id: string;
  };
  project: {
    id: string;
    name: string;
  };
  attachments: Array<{
    id: string;
    block_id: string;
    display_mode: string;
    created_at: string;
  }>;
  uploader?: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface CommentWithContext {
  comment: {
    id: string;
    text: string;
    created_at: string;
    updated_at: string;
  };
  author?: {
    id: string;
    name: string | null;
    email: string;
  };
  target: {
    type: string;
    id: string;
    title?: string;
  };
}

async function getContextHelper(): Promise<
  | { error: string; workspaceId?: undefined; supabase?: undefined }
  | { error: null; workspaceId: string; supabase: Awaited<ReturnType<typeof createClient>> }
> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return { error: "No workspace selected" };
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();
  return { error: null, workspaceId, supabase };
}

function buildTaskSummary(tasks: Array<{ status: string; due_date: string | null }>) {
  const byStatus = {
    todo: 0,
    "in-progress": 0,
    done: 0,
  };
  let overdue = 0;
  const now = new Date();

  tasks.forEach((task) => {
    if (task.status === "todo") byStatus.todo += 1;
    if (task.status === "in-progress") byStatus["in-progress"] += 1;
    if (task.status === "done") byStatus.done += 1;
    if (task.due_date && task.status !== "done") {
      const dueDate = new Date(task.due_date);
      if (dueDate < now) {
        overdue += 1;
      }
    }
  });

  return {
    total: tasks.length,
    byStatus,
    overdue,
  };
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getTaskWithContext(params: {
  taskId: string;
}): Promise<ContextResponse<TaskWithContext>> {
  const context = await getContextHelper();
  if (context.error !== null) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;

  try {
    const { data: task, error: taskError } = await supabase
      .from("task_items")
      .select(
        "id, task_block_id, workspace_id, project_id, tab_id, title, status, priority, assignee_id, description, due_date, due_time, start_date, hide_icons, display_order, recurring_enabled, recurring_frequency, recurring_interval, created_by, updated_by, created_at, updated_at, task_assignees(assignee_id, assignee_name), task_tag_links(task_tags(id, name, color)), blocks(id, type, tab_id), tabs(id, name, project_id, projects(id, name, status, client_id, clients(id, name, company)))"
      )
      .eq("id", params.taskId)
      .eq("workspace_id", workspaceId)
      .single();

    if (taskError) {
      console.error("getTaskWithContext error:", taskError);
      return { data: null, error: taskError.message };
    }

    if (!task) {
      return { data: null, error: "Task not found" };
    }

    const assignees = Array.isArray(task.task_assignees)
      ? task.task_assignees.map((assignee: any) => ({
          id: assignee.assignee_id,
          name: assignee.assignee_name,
        }))
      : [];

    const tags = Array.isArray(task.task_tag_links)
      ? task.task_tag_links
          .map((link: any) => link.task_tags)
          .filter((tag: any) => Boolean(tag))
          .map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            color: tag.color ?? null,
          }))
      : [];

    const { data: references, error: referencesError } = await supabase
      .from("task_references")
      .select("id, reference_type, reference_id, table_id")
      .eq("task_id", params.taskId)
      .eq("workspace_id", workspaceId);

    if (referencesError) {
      console.error("getTaskWithContext references error:", referencesError);
      return { data: null, error: referencesError.message };
    }

    const { data: comments, error: commentsError } = await supabase
      .from("task_comments")
      .select("id, author_id, text, created_at")
      .eq("task_id", params.taskId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (commentsError) {
      console.error("getTaskWithContext comments error:", commentsError);
      return { data: null, error: commentsError.message };
    }

    const taskBlock = firstOrNull(task.blocks);
    const taskTab = firstOrNull(task.tabs);
    const taskProject = firstOrNull(taskTab?.projects);

    const blockInfo = {
      id: taskBlock?.id ?? task.task_block_id,
      type: taskBlock?.type ?? "task",
      tab_id: taskBlock?.tab_id ?? task.tab_id,
    };

    const tabInfo = {
      id: taskTab?.id ?? task.tab_id,
      name: taskTab?.name ?? "Untitled Tab",
      project_id: taskTab?.project_id ?? task.project_id,
    };

    const projectInfo = {
      id: taskProject?.id ?? task.project_id,
      name: taskProject?.name ?? "Untitled Project",
      status: taskProject?.status ?? "not_started",
      client_id: taskProject?.client_id ?? null,
    };

    const taskClient = firstOrNull(taskProject?.clients);
    const client = taskClient
      ? {
          id: taskClient.id,
          name: taskClient.name,
          company: taskClient.company ?? null,
        }
      : undefined;

    return {
      data: {
        task: {
          id: task.id,
          task_block_id: task.task_block_id,
          workspace_id: task.workspace_id,
          project_id: task.project_id,
          tab_id: task.tab_id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assignee_id: task.assignee_id ?? null,
          description: task.description,
          due_date: task.due_date,
          due_time: task.due_time,
          start_date: task.start_date,
          hide_icons: task.hide_icons,
          display_order: task.display_order,
          recurring_enabled: task.recurring_enabled,
          recurring_frequency: task.recurring_frequency,
          recurring_interval: task.recurring_interval,
          created_by: task.created_by,
          updated_by: task.updated_by,
          created_at: task.created_at,
          updated_at: task.updated_at,
        },
        assignees,
        tags,
        references: (references ?? []).map((reference: any) => ({
          id: reference.id,
          reference_type: reference.reference_type,
          reference_id: reference.reference_id,
          table_id: reference.table_id,
        })),
        comments: (comments ?? []).map((comment: any) => ({
          id: comment.id,
          author_id: comment.author_id,
          text: comment.text,
          created_at: comment.created_at,
        })),
        block: blockInfo,
        tab: tabInfo,
        project: projectInfo,
        client,
      },
      error: null,
    };
  } catch (error) {
    console.error("getTaskWithContext error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getProjectWithContext(params: {
  projectId: string;
}): Promise<ContextResponse<ProjectWithContext>> {
  const context = await getContextHelper();
  if (context.error !== null) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;

  try {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, client_id, name, status, due_date_date, due_date_text, project_type, created_at, updated_at")
      .eq("id", params.projectId)
      .eq("workspace_id", workspaceId)
      .single();

    if (projectError) {
      console.error("getProjectWithContext error:", projectError);
      return { data: null, error: projectError.message };
    }

    if (!project) {
      return { data: null, error: "Project not found" };
    }

    let client: ProjectWithContext["client"] | undefined;
    if (project.client_id) {
      const { data: clientRow, error: clientError } = await supabase
        .from("clients")
        .select("id, name, email, company")
        .eq("id", project.client_id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (clientError) {
        console.error("getProjectWithContext client error:", clientError);
        return { data: null, error: clientError.message };
      }

      if (clientRow) {
        client = {
          id: clientRow.id,
          name: clientRow.name,
          email: clientRow.email ?? null,
          company: clientRow.company ?? null,
        };
      }
    }

    const { data: tabs, error: tabsError } = await supabase
      .from("tabs")
      .select("id, name, position, is_client_visible")
      .eq("project_id", params.projectId)
      .order("position", { ascending: true });

    if (tabsError) {
      console.error("getProjectWithContext tabs error:", tabsError);
      return { data: null, error: tabsError.message };
    }

    const { data: taskRows, error: tasksError } = await supabase
      .from("task_items")
      .select("status, due_date")
      .eq("workspace_id", workspaceId)
      .eq("project_id", params.projectId);

    if (tasksError) {
      console.error("getProjectWithContext tasks error:", tasksError);
      return { data: null, error: tasksError.message };
    }

    const taskSummary = buildTaskSummary(taskRows ?? []);

    const { data: files, error: filesError } = await supabase
      .from("files")
      .select("id, file_name, file_type, file_size, created_at")
      .eq("workspace_id", workspaceId)
      .eq("project_id", params.projectId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (filesError) {
      console.error("getProjectWithContext files error:", filesError);
      return { data: null, error: filesError.message };
    }

    const { data: timelineEvents, error: timelineError } = await supabase
      .from("timeline_events")
      .select("id, title, start_date, end_date, status, blocks!inner(tab_id, tabs!inner(project_id))")
      .eq("blocks.tabs.project_id", params.projectId)
      .limit(100);

    if (timelineError) {
      console.error("getProjectWithContext timeline error:", timelineError);
      return { data: null, error: timelineError.message };
    }

    return {
      data: {
        project: {
          id: project.id,
          workspace_id: project.workspace_id,
          client_id: project.client_id,
          name: project.name,
          status: project.status,
          due_date_date: project.due_date_date,
          due_date_text: project.due_date_text,
          project_type: project.project_type,
          created_at: project.created_at,
          updated_at: project.updated_at,
        },
        client,
        tabs: (tabs ?? []).map((tab: any) => ({
          id: tab.id,
          name: tab.name,
          position: tab.position,
          is_client_visible: tab.is_client_visible,
        })),
        taskSummary,
        files: (files ?? []).map((file: any) => ({
          id: file.id,
          file_name: file.file_name,
          file_type: file.file_type,
          file_size: file.file_size,
          created_at: file.created_at,
        })),
        timelineEvents: (timelineEvents ?? []).map((event: any) => ({
          id: event.id,
          title: event.title,
          start_date: event.start_date,
          end_date: event.end_date,
          status: event.status,
        })),
      },
      error: null,
    };
  } catch (error) {
    console.error("getProjectWithContext error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getBlockWithContext(params: {
  blockId: string;
}): Promise<ContextResponse<BlockWithContext>> {
  const context = await getContextHelper();
  if (context.error !== null) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;

  try {
    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select(
        "id, tab_id, parent_block_id, type, content, position, column, created_at, updated_at, tabs!inner(id, name, project_id, projects!inner(id, name, workspace_id))"
      )
      .eq("id", params.blockId)
      .eq("tabs.projects.workspace_id", workspaceId)
      .single();

    if (blockError) {
      console.error("getBlockWithContext error:", blockError);
      return { data: null, error: blockError.message };
    }

    if (!block) {
      return { data: null, error: "Block not found" };
    }

    let parent: BlockWithContext["parent"] | undefined;
    if (block.parent_block_id) {
      const { data: parentBlock, error: parentError } = await supabase
        .from("blocks")
        .select("id, type, content")
        .eq("id", block.parent_block_id)
        .single();

      if (parentError) {
        console.error("getBlockWithContext parent error:", parentError);
        return { data: null, error: parentError.message };
      }

      if (parentBlock) {
        parent = {
          id: parentBlock.id,
          type: parentBlock.type,
          content: parentBlock.content,
        };
      }
    }

    const { data: children, error: childrenError } = await supabase
      .from("blocks")
      .select("id, type, position")
      .eq("parent_block_id", params.blockId)
      .order("position", { ascending: true })
      .limit(200);

    if (childrenError) {
      console.error("getBlockWithContext children error:", childrenError);
      return { data: null, error: childrenError.message };
    }

    const { data: properties, error: propertiesError } = await supabase
      .from("entity_properties")
      .select("id, status, priority, assignee_id, due_date, tags, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("entity_type", "block")
      .eq("entity_id", params.blockId)
      .maybeSingle();

    if (propertiesError) {
      console.error("getBlockWithContext properties error:", propertiesError);
      return { data: null, error: propertiesError.message };
    }

    const { data: outgoingLinks, error: outgoingLinksError } = await supabase
      .from("entity_links")
      .select("id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, created_at")
      .eq("workspace_id", workspaceId)
      .eq("source_entity_type", "block")
      .eq("source_entity_id", params.blockId);

    if (outgoingLinksError) {
      console.error("getBlockWithContext outgoing links error:", outgoingLinksError);
      return { data: null, error: outgoingLinksError.message };
    }

    const { data: incomingLinks, error: incomingLinksError } = await supabase
      .from("entity_links")
      .select("id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, created_at")
      .eq("workspace_id", workspaceId)
      .eq("target_entity_type", "block")
      .eq("target_entity_id", params.blockId);

    if (incomingLinksError) {
      console.error("getBlockWithContext incoming links error:", incomingLinksError);
      return { data: null, error: incomingLinksError.message };
    }

    return {
      data: {
        block: {
          id: block.id,
          tab_id: block.tab_id,
          parent_block_id: block.parent_block_id,
          type: block.type,
          content: block.content,
          position: block.position,
          column: block.column,
          created_at: block.created_at,
          updated_at: block.updated_at,
        },
        properties: properties
          ? {
              id: properties.id,
              status: properties.status,
              priority: properties.priority,
              assignee_id: properties.assignee_id,
              due_date: properties.due_date,
              tags: properties.tags ?? [],
              created_at: properties.created_at,
              updated_at: properties.updated_at,
            }
          : null,
        links: [...(outgoingLinks ?? []), ...(incomingLinks ?? [])].map((link: any) => ({
          id: link.id,
          source_entity_type: link.source_entity_type,
          source_entity_id: link.source_entity_id,
          target_entity_type: link.target_entity_type,
          target_entity_id: link.target_entity_id,
          created_at: link.created_at,
        })),
        parent,
        children: (children ?? []).map((child: any) => ({
          id: child.id,
          type: child.type,
          position: child.position,
        })),
        tab: {
          id: firstOrNull(block.tabs)?.id ?? block.tab_id,
          name: firstOrNull(block.tabs)?.name ?? "Untitled Tab",
          project_id: firstOrNull(block.tabs)?.project_id ?? "",
        },
        project: {
          id: firstOrNull(firstOrNull(block.tabs)?.projects)?.id ?? "",
          name: firstOrNull(firstOrNull(block.tabs)?.projects)?.name ?? "Untitled Project",
        },
      },
      error: null,
    };
  } catch (error) {
    console.error("getBlockWithContext error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getTableWithRows(params: {
  tableId: string;
  limit?: number;
}): Promise<ContextResponse<TableWithRows>> {
  const context = await getContextHelper();
  if (context.error !== null) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;
  const limit = params.limit ?? 100;

  try {
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("id, workspace_id, project_id, title, description, icon, created_at")
      .eq("id", params.tableId)
      .eq("workspace_id", workspaceId)
      .single();

    if (tableError) {
      console.error("getTableWithRows error:", tableError);
      return { data: null, error: tableError.message };
    }

    if (!table) {
      return { data: null, error: "Table not found" };
    }

    const { data: fields, error: fieldsError } = await supabase
      .from("table_fields")
      .select("id, name, type, config, order, is_primary, width")
      .eq("table_id", params.tableId)
      .order("order", { ascending: true });

    if (fieldsError) {
      console.error("getTableWithRows fields error:", fieldsError);
      return { data: null, error: fieldsError.message };
    }

    const { data: rows, error: rowsError } = await supabase
      .from("table_rows")
      .select("id, data, order, created_at, updated_at")
      .eq("table_id", params.tableId)
      .order("order", { ascending: true })
      .limit(limit);

    if (rowsError) {
      console.error("getTableWithRows rows error:", rowsError);
      return { data: null, error: rowsError.message };
    }

    const { count, error: countError } = await supabase
      .from("table_rows")
      .select("id", { count: "exact", head: true })
      .eq("table_id", params.tableId);

    if (countError) {
      console.error("getTableWithRows count error:", countError);
      return { data: null, error: countError.message };
    }

    return {
      data: {
        table: {
          id: table.id,
          workspace_id: table.workspace_id,
          project_id: table.project_id,
          title: table.title,
          description: table.description,
          icon: table.icon,
          created_at: table.created_at,
        },
        fields: (fields ?? []).map((field: any) => ({
          id: field.id,
          name: field.name,
          type: field.type,
          config: field.config,
          order: field.order,
          is_primary: field.is_primary,
          width: field.width,
        })),
        rows: (rows ?? []).map((row: any) => ({
          id: row.id,
          data: row.data,
          order: row.order,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
        rowCount: count ?? 0,
      },
      error: null,
    };
  } catch (error) {
    console.error("getTableWithRows error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getDocWithContext(params: {
  docId: string;
}): Promise<ContextResponse<DocWithContext>> {
  const context = await getContextHelper();
  if (context.error !== null) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;

  try {
    const { data: doc, error: docError } = await supabase
      .from("docs")
      .select("id, workspace_id, title, content, created_by, created_at, updated_at, last_edited_by, is_archived")
      .eq("id", params.docId)
      .eq("workspace_id", workspaceId)
      .single();

    if (docError) {
      console.error("getDocWithContext error:", docError);
      return { data: null, error: docError.message };
    }

    if (!doc) {
      return { data: null, error: "Doc not found" };
    }

    const { data: references, error: referencesError } = await supabase
      .from("task_references")
      .select("id, task_id, reference_type, reference_id, task_items(id, title, project_id, projects(id, name))")
      .eq("reference_type", "doc")
      .eq("reference_id", params.docId)
      .eq("workspace_id", workspaceId);

    if (referencesError) {
      console.error("getDocWithContext references error:", referencesError);
      return { data: null, error: referencesError.message };
    }

    const referencedInTasks = (references ?? [])
      .map((reference: any) => firstOrNull(reference.task_items))
      .filter((task: any) => Boolean(task))
      .map((task: any) => ({
        task_id: task.id,
        task_title: task.title,
      }));

    const projectMap = new Map<string, string>();
    (references ?? []).forEach((reference: any) => {
      const project = firstOrNull(firstOrNull(reference.task_items)?.projects);
      if (project) {
        projectMap.set(project.id, project.name);
      }
    });

    const referencedInProjects = Array.from(projectMap.entries()).map(([project_id, project_name]) => ({
      project_id,
      project_name,
    }));

    return {
      data: {
        doc: {
          id: doc.id,
          workspace_id: doc.workspace_id,
          title: doc.title,
          content: doc.content,
          created_by: doc.created_by,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          last_edited_by: doc.last_edited_by,
          is_archived: doc.is_archived,
        },
        referencedInProjects,
        referencedInTasks,
      },
      error: null,
    };
  } catch (error) {
    console.error("getDocWithContext error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getTimelineEventWithContext(params: {
  eventId: string;
}): Promise<ContextResponse<TimelineEventWithContext>> {
  const context = await getContextHelper();
  if (context.error !== null) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;

  try {
    const { data: event, error: eventError } = await supabase
      .from("timeline_events")
      .select(
        "id, timeline_block_id, workspace_id, title, start_date, end_date, status, assignee_id, progress, notes, color, is_milestone, created_at"
      )
      .eq("id", params.eventId)
      .eq("workspace_id", workspaceId)
      .single();

    if (eventError) {
      console.error("getTimelineEventWithContext error:", eventError);
      return { data: null, error: eventError.message };
    }

    if (!event) {
      return { data: null, error: "Timeline event not found" };
    }

    let assignee: TimelineEventWithContext["assignee"] | undefined;
    if (event.assignee_id) {
      const { data: assigneeRow, error: assigneeError } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("id", event.assignee_id)
        .single();

      if (assigneeError) {
        console.error("getTimelineEventWithContext assignee error:", assigneeError);
        return { data: null, error: assigneeError.message };
      }

      if (assigneeRow) {
        assignee = {
          id: assigneeRow.id,
          name: assigneeRow.name ?? null,
          email: assigneeRow.email,
        };
      }
    }

    const { data: references, error: referencesError } = await supabase
      .from("timeline_references")
      .select("id, reference_type, reference_id")
      .eq("event_id", params.eventId)
      .eq("workspace_id", workspaceId);

    if (referencesError) {
      console.error("getTimelineEventWithContext references error:", referencesError);
      return { data: null, error: referencesError.message };
    }

    const { data: block, error: blockError } = await supabase
      .from("blocks")
      .select("id, tab_id, tabs!inner(id, project_id, projects!inner(id, name, workspace_id))")
      .eq("id", event.timeline_block_id)
      .eq("tabs.projects.workspace_id", workspaceId)
      .single();

    if (blockError) {
      console.error("getTimelineEventWithContext block error:", blockError);
      return { data: null, error: blockError.message };
    }

    if (!block) {
      return { data: null, error: "Timeline block not found" };
    }

    return {
      data: {
        event: {
          id: event.id,
          timeline_block_id: event.timeline_block_id,
          workspace_id: event.workspace_id,
          title: event.title,
          start_date: event.start_date,
          end_date: event.end_date,
          status: event.status,
          assignee_id: event.assignee_id,
          progress: event.progress,
          notes: event.notes,
          color: event.color,
          is_milestone: event.is_milestone,
          created_at: event.created_at,
        },
        assignee,
        references: (references ?? []).map((reference: any) => ({
          id: reference.id,
          reference_type: reference.reference_type,
          reference_id: reference.reference_id,
        })),
        block: {
          id: block.id,
          tab_id: block.tab_id,
        },
        project: {
          id: firstOrNull(firstOrNull(block.tabs)?.projects)?.id ?? "",
          name: firstOrNull(firstOrNull(block.tabs)?.projects)?.name ?? "Untitled Project",
        },
      },
      error: null,
    };
  } catch (error) {
    console.error("getTimelineEventWithContext error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getClientWithContext(params: {
  clientId: string;
}): Promise<ContextResponse<ClientWithContext>> {
  const context = await getContextHelper();
  if (context.error !== null) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;

  try {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, workspace_id, name, email, company, phone, address, website, notes, created_at")
      .eq("id", params.clientId)
      .eq("workspace_id", workspaceId)
      .single();

    if (clientError) {
      console.error("getClientWithContext error:", clientError);
      return { data: null, error: clientError.message };
    }

    if (!client) {
      return { data: null, error: "Client not found" };
    }

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, status, due_date_date, created_at")
      .eq("client_id", params.clientId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (projectsError) {
      console.error("getClientWithContext projects error:", projectsError);
      return { data: null, error: projectsError.message };
    }

    const projectIds = (projects ?? []).map((project: any) => project.id);

    let taskSummary = {
      total: 0,
      byStatus: {
        todo: 0,
        "in-progress": 0,
        done: 0,
      },
    };

    if (projectIds.length > 0) {
      const { data: tasks, error: tasksError } = await supabase
        .from("task_items")
        .select("status, due_date")
        .eq("workspace_id", workspaceId)
        .in("project_id", projectIds);

      if (tasksError) {
        console.error("getClientWithContext tasks error:", tasksError);
        return { data: null, error: tasksError.message };
      }

      const summary = buildTaskSummary(tasks ?? []);
      taskSummary = {
        total: summary.total,
        byStatus: summary.byStatus,
      };
    }

    return {
      data: {
        client: {
          id: client.id,
          workspace_id: client.workspace_id,
          name: client.name,
          email: client.email ?? null,
          company: client.company ?? null,
          phone: client.phone ?? null,
          address: client.address ?? null,
          website: client.website ?? null,
          notes: client.notes ?? null,
          created_at: client.created_at,
        },
        projects: (projects ?? []).map((project: any) => ({
          id: project.id,
          name: project.name,
          status: project.status,
          due_date_date: project.due_date_date,
          created_at: project.created_at,
        })),
        taskSummary,
      },
      error: null,
    };
  } catch (error) {
    console.error("getClientWithContext error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getTabWithContext(params: {
  tabId: string;
}): Promise<ContextResponse<TabWithContext>> {
  const context = await getContextHelper();
  if (context.error !== null) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;

  try {
    const { data: tab, error: tabError } = await supabase
      .from("tabs")
      .select("id, project_id, parent_tab_id, name, position, is_client_visible, client_title, created_at, projects!inner(id, name, status, client_id, workspace_id)")
      .eq("id", params.tabId)
      .eq("projects.workspace_id", workspaceId)
      .single();

    if (tabError) {
      console.error("getTabWithContext error:", tabError);
      return { data: null, error: tabError.message };
    }

    if (!tab) {
      return { data: null, error: "Tab not found" };
    }

    let parentTab: TabWithContext["parentTab"] | undefined;
    if (tab.parent_tab_id) {
      const { data: parent, error: parentError } = await supabase
        .from("tabs")
        .select("id, name")
        .eq("id", tab.parent_tab_id)
        .single();

      if (parentError) {
        console.error("getTabWithContext parent error:", parentError);
        return { data: null, error: parentError.message };
      }

      if (parent) {
        parentTab = { id: parent.id, name: parent.name };
      }
    }

    const { data: childTabs, error: childError } = await supabase
      .from("tabs")
      .select("id, name, position")
      .eq("parent_tab_id", params.tabId)
      .order("position", { ascending: true });

    if (childError) {
      console.error("getTabWithContext child tabs error:", childError);
      return { data: null, error: childError.message };
    }

    const { data: blocks, error: blocksError } = await supabase
      .from("blocks")
      .select("id, type")
      .eq("tab_id", params.tabId);

    if (blocksError) {
      console.error("getTabWithContext blocks error:", blocksError);
      return { data: null, error: blocksError.message };
    }

    const byType: Record<string, number> = {};
    (blocks ?? []).forEach((block: any) => {
      byType[block.type] = (byType[block.type] ?? 0) + 1;
    });

    return {
      data: {
        tab: {
          id: tab.id,
          project_id: tab.project_id,
          parent_tab_id: tab.parent_tab_id,
          name: tab.name,
          position: tab.position,
          is_client_visible: tab.is_client_visible,
          client_title: tab.client_title ?? null,
          created_at: tab.created_at,
        },
        project: {
          id: firstOrNull(tab.projects)?.id ?? "",
          name: firstOrNull(tab.projects)?.name ?? "Untitled Project",
          status: firstOrNull(tab.projects)?.status ?? "not_started",
          client_id: firstOrNull(tab.projects)?.client_id ?? null,
        },
        parentTab,
        childTabs: (childTabs ?? []).map((child: any) => ({
          id: child.id,
          name: child.name,
          position: child.position,
        })),
        blocksSummary: {
          total: (blocks ?? []).length,
          byType,
        },
      },
      error: null,
    };
  } catch (error) {
    console.error("getTabWithContext error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getFileWithContext(params: {
  fileId: string;
}): Promise<ContextResponse<FileWithContext>> {
  const context = await getContextHelper();
  if (context.error !== null) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;

  try {
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("id, workspace_id, uploaded_by, file_name, file_size, file_type, bucket, storage_path, created_at, project_id")
      .eq("id", params.fileId)
      .eq("workspace_id", workspaceId)
      .single();

    if (fileError) {
      console.error("getFileWithContext error:", fileError);
      return { data: null, error: fileError.message };
    }

    if (!file) {
      return { data: null, error: "File not found" };
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", file.project_id)
      .eq("workspace_id", workspaceId)
      .single();

    if (projectError) {
      console.error("getFileWithContext project error:", projectError);
      return { data: null, error: projectError.message };
    }

    const { data: attachments, error: attachmentsError } = await supabase
      .from("file_attachments")
      .select("id, block_id, display_mode, created_at")
      .eq("file_id", params.fileId);

    if (attachmentsError) {
      console.error("getFileWithContext attachments error:", attachmentsError);
      return { data: null, error: attachmentsError.message };
    }

    let uploader: FileWithContext["uploader"] | undefined;
    const { data: uploaderRow, error: uploaderError } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", file.uploaded_by)
      .maybeSingle();

    if (uploaderError) {
      console.error("getFileWithContext uploader error:", uploaderError);
    } else if (uploaderRow) {
      uploader = {
        id: uploaderRow.id,
        name: uploaderRow.name ?? null,
        email: uploaderRow.email,
      };
    }

    return {
      data: {
        file: {
          id: file.id,
          workspace_id: file.workspace_id,
          uploaded_by: file.uploaded_by,
          file_name: file.file_name,
          file_size: file.file_size,
          file_type: file.file_type,
          bucket: file.bucket,
          storage_path: file.storage_path,
          created_at: file.created_at,
          project_id: file.project_id,
        },
        project: {
          id: project.id,
          name: project.name,
        },
        attachments: (attachments ?? []).map((attachment: any) => ({
          id: attachment.id,
          block_id: attachment.block_id,
          display_mode: attachment.display_mode,
          created_at: attachment.created_at,
        })),
        uploader,
      },
      error: null,
    };
  } catch (error) {
    console.error("getFileWithContext error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getCommentWithContext(params: {
  commentId: string;
  source: "comment" | "task_comment" | "table_comment";
}): Promise<ContextResponse<CommentWithContext>> {
  const context = await getContextHelper();
  if (context.error !== null) {
    return { data: null, error: context.error };
  }

  const { workspaceId, supabase } = context;

  try {
    if (params.source === "task_comment") {
      const { data: comment, error: commentError } = await supabase
        .from("task_comments")
        .select("id, task_id, author_id, text, created_at, updated_at, task_items!inner(id, title, workspace_id)")
        .eq("id", params.commentId)
        .eq("task_items.workspace_id", workspaceId)
        .single();

      if (commentError) {
        console.error("getCommentWithContext task_comment error:", commentError);
        return { data: null, error: commentError.message };
      }

      if (!comment) {
        return { data: null, error: "Comment not found" };
      }

      const author = await getProfileForUser(supabase, comment.author_id);

      return {
        data: {
          comment: {
            id: comment.id,
            text: comment.text,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
          },
          author: author ?? undefined,
          target: {
            type: "task",
            id: comment.task_id,
            title: firstOrNull(comment.task_items)?.title,
          },
        },
        error: null,
      };
    }

    if (params.source === "table_comment") {
      const { data: comment, error: commentError } = await supabase
        .from("table_comments")
        .select("id, row_id, user_id, content, created_at, updated_at, table_rows!inner(id, tables!inner(id, title, workspace_id))")
        .eq("id", params.commentId)
        .eq("table_rows.tables.workspace_id", workspaceId)
        .single();

      if (commentError) {
        console.error("getCommentWithContext table_comment error:", commentError);
        return { data: null, error: commentError.message };
      }

      if (!comment) {
        return { data: null, error: "Comment not found" };
      }

      const author = await getProfileForUser(supabase, comment.user_id);

      return {
        data: {
          comment: {
            id: comment.id,
            text: comment.content,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
          },
          author: author ?? undefined,
          target: {
            type: "table_row",
            id: comment.row_id,
            title: firstOrNull(firstOrNull(comment.table_rows)?.tables)?.title,
          },
        },
        error: null,
      };
    }

    const { data: comment, error: commentError } = await supabase
      .from("comments")
      .select("id, target_type, target_id, user_id, text, created_at, updated_at")
      .eq("id", params.commentId)
      .single();

    if (commentError) {
      console.error("getCommentWithContext comment error:", commentError);
      return { data: null, error: commentError.message };
    }

    if (!comment) {
      return { data: null, error: "Comment not found" };
    }

    const target = await resolveCommentTarget(supabase, workspaceId, comment.target_type, comment.target_id);
    if (!target) {
      return { data: null, error: "Comment not found or not in workspace" };
    }

    const author = await getProfileForUser(supabase, comment.user_id);

    return {
      data: {
        comment: {
          id: comment.id,
          text: comment.text,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
        },
        author: author ?? undefined,
        target,
      },
      error: null,
    };
  } catch (error) {
    console.error("getCommentWithContext error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function getProfileForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | null
) {
  if (!userId) return null;

  const { data, error } = await supabase.from("profiles").select("id, name, email").eq("id", userId).single();
  if (error) {
    console.error("getProfileForUser error:", error);
    return null;
  }

  return {
    id: data.id,
    name: data.name ?? null,
    email: data.email,
  };
}

async function resolveCommentTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  targetType: string,
  targetId: string
) {
  if (targetType === "project") {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, workspace_id")
      .eq("id", targetId)
      .eq("workspace_id", workspaceId)
      .single();
    if (error || !data) return null;
    return { type: "project", id: data.id, title: data.name };
  }

  if (targetType === "tab") {
    const { data, error } = await supabase
      .from("tabs")
      .select("id, name, projects!inner(workspace_id)")
      .eq("id", targetId)
      .eq("projects.workspace_id", workspaceId)
      .single();
    if (error || !data) return null;
    return { type: "tab", id: data.id, title: data.name };
  }

  if (targetType === "block") {
    const { data, error } = await supabase
      .from("blocks")
      .select("id, type, tabs!inner(projects!inner(workspace_id))")
      .eq("id", targetId)
      .eq("tabs.projects.workspace_id", workspaceId)
      .single();
    if (error || !data) return null;
    return { type: "block", id: data.id, title: `Block (${data.type})` };
  }

  return { type: targetType, id: targetId };
}
