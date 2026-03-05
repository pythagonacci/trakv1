"use server";

import { createClient } from "@/lib/supabase/server";
import { getEntitiesProperties } from "@/app/actions/entity-properties";
import { buildDueDateRange, normalizeDueDateRange } from "@/lib/due-date";
import type { EverythingItem, EverythingOptions, EverythingResult } from "@/types/everything";
import type { EntityType, EntityProperties, Status, Priority } from "@/types/properties";

type ActionResult<T> = { data: T } | { error: string };

/** Returns the first priority value when a single value is needed. Does not prefer any field name. */
function firstPriorityFromNamed(priorities: unknown): Priority | null {
  if (!Array.isArray(priorities) || priorities.length === 0) return null;
  const value = (priorities[0] as any)?.value;
  return value === "low" || value === "medium" || value === "high" || value === "urgent"
    ? (value as Priority)
    : null;
}

/** Returns the first status value from named statuses (statuses JSONB). Used after legacy status column was dropped. */
function firstStatusFromNamed(statuses: unknown): Status | null {
  if (!Array.isArray(statuses) || statuses.length === 0) return null;
  const value = (statuses[0] as any)?.value;
  return value === "todo" || value === "in_progress" || value === "blocked" || value === "done"
    ? (value as Status)
    : null;
}

/**
 * Get all items with properties across the entire workspace
 * Aggregates timeline events, task items, table rows, and blocks with properties
 */
export async function getWorkspaceEverything(
  workspaceId: string,
  options?: EverythingOptions
): Promise<ActionResult<EverythingResult>> {
  const supabase = await createClient();
  const limit = options?.limit ?? 2000;
  const offset = options?.offset ?? 0;

  // Execute 4-way UNION query to get all items with properties
  const { data: rawItems, error: queryError } = await supabase.rpc('get_workspace_everything', {
    p_workspace_id: workspaceId,
    p_limit: limit,
    p_offset: offset,
  });

  // If RPC function doesn't exist yet, fall back to manual query
  if (queryError && (queryError.code === 'PGRST202' || queryError.message?.includes('does not exist') || queryError.message?.includes('Could not find'))) {
    return await getWorkspaceEverythingFallback(supabase, workspaceId, limit, offset, options);
  }

  if (queryError) {
    console.error("getWorkspaceEverything error:", queryError);
    return { error: "Failed to fetch workspace items" };
  }

  const items = (rawItems || []).map(mapRawItemToEverythingItem);
  const normalizedItems = await maybeFilterWorkflowTaskCopies(
    supabase,
    items,
    options?.includeWorkflowRepresentations
  );
  const enrichedItems = await hydrateEverythingProperties(normalizedItems, workspaceId);

  // Only keep items that have at least one universal property
  const withAtLeastOneProp = enrichedItems.filter((item) => {
    const p = item.properties;
    return (
      p.status != null ||
      p.priority != null ||
      (p.assignee_ids?.length ?? 0) > 0 ||
      p.due_date != null ||
      (p.tags?.length ?? 0) > 0
    );
  });

  return {
    data: {
      items: withAtLeastOneProp,
      total: withAtLeastOneProp.length,
      hasMore: withAtLeastOneProp.length === limit,
    },
  };
}

/**
 * Fallback implementation using direct SQL queries
 * Used when RPC function is not available
 */
