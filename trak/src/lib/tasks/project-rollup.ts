import type { TaskBlockContent, TaskSourceSyncMode } from "@/types/task";

export const PROJECT_TASK_ROLLUP_MODE = "all_project_tasks" as const;

export type ProjectTaskRollupConfig = {
  enabled: true;
  mode: typeof PROJECT_TASK_ROLLUP_MODE;
  syncMode: Extract<TaskSourceSyncMode, "live">;
};

export type ProjectTaskRollupBlock = {
  id: string;
  tab_id: string | null;
  workspace_id: string;
  project_id: string | null;
};

export type ProjectTaskMirrorSeedTask = {
  id: string;
  task_block_id: string;
  workspace_id: string;
  project_id: string | null;
  tab_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  due_time_end: string | null;
  start_date: string | null;
  hide_icons: boolean;
  display_order: number;
  recurring_enabled: boolean;
  recurring_frequency: "daily" | "weekly" | "monthly" | null;
  recurring_interval: number | null;
  assignee_id: string | null;
  source_task_id: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  source_sync_mode: TaskSourceSyncMode | null;
  edited?: boolean;
  priorities: unknown[];
  statuses: unknown[];
  is_placeholder?: boolean;
  assignees?: unknown[];
  due_dates?: unknown[];
  created_by?: string | null;
  updated_by?: string | null;
};

export type ProjectTaskMirrorTagLink = {
  task_id: string;
  tag_id: string;
};

export type ProjectTaskMirrorEntityProperty = {
  entity_id: string;
  entity_type: string;
  field_name: string;
  field_type: string;
  value: unknown;
  workspace_id: string;
};

export type ProjectTaskMirrorAssignee = {
  task_id: string;
  assignee_id: string | null;
  assignee_name: string | null;
};

export type ProjectTaskMirrorSeedResult = {
  taskItems: ProjectTaskMirrorSeedTask[];
  taskTagLinks: ProjectTaskMirrorTagLink[];
  entityProperties: ProjectTaskMirrorEntityProperty[];
  taskAssignees: ProjectTaskMirrorAssignee[];
};

export type ProjectTaskMirrorMetadataResult = {
  taskTagLinks: ProjectTaskMirrorTagLink[];
  entityProperties: ProjectTaskMirrorEntityProperty[];
};

function cloneJsonValue<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildProjectTaskRollupConfig(): ProjectTaskRollupConfig {
  return {
    enabled: true,
    mode: PROJECT_TASK_ROLLUP_MODE,
    syncMode: "live",
  };
}

export function isProjectTaskRollupBlockContent(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  const config = (content as { projectRollup?: Partial<ProjectTaskRollupConfig> }).projectRollup;
  return Boolean(
    config?.enabled === true &&
      config.mode === PROJECT_TASK_ROLLUP_MODE &&
      (config.syncMode ?? "live") === "live"
  );
}

export function withProjectTaskRollupContent(content: TaskBlockContent): TaskBlockContent {
  return {
    ...content,
    projectRollup: buildProjectTaskRollupConfig(),
  };
}

