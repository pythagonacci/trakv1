import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseDateSafe } from "@/lib/due-date";
import {
  getCanonicalConfigForUniversalPropertyType,
  normalizeCanonicalPriorityValue,
  normalizeCanonicalStatusValue,
} from "@/lib/tables/universal-property";
import { createServiceClient } from "@/lib/supabase/service";
import {
  parseProjectTemplateMarkdown,
  type ParsedTemplateTab,
  type ParsedTemplateSpec,
} from "@/lib/project-templates/markdown-parser";

type TemplateVisibility = "global" | "workspace";
type TemplatePlan = "free" | "standard" | "business";

export interface SeedProjectTemplateFromMarkdownInput {
  filePath: string;
  sourceWorkspaceId: string;
  slug?: string;
  templateName?: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  visibility?: TemplateVisibility;
  minPlan?: TemplatePlan;
  sortOrder?: number;
  isActive?: boolean;
  actorUserId?: string | null;
  replaceExisting?: boolean;
}

type TimelineSeedConfig = {
  defaultLaunchOffsetDays: number;
  rangeStartOffsetDays: number;
  rangeEndOffsetDays: number;
  eventOffsets: Record<string, { startOffsetDays: number; endOffsetDays: number }>;
};

type TableFieldSeedType =
  | "text"
  | "date"
  | "checkbox"
  | "person"
  | "status"
  | "priority";

type SeededAssignee = {
  assigneeId: string | null;
  assigneeName: string | null;
};

type SeededMediaPlaceholder = {
  title: string | null;
  description: string | null;
};

const TEMPLATE_TIMELINE_EVENT_COLORS = [
  "bg-blue-500/50",
  "bg-indigo-500/50",
  "bg-purple-500/50",
  "bg-pink-500/50",
  "bg-rose-500/50",
  "bg-orange-500/50",
  "bg-amber-500/50",
  "bg-lime-500/50",
  "bg-green-500/50",
  "bg-emerald-500/50",
  "bg-teal-500/50",
  "bg-cyan-500/50",
] as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanTemplateName(value: string) {
  return value
    .replace(/^Trak\s+[—-]\s+/i, "")
    .replace(/\s+Template$/i, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fieldNameToId(columnName: string) {
  return slugify(columnName) || crypto.randomUUID();
}

function parsePriority(value: string | undefined) {
  return normalizeCanonicalPriorityValue(value);
}

function viewModeFromBlock(view: string | null): { viewMode: "list" | "board"; boardGroupBy?: "status" } {
  const normalized = (view ?? "").toLowerCase();
  if (normalized.includes("board")) {
    return { viewMode: "board", boardGroupBy: "status" };
  }
  return { viewMode: "list" };
}

function normalizeFieldKey(value: string) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanSeedString(value: string | undefined | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === "—" || trimmed === "-") return null;
  return trimmed;
}

function isBracketPlaceholder(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return /^\[[^\]]+\]$/.test(trimmed);
}

function normalizeAssigneeSeed(value: string | undefined | null): SeededAssignee | null {
  const cleaned = cleanSeedString(value);
  if (!cleaned || isBracketPlaceholder(cleaned)) return null;
  if (isUuid(cleaned)) {
    return { assigneeId: cleaned, assigneeName: null };
  }
  return { assigneeId: null, assigneeName: cleaned };
}