async function getWorkspaceEverythingFallback(
  supabase: any,
  workspaceId: string,
  limit: number,
  offset: number,
  options?: EverythingOptions
): Promise<ActionResult<EverythingResult>> {
  const items: EverythingItem[] = [];

  // First, get all projects for this workspace
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspaceId);

  if (!projects || projects.length === 0) {
    return {
      data: {
        items: [],
        total: 0,
        hasMore: false,
      },
    };
  }

  const projectIds = projects.map((p: any) => p.id);

  // Get all tabs for these projects
  const { data: tabs } = await supabase
    .from('tabs')
    .select('id, name, project_id')
    .in('project_id', projectIds);

  if (!tabs || tabs.length === 0) {
    return {
      data: {
        items: [],
        total: 0,
        hasMore: false,
      },
    };
  }

  const tabIds = tabs.map((t: any) => t.id);
  const tabById = new Map<string, { id: string; name: string; project_id: string }>(
    tabs.map((t: any) => [t.id, t])
  );
  const projectById = new Map<string, { id: string; name: string }>(
    projects.map((p: any) => [p.id, p])
  );

  // Query 1: Timeline Events (use statuses JSONB; legacy status column was dropped). Scope by workspace.
  const { data: timelineEvents } = await supabase
    .from('timeline_events')
    .select(`
      id,
      title,
      start_date,
      end_date,
      statuses,
      priorities,
      created_at,
      updated_at,
      timeline_block_id,
      blocks!timeline_events_timeline_block_id_fkey (
        id,
        content,
        tab_id
      )
    `)
    .eq('workspace_id', workspaceId);

  // Process timeline events
  if (timelineEvents) {
    for (const event of timelineEvents) {
      const block = Array.isArray(event.blocks) ? event.blocks[0] : event.blocks;
      if (!block || !block.tab_id) continue;

      const tab = tabById.get(block.tab_id);
      if (!tab) continue;

      const project = projectById.get(tab.project_id);
      if (!project) continue;

      const blockContent = block.content as any || {};
      const blockName = blockContent.title || 'Timeline';

      items.push({
        id: event.id,
        type: 'timeline_event' as EntityType,
        name: event.title,
        source: {
          type: 'timeline',
          id: block.id,
          name: blockName,
          tabId: tab.id,
          tabName: tab.name,
          projectId: project.id,
          projectName: project.name,
          url: `/dashboard/projects/${project.id}/tabs/${tab.id}#block-${block.id}`,
        },
        properties: {
          status: firstStatusFromNamed((event as any).statuses),
          priority: firstPriorityFromNamed((event as any).priorities),
          assignee_ids: [],
          due_date: buildDueDateRange(event.start_date, (event as any).end_date ?? null), // Range: categorization uses end date
          tags: [],
        },
        created_at: event.created_at,
        updated_at: event.updated_at,
      });
    }
  }

  // Query 2: Task Items (use statuses JSONB; legacy status column was dropped). Exclude placeholders. Scope by workspace.
  const { data: taskItems } = await supabase
    .from('task_items')
    .select(`
      id,
      title,
      statuses,
      priorities,
      due_date,
      start_date,
      created_at,
      updated_at,
      task_block_id,
      blocks!task_items_task_block_id_fkey (
        id,
        content,
        tab_id
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('is_placeholder', false);

  // Process task items
  if (taskItems) {
    for (const task of taskItems) {
      const block = Array.isArray(task.blocks) ? task.blocks[0] : task.blocks;
      if (!block || !block.tab_id) continue;

      const tab = tabById.get(block.tab_id);
      if (!tab) continue;

      const project = projectById.get(tab.project_id);
      if (!project) continue;

      const blockContent = block.content as any || {};
      const blockName = blockContent.title || 'Task List';

      items.push({
        id: task.id,
        type: 'task' as EntityType,
        name: task.title,
        source: {
          type: 'task_list',
          id: block.id,
          name: blockName,
          tabId: tab.id,
          tabName: tab.name,
          projectId: project.id,
          projectName: project.name,
          url: `/dashboard/projects/${project.id}/tabs/${tab.id}#block-${block.id}`,
        },
        properties: {
          status: firstStatusFromNamed((task as any).statuses),
          priority: firstPriorityFromNamed((task as any).priorities),
          assignee_ids: [],
          due_date: buildDueDateRange(task.start_date ?? null, task.due_date ?? null),
          tags: [],
        },
        created_at: task.created_at,
        updated_at: task.updated_at,
      });
    }
  }

  // Query 3: Table Rows. Only tables in this workspace.
  const { data: tables } = await supabase
    .from('tables')
    .select(`
      id,
      title,
      block_id,
      table_fields (
        id,
        name,
        type,
        is_primary
      )
    `)
    .eq('workspace_id', workspaceId);

  if (tables && tables.length > 0) {
    const tableIds = tables.map((t: any) => t.id);
    const tableById = new Map<string, {
      id: string;
      title: string;
      block_id: string;
      table_fields?: Array<{ id: string; name: string; type: string; is_primary: boolean }>;
    }>(tables.map((t: any) => [t.id, t]));

    const { data: tableRows } = await supabase
      .from('table_rows')
      .select('id, table_id, data, created_at, updated_at')
      .in('table_id', tableIds);
    const tableRowIds = (tableRows || []).map((row: any) => row.id);
    const tableRowPropsResult = tableRowIds.length
      ? await getEntitiesProperties("table_row", tableRowIds, workspaceId)
      : { data: {} as Record<string, EntityProperties> };
    const tableRowPropsById = "error" in tableRowPropsResult ? {} : tableRowPropsResult.data;

    // Process table rows
    if (tableRows) {
      for (const row of tableRows) {
        const table = tableById.get(row.table_id);
        if (!table || !table.block_id) continue;

        // Get block info
        const { data: blockData } = await supabase
          .from('blocks')
          .select('id, tab_id')
          .eq('id', table.block_id)
          .maybeSingle();

        if (!blockData || !blockData.tab_id) continue;

        const tab = tabById.get(blockData.tab_id);
        if (!tab) continue;

        const project = projectById.get(tab.project_id);
        if (!project) continue;

        // Find primary field
        const primaryField = table.table_fields?.find((f: any) => f.is_primary);
        const rowName = primaryField && row.data?.[primaryField.id]
          ? String(row.data[primaryField.id])
          : 'Untitled';

        const props = tableRowPropsById[row.id];

        // Only include rows that have properties
        if (props && (props.status || props.priority || props.assignee_ids?.length > 0 || props.due_date || props.tags?.length > 0)) {
          items.push({
            id: row.id,
            type: 'table_row' as EntityType,
            name: rowName,
            source: {
              type: 'table',
              id: table.id,
              name: table.title,
              tabId: tab.id,
              tabName: tab.name,
              projectId: project.id,
              projectName: project.name,
              url: `/dashboard/projects/${project.id}/tabs/${tab.id}#table-${table.id}-row-${row.id}`,
            },
            properties: {
              status: props.status as Status | null,
              priority: props.priority as Priority | null,
              assignee_ids: props.assignee_ids || [],
              due_date: normalizeDueDateRange(props.due_date ?? null),
              tags: props.tags || [],
            },
            created_at: row.created_at,
            updated_at: row.updated_at,
          });
        }
      }
    }
  }

  // Query 4: Blocks with Properties
  const { data: blocks } = await supabase
    .from('blocks')
    .select(`
      id,
      type,
      content,
      tab_id,
      created_at,
      updated_at
    `)
    .in('tab_id', tabIds);

  const blockIds = (blocks ?? []).map((block: any) => block.id);
  const blockPropsResult = blockIds.length
    ? await getEntitiesProperties("block", blockIds, workspaceId)
    : { data: {} as Record<string, any> };
  const blockPropsById = "error" in blockPropsResult ? {} : blockPropsResult.data;

  // Process blocks
  if (blocks) {
    for (const block of blocks) {
      const tab = tabById.get(block.tab_id);
      if (!tab) continue;

      const project = projectById.get(tab.project_id);
      if (!project) continue;

      const props = blockPropsById[block.id];
      const hasProps = Boolean(
        props &&
          (props.status ||
            props.priority ||
            (Array.isArray(props.assignee_ids) ? props.assignee_ids.length > 0 : props.assignee_id) ||
            props.due_date ||
            (Array.isArray(props.tags) && props.tags.length > 0))
      );
      if (!hasProps) continue;

      // Generate block name based on type and content
      let blockName = 'Block';
      const content = block.content as any || {};
      if (block.type === 'text' && content.text) {
        blockName = content.text.substring(0, 50) + (content.text.length > 50 ? '...' : '');
      } else if (block.type === 'task' && content.title) {
        blockName = content.title;
      } else {
        blockName = block.type.charAt(0).toUpperCase() + block.type.slice(1) + ' Block';
      }

      items.push({
        id: block.id,
        type: 'block' as EntityType,
        name: blockName,
        source: {
          type: 'block',
          id: block.id,
          name: blockName,
          tabId: tab.id,
          tabName: tab.name,
          projectId: project.id,
          projectName: project.name,
          url: `/dashboard/projects/${project.id}/tabs/${tab.id}#block-${block.id}`,
        },
        properties: {
          status: props?.status as Status | null,
          priority: props?.priority as Priority | null,
          assignee_ids: props?.assignee_ids || (props?.assignee_id ? [props.assignee_id] : []),
          due_date: normalizeDueDateRange(props?.due_date ?? null),
          tags: props?.tags || [],
        },
        created_at: block.created_at,
        updated_at: block.updated_at,
      });
    }
  }

  // Query 5: Subtasks with entity_properties (universal properties). Only include subtasks that have at least one property in entity_properties.
  const { data: subtaskPropRows } = await supabase
    .from('entity_properties')
    .select('entity_id')
    .eq('workspace_id', workspaceId)
    .eq('entity_type', 'subtask');
  const subtaskIdsRaw = (subtaskPropRows ?? []).map((r: { entity_id: unknown }) => r.entity_id);
  const subtaskIds: string[] = Array.from(
    new Set(
      subtaskIdsRaw.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    )
  );
  if (subtaskIds.length > 0) {
    const { data: subtasks } = await supabase
      .from('task_subtasks')
      .select('id, task_id, title, created_at, updated_at')
      .in('id', subtaskIds);
    if (subtasks && subtasks.length > 0) {
      const parentTaskIds = [...new Set(subtasks.map((s: any) => s.task_id))];
      const { data: parentTasks } = await supabase
        .from('task_items')
        .select(`
          id,
          task_block_id,
          tab_id,
          project_id,
          workspace_id,
          blocks!task_items_task_block_id_fkey ( id, content )
        `)
        .in('id', parentTaskIds)
        .eq('workspace_id', workspaceId);
      const taskById = new Map<string, any>((parentTasks ?? []).map((t: any) => [t.id, t]));
      const subtaskPropsResult = await getEntitiesProperties('subtask', subtaskIds, workspaceId);
      const subtaskPropsById = 'error' in subtaskPropsResult ? {} : subtaskPropsResult.data;
      for (const st of subtasks) {
        const task = taskById.get(st.task_id);
        if (!task || !task.tab_id) continue;
        const tab = tabById.get(task.tab_id);
        if (!tab) continue;
        const project = projectById.get(tab.project_id);
        if (!project) continue;
        const block = Array.isArray(task.blocks) ? task.blocks[0] : task.blocks;
        const blockName = (block?.content as any)?.title ?? 'Task List';
        const props = subtaskPropsById[st.id];
        const hasProps = Boolean(
          props &&
            (props.status ||
              props.priority ||
              (Array.isArray(props.assignee_ids) ? props.assignee_ids.length > 0 : props.assignee_id) ||
              props.due_date ||
              (Array.isArray(props.tags) && props.tags.length > 0))
        );
        if (!hasProps) continue;
        items.push({
          id: st.id,
          type: 'subtask' as EntityType,
          name: st.title,
          source: {
            type: 'task_list',
            id: block?.id ?? task.task_block_id,
            name: blockName,
            tabId: tab.id,
            tabName: tab.name,
            projectId: project.id,
            projectName: project.name,
            url: `/dashboard/projects/${project.id}/tabs/${tab.id}#block-${block?.id ?? task.task_block_id}`,
          },
          properties: {
            status: (props?.status as Status | null) ?? null,
            priority: (props?.priority as Priority | null) ?? null,
            assignee_ids: props?.assignee_ids ?? (props?.assignee_id ? [props.assignee_id] : []),
            due_date: normalizeDueDateRange(props?.due_date ?? null),
            tags: props?.tags ?? [],
          },
          created_at: st.created_at,
          updated_at: st.updated_at,
        });
      }
    }
  }

  const normalizedItems = await maybeFilterWorkflowTaskCopies(
    supabase,
    items,
    options?.includeWorkflowRepresentations
  );
  const enrichedItems = await hydrateEverythingProperties(normalizedItems, workspaceId);

  // Only keep items that have at least one universal property (canonical: entity_properties)
  const withAtLeastOneProp = enrichedItems.filter((item) => {
    const p = item.properties;
    return (
      p.status != null ||
      p.priority != null ||
      (p.assignee_ids?.length ?? 0) > 0 ||
      p.due_date != null ||
      (p.tags?.length ?? 0) > 0
    );
  });

  // Sort by updated_at descending
  withAtLeastOneProp.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Apply limit and offset
  const paginatedItems = withAtLeastOneProp.slice(offset, offset + limit);

  return {
    data: {
      items: paginatedItems,
      total: withAtLeastOneProp.length,
      hasMore: offset + limit < withAtLeastOneProp.length,
    },
  };
}