export function buildProjectTaskRollupMirrorSeeds(params: {
  sourceTasks: ProjectTaskMirrorSeedTask[];
  rollupBlocks: ProjectTaskRollupBlock[];
  actorUserId: string | null;
  taskTagLinks?: ProjectTaskMirrorTagLink[];
  entityProperties?: ProjectTaskMirrorEntityProperty[];
  taskAssignees?: ProjectTaskMirrorAssignee[];
}): ProjectTaskMirrorSeedResult {
  const { sourceTasks, rollupBlocks, actorUserId } = params;
  if (sourceTasks.length === 0 || rollupBlocks.length === 0) {
    return { taskItems: [], taskTagLinks: [], entityProperties: [], taskAssignees: [] };
  }

  const rollupBlockIds = new Set(rollupBlocks.map((block) => block.id));
  const canonicalTasks = sourceTasks.filter((task) => {
    if (rollupBlockIds.has(task.task_block_id)) return false;
    if (task.source_entity_type === "task" && task.source_entity_id) return false;
    return true;
  });

  if (canonicalTasks.length === 0) {
    return { taskItems: [], taskTagLinks: [], entityProperties: [], taskAssignees: [] };
  }

  const tagLinksByTaskId = new Map<string, ProjectTaskMirrorTagLink[]>();
  for (const link of params.taskTagLinks ?? []) {
    const list = tagLinksByTaskId.get(link.task_id) ?? [];
    list.push(link);
    tagLinksByTaskId.set(link.task_id, list);
  }

  const entityPropertiesByTaskId = new Map<string, ProjectTaskMirrorEntityProperty[]>();
  for (const row of params.entityProperties ?? []) {
    if (row.entity_type !== "task") continue;
    const list = entityPropertiesByTaskId.get(row.entity_id) ?? [];
    list.push(row);
    entityPropertiesByTaskId.set(row.entity_id, list);
  }

  const assigneesByTaskId = new Map<string, ProjectTaskMirrorAssignee[]>();
  for (const row of params.taskAssignees ?? []) {
    const list = assigneesByTaskId.get(row.task_id) ?? [];
    list.push(row);
    assigneesByTaskId.set(row.task_id, list);
  }

  const taskItems: ProjectTaskMirrorSeedTask[] = [];
  const taskTagLinks: ProjectTaskMirrorTagLink[] = [];
  const entityProperties: ProjectTaskMirrorEntityProperty[] = [];
  const taskAssignees: ProjectTaskMirrorAssignee[] = [];

  for (const rollupBlock of rollupBlocks) {
    let displayOrder = 0;
    for (const task of canonicalTasks) {
      const mirrorTaskId = crypto.randomUUID();
      taskItems.push({
        id: mirrorTaskId,
        task_block_id: rollupBlock.id,
        workspace_id: rollupBlock.workspace_id,
        project_id: rollupBlock.project_id,
        tab_id: rollupBlock.tab_id,
        title: task.title,
        description: task.description ?? null,
        due_date: task.due_date ?? null,
        due_time: task.due_time ?? null,
        due_time_end: task.due_time_end ?? null,
        start_date: task.start_date ?? null,
        hide_icons: task.hide_icons ?? false,
        display_order: displayOrder,
        recurring_enabled: task.recurring_enabled ?? false,
        recurring_frequency: task.recurring_frequency ?? null,
        recurring_interval: task.recurring_interval ?? 1,
        assignee_id: task.assignee_id ?? null,
        source_task_id: task.id,
        source_entity_type: "task",
        source_entity_id: task.id,
        source_sync_mode: "live",
        edited: false,
        priorities: cloneJsonValue(task.priorities ?? []),
        statuses: cloneJsonValue(task.statuses ?? []),
        is_placeholder: false,
        assignees: cloneJsonValue(task.assignees ?? []),
        due_dates: cloneJsonValue(task.due_dates ?? []),
        created_by: actorUserId,
        updated_by: actorUserId,
      });

      for (const link of tagLinksByTaskId.get(task.id) ?? []) {
        taskTagLinks.push({
          task_id: mirrorTaskId,
          tag_id: link.tag_id,
        });
      }

      for (const row of entityPropertiesByTaskId.get(task.id) ?? []) {
        entityProperties.push({
          entity_id: mirrorTaskId,
          entity_type: "task",
          field_name: row.field_name,
          field_type: row.field_type,
          value: cloneJsonValue(row.value),
          workspace_id: rollupBlock.workspace_id,
        });
      }

      for (const row of assigneesByTaskId.get(task.id) ?? []) {
        taskAssignees.push({
          task_id: mirrorTaskId,
          assignee_id: row.assignee_id ?? null,
          assignee_name: row.assignee_name ?? null,
        });
      }

      displayOrder += 1;
    }
  }

  return {
    taskItems,
    taskTagLinks,
    entityProperties,
    taskAssignees,
  };
}

export function buildProjectTaskRollupMirrorMetadata(params: {
  mirrorTasks: ProjectTaskMirrorSeedTask[];
  taskTagLinks?: ProjectTaskMirrorTagLink[];
  entityProperties?: ProjectTaskMirrorEntityProperty[];
}): ProjectTaskMirrorMetadataResult {
  const tagLinksByTaskId = new Map<string, ProjectTaskMirrorTagLink[]>();
  for (const link of params.taskTagLinks ?? []) {
    const list = tagLinksByTaskId.get(link.task_id) ?? [];
    list.push(link);
    tagLinksByTaskId.set(link.task_id, list);
  }

  const entityPropertiesByTaskId = new Map<string, ProjectTaskMirrorEntityProperty[]>();
  for (const row of params.entityProperties ?? []) {
    if (row.entity_type !== "task") continue;
    const list = entityPropertiesByTaskId.get(row.entity_id) ?? [];
    list.push(row);
    entityPropertiesByTaskId.set(row.entity_id, list);
  }

  const taskTagLinks: ProjectTaskMirrorTagLink[] = [];
  const entityProperties: ProjectTaskMirrorEntityProperty[] = [];

  for (const mirrorTask of params.mirrorTasks) {
    const sourceTaskId = mirrorTask.source_entity_type === "task" ? mirrorTask.source_entity_id : null;
    if (!sourceTaskId) continue;

    for (const link of tagLinksByTaskId.get(sourceTaskId) ?? []) {
      taskTagLinks.push({
        task_id: mirrorTask.id,
        tag_id: link.tag_id,
      });
    }

    for (const row of entityPropertiesByTaskId.get(sourceTaskId) ?? []) {
      entityProperties.push({
        entity_id: mirrorTask.id,
        entity_type: "task",
        field_name: row.field_name,
        field_type: row.field_type,
        value: cloneJsonValue(row.value),
        workspace_id: mirrorTask.workspace_id,
      });
    }
  }

  return {
    taskTagLinks,
    entityProperties,
  };
}
