"use server";

import { createClient } from "@/lib/supabase/server";
import { getEntitiesProperties } from "@/app/actions/entity-properties";
import { buildDueDateRange, normalizeDueDateRange } from "@/lib/due-date";
import type { EverythingItem, EverythingOptions, EverythingResult } from "@/types/everything";
import type { EntityType, EntityProperties, Status, Priority } from "@/types/properties";

type ActionResult<T> = { data: T } | { error: string };

/**
 * Get all items with properties across the entire workspace
 * Aggregates timeline events, task items, table rows, and blocks with properties
 */
export async function getWorkspaceEverything(
  workspaceId: string,
  options?: EverythingOptions
): Promise<ActionResult<EverythingResult>> {
  const supabase = await createClient();
  const limit = options?.limit ?? 500;
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

  return {
    data: {
      items: enrichedItems,
      total: enrichedItems.length,
      hasMore: enrichedItems.length === limit,
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

  // Query 1: Timeline Events
  const { data: timelineEvents } = await supabase
    .from('timeline_events')
    .select(`
      id,
      title,
      start_date,
      status,
      priority,
      created_at,
      updated_at,
      timeline_block_id,
      blocks!timeline_events_timeline_block_id_fkey (
        id,
        content,
        tab_id
      )
    `);

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

      // Get assignees from entity_properties
      const { data: props } = await supabase
        .from('entity_properties')
        .select('assignee_ids, tags')
        .eq('entity_type', 'timeline_event')
        .eq('entity_id', event.id)
        .maybeSingle();

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
          status: event.status as Status,
          priority: event.priority as Priority | null,
          assignee_ids: props?.assignee_ids || [],
          due_date: buildDueDateRange(event.start_date, null), // Use start_date as due_date for timeline events
          tags: props?.tags || [],
        },
        created_at: event.created_at,
        updated_at: event.updated_at,
      });
    }
  }

  // Query 2: Task Items
  const { data: taskItems } = await supabase
    .from('task_items')
    .select(`
      id,
      title,
      status,
      priority,
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
    `);

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

      // Get assignees and tags from entity_properties
      const { data: props } = await supabase
        .from('entity_properties')
        .select('assignee_ids, tags')
        .eq('entity_type', 'task')
        .eq('entity_id', task.id)
        .maybeSingle();

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
          status: task.status as Status,
          priority: task.priority as Priority | null,
          assignee_ids: props?.assignee_ids || [],
          due_date: buildDueDateRange(task.start_date ?? null, task.due_date ?? null),
          tags: props?.tags || [],
        },
        created_at: task.created_at,
        updated_at: task.updated_at,
      });
    }
  }

  // Query 3: Table Rows
  // First get tables with their fields
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
    `);

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

        // Get properties from entity_properties
        const { data: props } = await supabase
          .from('entity_properties')
          .select('status, priority, assignee_ids, due_date, tags')
          .eq('entity_type', 'table_row')
          .eq('entity_id', row.id)
          .maybeSingle();

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
              due_date: normalizeDueDateRange(props.due_date),
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

  const normalizedItems = await maybeFilterWorkflowTaskCopies(
    supabase,
    items,
    options?.includeWorkflowRepresentations
  );
  const enrichedItems = await hydrateEverythingProperties(normalizedItems, workspaceId);

  // Sort by updated_at descending
  enrichedItems.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Apply limit and offset
  const paginatedItems = enrichedItems.slice(offset, offset + limit);

  return {
    data: {
      items: paginatedItems,
      total: enrichedItems.length,
      hasMore: offset + limit < enrichedItems.length,
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

  if (taskIds.length === 0 && tableRowIds.length === 0) return items;

  const [taskResult, rowResult] = await Promise.all([
    taskIds.length > 0
      ? supabase.from("task_items").select("id, source_task_id").in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    tableRowIds.length > 0
      ? supabase.from("table_rows").select("id, source_entity_id").in("id", tableRowIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (taskResult.error || rowResult.error) {
    console.error("maybeFilterWorkflowTaskCopies error:", taskResult.error || rowResult.error);
    return items;
  }

  const copiedTaskIds = new Set(
    ((taskResult.data || []) as Array<{ id: string; source_task_id: string | null }>)
      .filter((task) => Boolean(task.source_task_id))
      .map((task) => task.id)
  );
  const copiedRowIds = new Set(
    ((rowResult.data || []) as Array<{ id: string; source_entity_id: string | null }>)
      .filter((row) => Boolean(row.source_entity_id))
      .map((row) => row.id)
  );

  return items.filter((item) => {
    if (item.type === "task") return !copiedTaskIds.has(item.id);
    if (item.type === "table_row") return !copiedRowIds.has(item.id);
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
      priority: raw.priority as Priority | null,
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