async function maybeFilterWorkflowTaskCopies(
  supabase: any,
  items: EverythingItem[],
  includeWorkflowRepresentations?: boolean
): Promise<EverythingItem[]> {
  if (includeWorkflowRepresentations) return items;

  const taskIds = items
    .filter((item) => item.type === "task")
    .map((item) => item.id);
  const tableRowIds = items
    .filter((item) => item.type === "table_row")
    .map((item) => item.id);
  const timelineEventIds = items
    .filter((item) => item.type === "timeline_event")
    .map((item) => item.id);

  if (taskIds.length === 0 && tableRowIds.length === 0 && timelineEventIds.length === 0) return items;

  const [taskResult, rowResult, timelineResult] = await Promise.all([
    taskIds.length > 0
      ? supabase.from("task_items").select("id, source_task_id, source_entity_id").in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    tableRowIds.length > 0
      ? supabase.from("table_rows").select("id, source_entity_id").in("id", tableRowIds)
      : Promise.resolve({ data: [], error: null }),
    timelineEventIds.length > 0
      ? supabase.from("timeline_events").select("id, source_entity_id").in("id", timelineEventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (taskResult.error || rowResult.error || timelineResult.error) {
    console.error("maybeFilterWorkflowTaskCopies error:", taskResult.error || rowResult.error || timelineResult.error);
    return items;
  }

  const copiedTaskIds = new Set(
    ((taskResult.data || []) as Array<{ id: string; source_task_id: string | null; source_entity_id: string | null }>)
      .filter((task) => Boolean(task.source_entity_id || task.source_task_id))
      .map((task) => task.id)
  );
  const copiedRowIds = new Set(
    ((rowResult.data || []) as Array<{ id: string; source_entity_id: string | null }>)
      .filter((row) => Boolean(row.source_entity_id))
      .map((row) => row.id)
  );
  const copiedTimelineEventIds = new Set(
    ((timelineResult.data || []) as Array<{ id: string; source_entity_id: string | null }>)
      .filter((ev) => Boolean(ev.source_entity_id))
      .map((ev) => ev.id)
  );

  return items.filter((item) => {
    if (item.type === "task") return !copiedTaskIds.has(item.id);
    if (item.type === "table_row") return !copiedRowIds.has(item.id);
    if (item.type === "timeline_event") return !copiedTimelineEventIds.has(item.id);
    return true;
  });
}

/**
 * Map raw database result to EverythingItem
 */
function mapRawItemToEverythingItem(raw: any): EverythingItem {
  return {
    id: raw.id,
    type: raw.entity_type as EntityType,
    name: raw.name,
    source: {
      type: raw.source_type,
      id: raw.source_id,
      name: raw.source_name,
      tabId: raw.tab_id,
      tabName: raw.tab_name,
      projectId: raw.project_id,
      projectName: raw.project_name,
      url: raw.url,
    },
    properties: {
      status: raw.status as Status | null,
      priority: firstPriorityFromNamed(raw.priorities) ?? (raw.priority as Priority | null),
      assignee_ids: raw.assignee_ids || [],
      due_date: normalizeDueDateRange(raw.due_date),
      tags: raw.tags || [],
    },
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

async function hydrateEverythingProperties(
  items: EverythingItem[],
  workspaceId: string
): Promise<EverythingItem[]> {
  if (items.length === 0) return items;

  const idsByType = new Map<EntityType, string[]>();
  for (const item of items) {
    const list = idsByType.get(item.type) ?? [];
    list.push(item.id);
    idsByType.set(item.type, list);
  }

  const entries = await Promise.all(
    Array.from(idsByType.entries()).map(async ([type, ids]) => {
      const result = await getEntitiesProperties(type, ids, workspaceId);
      if ("error" in result) {
        console.error(`hydrateEverythingProperties error (${type}):`, result.error);
        return [type, {} as Record<string, EntityProperties>] as const;
      }
      return [type, result.data] as const;
    })
  );

  const propsByType = new Map<EntityType, Record<string, EntityProperties>>(entries);

  return items.map((item) => {
    const props = propsByType.get(item.type)?.[item.id];
    if (!props) return item;

    return {
      ...item,
      properties: {
        status: props.status ?? item.properties.status ?? null,
        priority: props.priority ?? item.properties.priority ?? null,
        assignee_ids:
          Array.isArray(props.assignee_ids) && props.assignee_ids.length > 0
            ? props.assignee_ids
            : item.properties.assignee_ids ?? [],
        due_date: props.due_date ?? item.properties.due_date ?? null,
        tags:
          Array.isArray(props.tags) && props.tags.length > 0
            ? props.tags
            : item.properties.tags ?? [],
      },
    };
  });
}