function normalizeDateSeed(value: string | undefined | null) {
  const cleaned = cleanSeedString(value);
  if (!cleaned || isBracketPlaceholder(cleaned)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const parsed = parseDateSafe(cleaned);
  if (!parsed) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeCheckboxSeed(value: string | undefined | null) {
  const cleaned = cleanSeedString(value);
  if (!cleaned || isBracketPlaceholder(cleaned)) return null;
  const normalized = cleaned.toLowerCase();
  if (["☑", "☒", "✓"].includes(cleaned)) return true;
  if (["☐"].includes(cleaned)) return false;
  if (["true", "yes", "1", "checked", "x"].includes(normalized)) return true;
  if (["false", "no", "0", "unchecked"].includes(normalized)) return false;
  return null;
}

function stripInlineFormatting(value: string) {
  return value
    .replace(/^\*+|\*+$/g, "")
    .replace(/^"+|"+$/g, "")
    .trim();
}

function parseMediaPlaceholder(placeholder: string | null, fallbackTitle: string): SeededMediaPlaceholder {
  const raw = cleanSeedString(placeholder);
  if (!raw) {
    return { title: fallbackTitle, description: null };
  }

  const labelMatch = raw.match(/label:\s*\*?"?([^"]+?)"?\*?\s*$/i);
  const labelText = labelMatch ? stripInlineFormatting(labelMatch[1] ?? "") : null;
  const placeholderWithoutLabel = labelMatch?.index !== undefined
    ? raw.slice(0, labelMatch.index).replace(/[—-]\s*$/u, "").trim()
    : raw;
  const cleanedPrompt = placeholderWithoutLabel
    .replace(/^empty\s+(?:image|file|video|gallery)(?:\s+(?:slot|block))?\s*[—-]\s*/i, "")
    .replace(/^prompt user to\s+/i, "")
    .trim();

  if (labelText) {
    const labelParts = labelText
      .split(/\s+[—-]\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      title: labelParts[0] ?? fallbackTitle,
      description: labelParts.slice(1).join(" - ") || cleanedPrompt || null,
    };
  }

  return {
    title: fallbackTitle,
    description: cleanedPrompt || null,
  };
}

export function inferTemplateTableFieldType(columnName: string, rows: Array<Record<string, string>>): TableFieldSeedType {
  const normalized = normalizeFieldKey(columnName);
  if (normalized.includes("owner") || normalized.includes("assignee") || normalized.includes("assigned")) return "person";
  if (normalized.includes("status")) return "status";
  if (normalized.includes("priority")) return "priority";
  if (normalized.includes("date") || normalized.includes("due")) return "date";

  const nonEmptyValues = rows
    .map((row) => cleanSeedString(row[columnName]))
    .filter((value): value is string => Boolean(value));
  const concreteValues = nonEmptyValues.filter((value) => !isBracketPlaceholder(value));
  if (
    concreteValues.length > 0 &&
    concreteValues.every((value) => normalizeCheckboxSeed(value) !== null)
  ) {
    return "checkbox";
  }

  return "text";
}

function buildTableFieldConfig(type: TableFieldSeedType) {
  if (type === "status" || type === "priority") {
    return getCanonicalConfigForUniversalPropertyType(type);
  }
  if (type === "date") {
    return { includeTime: false, format: "MMM d, yyyy" };
  }
  return {};
}

export function normalizeTemplateTableCellValue(fieldType: TableFieldSeedType, rawValue: string | undefined) {
  switch (fieldType) {
    case "priority":
      return normalizeCanonicalPriorityValue(rawValue);
    case "status":
      return normalizeCanonicalStatusValue(rawValue);
    case "date":
      return normalizeDateSeed(rawValue);
    case "person": {
      const cleaned = cleanSeedString(rawValue);
      return cleaned ? cleaned : null;
    }
    case "checkbox":
      return normalizeCheckboxSeed(rawValue);
    default: {
      const cleaned = cleanSeedString(rawValue);
      return cleaned ? cleaned : null;
    }
  }
}

export function buildTemplateTabBlockLayout(tab: ParsedTemplateTab) {
  const layout = new Map<number, { position: number; column: number }>();
  let rowPosition = 0;

  for (let blockIndex = 0; blockIndex < tab.blocks.length; blockIndex += 1) {
    const block = tab.blocks[blockIndex];
    const nextBlock = tab.blocks[blockIndex + 1];
    const thirdBlock = tab.blocks[blockIndex + 2];
    const fourthBlock = tab.blocks[blockIndex + 3];
    const canBuildSectionPair =
      block.kind === "section_header" &&
      nextBlock?.layout === "left" &&
      nextBlock.kind !== "table" &&
      thirdBlock?.kind === "section_header" &&
      fourthBlock?.layout === "right" &&
      fourthBlock.kind !== "table";
    const canPairWithNext =
      block.layout === "left" &&
      block.kind !== "table" &&
      nextBlock?.layout === "right" &&
      nextBlock.kind !== "table";

    if (canBuildSectionPair) {
      layout.set(blockIndex, { position: rowPosition, column: 0 });
      layout.set(blockIndex + 2, { position: rowPosition, column: 1 });
      layout.set(blockIndex + 1, { position: rowPosition + 1, column: 0 });
      layout.set(blockIndex + 3, { position: rowPosition + 1, column: 1 });
      rowPosition += 2;
      blockIndex += 3;
      continue;
    }

    if (canPairWithNext) {
      layout.set(blockIndex, { position: rowPosition, column: 0 });
      layout.set(blockIndex + 1, { position: rowPosition, column: 1 });
      rowPosition += 1;
      blockIndex += 1;
      continue;
    }

    layout.set(blockIndex, { position: rowPosition, column: 0 });
    rowPosition += 1;
  }

  return layout;
}

function getTimelineEventTitle(row: Record<string, string>) {
  const explicitTitle =
    cleanSeedString(row["Event Name"]) ??
    cleanSeedString(row.Milestone) ??
    cleanSeedString(row.Event) ??
    cleanSeedString(row.Title);
  if (explicitTitle) return explicitTitle;

  const fallbackKey = Object.keys(row).find((key) => {
    const normalized = normalizeFieldKey(key);
    return normalized !== "date" && normalized !== "notes";
  });
  return cleanSeedString(fallbackKey ? row[fallbackKey] : null) ?? "Untitled event";
}

function buildTimelineSeedConfig(eventNames: string[]) {
  const anchorIndex = Math.max(
    0,
    eventNames.findIndex((name) => name.toLowerCase().includes("launch day"))
  );
  const eventOffsets: TimelineSeedConfig["eventOffsets"] = {};
  const stepDays = 3;
  const offsets = eventNames.map((_, index) => (index - anchorIndex) * stepDays);
  eventNames.forEach((name, index) => {
    const startOffsetDays = offsets[index] ?? 0;
    const endOffsetDays = startOffsetDays + (name.toLowerCase().includes("launch day") ? 1 : 2);
    eventOffsets[name] = {
      startOffsetDays,
      endOffsetDays,
    };
  });

  const minOffset = Math.min(...offsets, 0);
  const maxOffset = Math.max(...offsets.map((offset) => offset + 2), 0);
  return {
    defaultLaunchOffsetDays: 30,
    rangeStartOffsetDays: minOffset,
    rangeEndOffsetDays: maxOffset,
    eventOffsets,
  };
}

function getTimelineEventColor(index: number) {
  return TEMPLATE_TIMELINE_EVENT_COLORS[index % TEMPLATE_TIMELINE_EVENT_COLORS.length] ?? "bg-blue-500/50";
}

function buildNoonUtcIso(baseDate: Date, offsetDays: number) {
  const utc = new Date(Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate() + offsetDays,
    12,
    0,
    0,
    0
  ));
  return utc.toISOString();
}

function buildInitialTimelineContent(title: string, seedConfig: TimelineSeedConfig) {
  const anchorDate = new Date(Date.UTC(2026, 0, 1, 12, 0, 0, 0));
  return {
    title,
    viewConfig: {
      startDate: buildNoonUtcIso(anchorDate, seedConfig.rangeStartOffsetDays),
      endDate: buildNoonUtcIso(anchorDate, seedConfig.rangeEndOffsetDays),
      zoomLevel: "week",
      groupBy: "none",
      filters: {},
    },
    templateTimelineSeed: seedConfig,
  };
}

function buildChartRowsForTasks(
  tasks: Array<{
    id: string;
    title: string;
    priority: string | null;
    status: "todo" | "in_progress" | "blocked" | "done";
  }>
) {
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority ?? "none",
  }));
}

async function resolveActorUserId(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  workspaceId: string,
  preferredUserId?: string | null
): Promise<string | null> {
  if (preferredUserId) return preferredUserId;

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspaceError && workspace?.owner_id) {
    return String(workspace.owner_id);
  }

  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .order("role", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError || !member?.user_id) {
    return null;
  }

  return String(member.user_id);
}

async function seedSourceProject(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  workspaceId: string,
  actorUserId: string | null,
  spec: ParsedTemplateSpec
) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      name: spec.projectName,
      status: spec.defaultStatus,
      project_type: "project",
      priority: null,
      tags: spec.suggestedTags,
      client_page_enabled: false,
      client_comments_enabled: false,
      client_editing_enabled: false,
      public_token: null,
      folder_id: null,
      internal_group_id: null,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message || "Failed to create source project");
  }

  const projectId = String(project.id);
  const taskRowsForChart: Array<{
    id: string;
    title: string;
    priority: string | null;
    status: "todo" | "in_progress" | "blocked" | "done";
  }> = [];

  const tabsPayload: Array<Record<string, unknown>> = [];
  const blocksPayload: Array<Record<string, unknown>> = [];
  const taskItemsPayload: Array<Record<string, unknown>> = [];
  const taskAssigneesPayload: Array<Record<string, unknown>> = [];
  const timelineEventsPayload: Array<Record<string, unknown>> = [];
  const tablesPayload: Array<Record<string, unknown>> = [];
  const tableFieldsPayload: Array<Record<string, unknown>> = [];
  const tableRowsPayload: Array<Record<string, unknown>> = [];
  const tableViewsPayload: Array<Record<string, unknown>> = [];
  const entityPropertiesPayload: Array<Record<string, unknown>> = [];
  const tabIdsByName = new Map<string, string>();
  const topLevelPositions = new Map<string, number>();
  const childPositions = new Map<string, number>();

  spec.tabs.forEach((tab) => {
    const tabId = crypto.randomUUID();
    tabIdsByName.set(tab.name, tabId);
    const parentTabId = tab.parentName ? tabIdsByName.get(tab.parentName) ?? null : null;
    if (tab.parentName && !parentTabId) {
      throw new Error(`Subtab "${tab.name}" references missing parent tab "${tab.parentName}"`);
    }

    const positionKey = parentTabId ?? "__root__";
    const nextPosition = (parentTabId ? childPositions : topLevelPositions).get(positionKey) ?? 0;
    (parentTabId ? childPositions : topLevelPositions).set(positionKey, nextPosition + 1);
    const blockLayout = buildTemplateTabBlockLayout(tab);
    tabsPayload.push({
      id: tabId,
      project_id: projectId,
      parent_tab_id: parentTabId,
      name: tab.name,
      position: nextPosition,
      is_client_visible: false,
      client_title: null,
      is_workflow_page: false,
      workflow_metadata: {},
    });

    let currentSectionTitle = tab.name;

    tab.blocks.forEach((block, blockIndex) => {
      const blockId = crypto.randomUUID();
      let content: Record<string, unknown> = {};

      if (block.kind === "section_header") {
        currentSectionTitle = block.title;
        content = { title: block.title, subtitle: block.subtitle };
      }

      if (block.kind === "shopify_product") {
        content = {
          product_id: null,
          templatePlaceholder: block.placeholder,
        };
      }

      if (block.kind === "text") {
        content = { text: block.content };
      }

      if (block.kind === "task") {
        const view = viewModeFromBlock(block.view);
        content = {
          title: currentSectionTitle,
          hideIcons: false,
          viewMode: view.viewMode,
          ...(view.boardGroupBy ? { boardGroupBy: view.boardGroupBy } : {}),
        };

        block.tasks.forEach((row, taskIndex) => {
          const taskId = crypto.randomUUID();
          const priority = parsePriority(row.Priority);
          const seededAssignee = normalizeAssigneeSeed(row.Owner);
          const dueDate = normalizeDateSeed(row.Due);
          const taskStatuses = [{ field_name: "Status", value: "todo" }];
          const taskPriorities = priority ? [{ field_name: "Priority", value: priority }] : [];
          const taskDueDates = dueDate ? [{ field_name: "Due Date", value: { start: dueDate, end: dueDate } }] : [];
          const primaryAssigneeId = seededAssignee?.assigneeId ?? null;
          const taskAssigneeIds = primaryAssigneeId ? [{ field_name: "Assignee", value: [primaryAssigneeId] }] : [];

          taskItemsPayload.push({
            id: taskId,
            task_block_id: blockId,
            workspace_id: workspaceId,
            project_id: projectId,
            tab_id: tabId,
            title: row.Task ?? "Untitled task",
            description: null,
            due_date: dueDate,
            due_time: null,
            start_date: null,
            hide_icons: false,
            display_order: taskIndex,
            recurring_enabled: false,
            recurring_frequency: null,
            recurring_interval: 1,
            created_by: actorUserId,
            updated_by: actorUserId,
            assignee_id: primaryAssigneeId,
            due_time_end: null,
            source_task_id: null,
            source_sync_mode: null,
            source_entity_type: null,
            source_entity_id: null,
            edited: false,
            priorities: taskPriorities,
            statuses: taskStatuses,
            is_placeholder: false,
            assignees: taskAssigneeIds,
            due_dates: taskDueDates,
          });

          entityPropertiesPayload.push({
            entity_type: "task",
            entity_id: taskId,
            workspace_id: workspaceId,
            field_name: "Status",
            field_type: "status",
            value: "todo",
          });

          if (priority) {
            entityPropertiesPayload.push({
              entity_type: "task",
              entity_id: taskId,
              workspace_id: workspaceId,
              field_name: "Priority",
              field_type: "priority",
              value: priority,
            });
          }

          if (seededAssignee) {
            taskAssigneesPayload.push({
              task_id: taskId,
              assignee_id: seededAssignee.assigneeId,
              assignee_name: seededAssignee.assigneeName ?? seededAssignee.assigneeId,
            });
            entityPropertiesPayload.push({
              entity_type: "task",
              entity_id: taskId,
              workspace_id: workspaceId,
              field_name: "Assignee",
              field_type: "assignee",
              value: [{
                id: seededAssignee.assigneeId,
                name: seededAssignee.assigneeName ?? seededAssignee.assigneeId,
              }],
            });
          }

          if (dueDate) {
            entityPropertiesPayload.push({
              entity_type: "task",
              entity_id: taskId,
              workspace_id: workspaceId,
              field_name: "Due Date",
              field_type: "due_date",
              value: { start: dueDate, end: dueDate },
            });
          }

          taskRowsForChart.push({
            id: taskId,
            title: row.Task ?? "Untitled task",
            priority,
            status: "todo",
          });
        });
      }

      if (block.kind === "timeline") {
        const eventNames = block.events.map((row) => getTimelineEventTitle(row));
        const seedConfig = buildTimelineSeedConfig(eventNames);
        content = buildInitialTimelineContent(currentSectionTitle, seedConfig);

        const anchorDate = new Date(Date.UTC(2026, 0, 1, 12, 0, 0, 0));
        block.events.forEach((row, eventIndex) => {
          const eventName = getTimelineEventTitle(row);
          const offsets = seedConfig.eventOffsets[eventName] ?? { startOffsetDays: 0, endOffsetDays: 0 };
          timelineEventsPayload.push({
            id: crypto.randomUUID(),
            timeline_block_id: blockId,
            workspace_id: workspaceId,
            title: eventName,
            start_date: buildNoonUtcIso(anchorDate, offsets.startOffsetDays),
            end_date: buildNoonUtcIso(anchorDate, offsets.endOffsetDays),
            assignee_id: null,
            progress: 0,
            notes: cleanSeedString(row.Notes) ?? null,
            color: getTimelineEventColor(eventIndex),
            is_milestone: false,
            baseline_start: null,
            baseline_end: null,
            display_order: eventIndex,
            created_by: actorUserId,
            updated_by: actorUserId,
            source_entity_type: null,
            source_entity_id: null,
            source_sync_mode: null,
            edited: false,
            priorities: [],
            statuses: [],
            assignee_team_id: null,
            parent_event_id: null,
            assignees: [],
            tags: [],
          });
        });
      }

      if (block.kind === "table") {
        const tableId = crypto.randomUUID();
        content = { tableId };

        tablesPayload.push({
          id: tableId,
          workspace_id: workspaceId,
          project_id: projectId,
          tab_id: tabId,
          title: currentSectionTitle,
          description: null,
          icon: null,
          created_by: actorUserId,
        });

        const fieldIds = block.columns.map(() => crypto.randomUUID());
        const fieldNamesById = new Map<string, string>();
        const fieldTypes = new Map<string, TableFieldSeedType>();
        block.columns.forEach((column, columnIndex) => {
          const fieldId = fieldIds[columnIndex] ?? crypto.randomUUID();
          const fieldType = inferTemplateTableFieldType(column, block.rows);
          fieldNamesById.set(column, fieldId);
          fieldTypes.set(column, fieldType);
          tableFieldsPayload.push({
            id: fieldId,
            table_id: tableId,
            name: column,
            type: fieldType,
            config: buildTableFieldConfig(fieldType),
            order: columnIndex + 1,
            is_primary: columnIndex === 0,
            width: null,
          });
        });

        block.rows.forEach((row, rowIndex) => {
          const data = Object.fromEntries(
            block.columns.map((column) => [
              fieldNamesById.get(column) ?? fieldNameToId(column),
              normalizeTemplateTableCellValue(fieldTypes.get(column) ?? "text", row[column]),
            ])
          );
          tableRowsPayload.push({
            id: crypto.randomUUID(),
            table_id: tableId,
            data,
            order: rowIndex + 1,
            created_by: actorUserId,
            updated_by: actorUserId,
            source_entity_type: null,
            source_entity_id: null,
            source_sync_mode: null,
            edited: false,
          });
        });

        tableViewsPayload.push({
          table_id: tableId,
          name: "Default view",
          type: "table",
          config: {},
          is_default: true,
          created_by: actorUserId,
        });
      }

      if (block.kind === "gallery") {
        const mediaPlaceholder = parseMediaPlaceholder(block.placeholder, currentSectionTitle);
        content = {
          title: mediaPlaceholder.title,
          description: mediaPlaceholder.description,
          layout: "array",
          arrayColumns: 2,
          arrayRows: 2,
          items: [],
          templatePlaceholder: block.placeholder,
        };
      }

      if (block.kind === "image") {
        const mediaPlaceholder = parseMediaPlaceholder(block.placeholder, currentSectionTitle);
        content = {
          title: mediaPlaceholder.title,
          description: mediaPlaceholder.description,
          fileId: null,
          caption: "",
          width: 400,
          templatePlaceholder: block.placeholder,
        };
      }

      if (block.kind === "file" || block.kind === "video") {
        const mediaPlaceholder = parseMediaPlaceholder(block.placeholder, currentSectionTitle);
        content = {
          title: mediaPlaceholder.title,
          description: mediaPlaceholder.description,
          files: [],
          templatePlaceholder: block.placeholder,
        };
      }

      if (block.kind === "chart") {
        content = {
          spec: {
            version: 1,
            chartType: "doughnut",
            breakdown: {
              field: "status",
              fieldLabel: "Task Status",
            },
            normalizeTo: "focus",
            title: currentSectionTitle,
          },
          rows: buildChartRowsForTasks(taskRowsForChart),
          chartType: "doughnut",
          title: currentSectionTitle,
          metadata: {
            dataNotes: block.purpose ?? undefined,
          },
          dataSource: {
            mode: "refreshable",
            scope: "query",
            query: {
              type: "tasks",
              params: {
                projectId,
                limit: 500,
              },
            },
          },
        };
      }

      const layout = blockLayout.get(blockIndex) ?? { position: blockIndex, column: 0 };
      blocksPayload.push({
        id: blockId,
        tab_id: tabId,
        parent_block_id: null,
        type: block.kind,
        content,
        position: layout.position,
        column: layout.column,
        is_template: false,
        template_name: null,
        original_block_id: null,
        locked: false,
      });
    });
  });

  const tabsInsert = await supabase.from("tabs").insert(tabsPayload);
  if (tabsInsert.error) {
    throw new Error(`Failed to insert template tabs: ${tabsInsert.error.message}`);
  }

  const blocksInsert = await supabase.from("blocks").insert(blocksPayload);
  if (blocksInsert.error) {
    throw new Error(`Failed to insert template blocks: ${blocksInsert.error.message}`);
  }

  if (tablesPayload.length > 0) {
    const { error } = await supabase.from("tables").insert(tablesPayload);
    if (error) throw new Error(`Failed to insert template tables: ${error.message}`);
  }

  if (tableFieldsPayload.length > 0) {
    const { error } = await supabase.from("table_fields").insert(tableFieldsPayload);
    if (error) throw new Error(`Failed to insert template table fields: ${error.message}`);
  }

  if (tableRowsPayload.length > 0) {
    const { error } = await supabase.from("table_rows").insert(tableRowsPayload);
    if (error) throw new Error(`Failed to insert template table rows: ${error.message}`);
  }

  if (tableViewsPayload.length > 0) {
    const { error } = await supabase.from("table_views").insert(tableViewsPayload);
    if (error) throw new Error(`Failed to insert template table views: ${error.message}`);
  }

  if (taskItemsPayload.length > 0) {
    const { error } = await supabase.from("task_items").insert(taskItemsPayload);
    if (error) throw new Error(`Failed to insert template tasks: ${error.message}`);
  }

  if (taskAssigneesPayload.length > 0) {
    const { error } = await supabase.from("task_assignees").insert(taskAssigneesPayload);
    if (error) throw new Error(`Failed to insert template task assignees: ${error.message}`);
  }

  if (timelineEventsPayload.length > 0) {
    const { error } = await supabase.from("timeline_events").insert(timelineEventsPayload);
    if (error) throw new Error(`Failed to insert template timeline events: ${error.message}`);
  }

  if (entityPropertiesPayload.length > 0) {
    const { error } = await supabase.from("entity_properties").insert(entityPropertiesPayload);
    if (error) throw new Error(`Failed to insert template entity properties: ${error.message}`);
  }

  return { projectId };
}

export async function seedProjectTemplateFromMarkdownFile(input: SeedProjectTemplateFromMarkdownInput) {
  const markdownPath = path.resolve(input.filePath);
  const markdown = await readFile(markdownPath, "utf8");
  const spec = parseProjectTemplateMarkdown(markdown);
  const visibility = input.visibility ?? "global";
  const templateName =
    input.templateName ??
    (cleanTemplateName(spec.documentTitle ?? spec.projectName) || "Template");
  const slug = input.slug ?? slugify(templateName);

  if (!slug) {
    throw new Error("Template slug could not be resolved");
  }

  const supabase = await createServiceClient();
  const actorUserId = await resolveActorUserId(supabase, input.sourceWorkspaceId, input.actorUserId);

  const { data: existingTemplate } = await supabase
    .from("project_templates")
    .select("id, source_project_id")
    .eq("slug", slug)
    .maybeSingle();

  let newProjectId: string | null = null;

  try {
    const seeded = await seedSourceProject(supabase, input.sourceWorkspaceId, actorUserId, spec);
    newProjectId = seeded.projectId;

    const payload = {
      workspace_id: visibility === "workspace" ? input.sourceWorkspaceId : null,
      source_project_id: newProjectId,
      slug,
      name: templateName,
      description: input.description ?? null,
      category: input.category ?? null,
      icon: input.icon ?? null,
      visibility,
      min_plan: input.minPlan ?? "standard",
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    };

    if (existingTemplate?.id) {
      const { error: updateError } = await supabase
        .from("project_templates")
        .update(payload)
        .eq("id", existingTemplate.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (input.replaceExisting !== false && existingTemplate.source_project_id && existingTemplate.source_project_id !== newProjectId) {
        await supabase.from("projects").delete().eq("id", existingTemplate.source_project_id);
      }

      return {
        templateId: existingTemplate.id,
        sourceProjectId: newProjectId,
        action: "updated" as const,
        parsedSpec: spec,
      };
    }

    const { data: createdTemplate, error: createError } = await supabase
      .from("project_templates")
      .insert(payload)
      .select("id")
      .single();

    if (createError || !createdTemplate) {
      throw new Error(createError?.message || "Failed to create template registry row");
    }

    return {
      templateId: String(createdTemplate.id),
      sourceProjectId: newProjectId,
      action: "created" as const,
      parsedSpec: spec,
    };
  } catch (error) {
    if (newProjectId) {
      await supabase.from("projects").delete().eq("id", newProjectId);
    }
    throw error;
  }
}
