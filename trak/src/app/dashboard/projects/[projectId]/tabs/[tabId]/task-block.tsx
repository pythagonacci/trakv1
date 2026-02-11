"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  X,
  ChevronDown,
  MoreVertical,
  Flag,
  Users,
  Calendar,
  Tag,
  AlignLeft,
  CheckSquare,
  Paperclip,
  ChevronRight,
  Eye,
  EyeOff,
  Settings,
  Columns3,
  List,
  Table,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildDueDateRange, formatDueDateRange, getDueDateEnd, hasDueDate } from "@/lib/due-date";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import {
  useTaskItems,
  useCreateTaskItem,
  useUpdateTaskItem,
  useDeleteTaskItem,
  useReorderTaskItems,
  useSetTaskSyncModeForBlock,
  useTaskSubtasks,
  useTaskComments,
  useTaskReferences,
  useCreateTaskReference,
  useDeleteTaskReference,
  useSubtaskReferences,
  useCreateSubtaskReference,
  useDeleteSubtaskReference,
} from "@/lib/hooks/use-task-queries";
import ReferencePicker from "@/components/timelines/reference-picker";
import { getLinkableItemHref } from "@/lib/references/navigation";
import DOMPurify from "isomorphic-dompurify";
import { PropertyBadges, PropertyMenu } from "@/components/properties";
import {
  useEntitiesProperties,
  useEntityPropertiesWithInheritance,
  useSetEntityPropertiesForType,
  useWorkspaceMembers,
} from "@/lib/hooks/use-property-queries";
import { PRIORITY_COLORS, PRIORITY_OPTIONS, STATUS_OPTIONS, type EntityProperties, type EntityType, type Status } from "@/types/properties";
import type { TaskBlockContent } from "@/types/task";
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { addDays, endOfWeek, isBefore, isSameDay, startOfWeek } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface Subtask {
  id: string | number;
  text: string;
  description?: string | null;
  completed: boolean;
}

interface Task {
  id: string | number;
  text: string;
  status: "todo" | "in-progress" | "done" | "blocked";
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  sourceTaskId?: string | null;
  sourceSyncMode?: "snapshot" | "live";
  assignees?: string[];
  dueDate?: string | null;
  dueTime?: string | null;
  startDate?: string | null;
  tags?: string[];
  description?: string | null;
  subtasks?: Subtask[];
  attachments?: { id: string | number; name: string; url: string; type: string }[];
  comments?: { id: string | number; author: string; text: string; timestamp: string }[];
  recurring?: {
    enabled: boolean;
    frequency?: "daily" | "weekly" | "monthly" | null;
    interval?: number | null;
  };
  hideIcons?: boolean;
}

type TaskViewMode = NonNullable<TaskBlockContent["viewMode"]>;
type BoardGroupBy = NonNullable<TaskBlockContent["boardGroupBy"]>;

interface BoardColumn {
  id: string;
  label: string;
  taskIds: string[];
  groupBy: BoardGroupBy;
  value: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  dueBucket?: "overdue" | "today" | "this_week" | "later" | "no_date";
}

  // Separate component for task description to prevent state loss on re-renders
// Uses uncontrolled textarea to avoid React state interference
function TaskDescription({ 
  task, 
  updateTask 
}: { 
  task: Task; 
  updateTask: (taskId: string | number, updates: Partial<Task>) => Promise<void>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTaskIdRef = useRef(task.id);

  // Only reset when switching to a completely different task
  useEffect(() => {
    if (lastTaskIdRef.current !== task.id && textareaRef.current) {
      lastTaskIdRef.current = task.id;
      textareaRef.current.value = task.description ?? "";
    }
  }, [task.id]); // Only depend on task.id, not description

  const handleBlur = async () => {
    const finalValue = textareaRef.current?.value ?? "";
    if (finalValue !== (task.description ?? "")) {
      await updateTask(task.id, { description: finalValue ? finalValue : null });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (textareaRef.current) {
        textareaRef.current.value = task.description ?? "";
      }
      textareaRef.current?.blur();
    }
  };

  // Read current value from textarea for delete button visibility
  const [showDelete, setShowDelete] = useState(!!task.description);
  
  useEffect(() => {
    // Update showDelete when task.description changes externally
    if (!textareaRef.current || document.activeElement !== textareaRef.current) {
      setShowDelete(!!task.description);
    }
  }, [task.description]);

  return (
    <div 
      className="mt-1 relative group/desc" 
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        key={`desc-${task.id}`}
        ref={textareaRef}
        defaultValue={task.description ?? ""}
        onChange={() => {
          // Update delete button visibility as user types
          if (textareaRef.current) {
            setShowDelete(textareaRef.current.value.length > 0);
          }
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        placeholder="Add description..."
        className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none resize-none pr-6"
        rows={1}
        autoComplete="off"
        data-form-type="other"
      />
      {showDelete && (
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            e.preventDefault();
            await updateTask(task.id, { description: null });
            if (textareaRef.current) {
              textareaRef.current.value = "";
            }
            setShowDelete(false);
          }}
          className="absolute top-0.5 right-0.5 opacity-0 group-hover/desc:opacity-100 text-[var(--tertiary-foreground)] hover:text-red-500 transition-opacity z-10"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

function SubtaskDescription({
  subtask,
  updateSubtask,
}: {
  subtask: Subtask;
  updateSubtask: (subtaskId: string | number, updates: Partial<Subtask>) => Promise<void>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSubtaskIdRef = useRef(subtask.id);

  useEffect(() => {
    if (lastSubtaskIdRef.current !== subtask.id && textareaRef.current) {
      lastSubtaskIdRef.current = subtask.id;
      textareaRef.current.value = subtask.description ?? "";
    }
  }, [subtask.id]);

  const handleBlur = async () => {
    const finalValue = textareaRef.current?.value ?? "";
    if (finalValue !== (subtask.description ?? "")) {
      await updateSubtask(subtask.id, { description: finalValue ? finalValue : null });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (textareaRef.current) {
        textareaRef.current.value = subtask.description ?? "";
      }
      textareaRef.current?.blur();
    }
  };

  const [showDelete, setShowDelete] = useState(!!subtask.description);

  useEffect(() => {
    if (!textareaRef.current || document.activeElement !== textareaRef.current) {
      setShowDelete(!!subtask.description);
    }
  }, [subtask.description]);

  return (
    <div
      className="mt-1 relative group/subtask-desc"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        key={`subtask-desc-${subtask.id}`}
        ref={textareaRef}
        defaultValue={subtask.description ?? ""}
        onChange={() => {
          if (textareaRef.current) {
            setShowDelete(textareaRef.current.value.length > 0);
          }
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        placeholder="Add description..."
        className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none resize-none pr-6"
        rows={1}
        autoComplete="off"
        data-form-type="other"
      />
      {showDelete && (
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            e.preventDefault();
            await updateSubtask(subtask.id, { description: null });
            if (textareaRef.current) {
              textareaRef.current.value = "";
            }
            setShowDelete(false);
          }}
          className="absolute top-0.5 right-0.5 opacity-0 group-hover/subtask-desc:opacity-100 text-[var(--tertiary-foreground)] hover:text-red-500 transition-opacity z-10"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatTaskText = (text: string) => {
  const html = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const safeLabel = escapeHtml(label);
    const safeUrl = escapeHtml(url);
    return `<a href="${safeUrl}" title="${safeLabel}" data-ref-link="true" class="text-[var(--primary)] underline underline-offset-2 hover:opacity-80">${safeLabel}</a>`;
  });

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["a", "span"],
    ALLOWED_ATTR: ["href", "title", "data-ref-link", "class"],
    KEEP_CONTENT: true,
  });
};

function getInputCaretRect(input: HTMLInputElement) {
  const { selectionStart = 0 } = input;
  const caretIndex = selectionStart ?? 0;
  const rect = input.getBoundingClientRect();
  const style = window.getComputedStyle(input);

  const mirror = document.createElement("div");
  mirror.style.position = "fixed";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre";
  mirror.style.top = `${rect.top}px`;
  mirror.style.left = `${rect.left}px`;
  mirror.style.font = style.font;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.width = `${rect.width}px`;
  mirror.style.height = `${rect.height}px`;
  mirror.style.overflow = "hidden";

  const textBefore = input.value.slice(0, caretIndex);
  const span = document.createElement("span");
  span.textContent = textBefore || ".";
  mirror.appendChild(span);
  document.body.appendChild(mirror);

  const spanRect = span.getBoundingClientRect();
  document.body.removeChild(mirror);
  const caretRect = new DOMRect(spanRect.right, rect.top, 1, rect.height);
  if (
    !Number.isFinite(caretRect.top) ||
    !Number.isFinite(caretRect.left) ||
    (caretRect.top === 0 && caretRect.left === 0 && caretRect.width === 0 && caretRect.height === 0)
  ) {
    return null;
  }
  return caretRect;
}

function TaskPropertyBadges({
  entityId,
  onOpen,
  workspaceId,
  entityType = "task",
}: {
  entityId: string;
  onOpen: () => void;
  workspaceId: string;
  entityType?: EntityType;
}) {
  const { data: propertiesResult } = useEntityPropertiesWithInheritance(entityType, entityId);
  const { data: members = [] } = useWorkspaceMembers(workspaceId);

  const direct = propertiesResult?.direct;
  const inherited = propertiesResult?.inherited?.filter((inh) => inh.visible) ?? [];

  const getMemberName = (assigneeId: string | null) => {
    if (!assigneeId) return undefined;
    const member = members.find((m) => m.id === assigneeId || m.user_id === assigneeId);
    return member?.name || member?.email;
  };
  const getMemberNames = (props: { assignee_id?: string | null; assignee_ids?: string[] }) => {
    const ids = props.assignee_ids?.length ? props.assignee_ids : props.assignee_id ? [props.assignee_id] : [];
    return ids.map((id) => getMemberName(id)).filter((n): n is string => Boolean(n));
  };

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {direct && (
        <PropertyBadges
          properties={direct}
          onClick={onOpen}
          memberNames={getMemberNames(direct)}
        />
      )}
      {inherited.map((inh) => (
        <PropertyBadges
          key={`inherited-${inh.source_entity_id}`}
          properties={inh.properties}
          inherited
          onClick={onOpen}
          memberNames={getMemberNames(inh.properties)}
        />
      ))}
    </div>
  );
}

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

function BoardColumnContainer({
  columnId,
  children,
}: {
  columnId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${columnId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-[120px] flex-col gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)]/60 p-2.5 transition-colors",
        isOver && "border-[var(--foreground)]/40 bg-[var(--surface)]"
      )}
    >
      {children}
    </div>
  );
}

function BoardTaskCard({
  taskId,
  columnId,
  statusIcon,
  title,
  onToggleStatus,
  showStatusIcon,
  showPriority,
  showAssignee,
  showDueDate,
  showTags,
  priorityBadge,
  assigneeBadge,
  dueDateBadge,
  tagsBadges,
  menu,
}: {
  taskId: string;
  columnId: string;
  statusIcon: React.ReactNode;
  title: React.ReactNode;
  onToggleStatus: () => void;
  showStatusIcon: boolean;
  showPriority: boolean;
  showAssignee: boolean;
  showDueDate: boolean;
  showTags: boolean;
  priorityBadge: React.ReactNode;
  assigneeBadge: React.ReactNode;
  dueDateBadge: React.ReactNode;
  tagsBadges: React.ReactNode;
  menu: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task-${taskId}`,
    data: { columnId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs transition-shadow",
        "hover:border-[var(--secondary)]/30 hover:shadow-sm",
        isDragging && "opacity-60"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        {showStatusIcon && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onToggleStatus();
            }}
            className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:border-[var(--secondary)]"
            aria-label="Toggle task"
          >
            {statusIcon}
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {title}
          {(showPriority || showAssignee || showDueDate || showTags) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
              {showPriority && priorityBadge}
              {showAssignee && assigneeBadge}
              {showDueDate && dueDateBadge}
              {showTags && tagsBadges}
            </div>
          )}
        </div>
        {menu}
      </div>
    </div>
  );
}

interface TaskBlockProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
  workspaceId: string;
  projectId?: string;
  scrollToTaskId?: string | null;
}

export default function TaskBlock({ block, onUpdate, workspaceId, projectId, scrollToTaskId }: TaskBlockProps) {
  const content = (block.content || {}) as TaskBlockContent & { tasks?: Task[] };
  const title = content.title || "Task list";
  const isTempBlock = block.id.startsWith("temp-");
  const { data: serverTasks = [] } = useTaskItems(block.id, { enabled: !isTempBlock });
  const tasks = isTempBlock ? (content.tasks || []) : (serverTasks as Task[]);
  const initialGlobalHideIcons = content.hideIcons || false;
  const initialViewMode = content.viewMode || "list";
  const initialBoardGroupBy = content.boardGroupBy || "status";

  const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);
  const workspaceMemberLookup = useMemo(() => {
    const map = new Map<string, (typeof workspaceMembers)[number]>();
    workspaceMembers.forEach((member) => {
      map.set(member.id, member);
      if (member.user_id) {
        map.set(member.user_id, member);
      }
    });
    return map;
  }, [workspaceMembers]);
  const getWorkspaceMember = (assigneeId?: string | null) =>
    assigneeId ? workspaceMemberLookup.get(assigneeId) : undefined;
  const normalizeAssigneeId = (assigneeId?: string | null) => {
    const member = getWorkspaceMember(assigneeId);
    return member?.user_id ?? assigneeId ?? null;
  };

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [globalHideIcons, setGlobalHideIcons] = useState(initialGlobalHideIcons);
  const [viewMode, setViewMode] = useState<TaskViewMode>(initialViewMode);
  const [boardGroupBy, setBoardGroupBy] = useState<BoardGroupBy>(initialBoardGroupBy);
  const [editingTaskId, setEditingTaskId] = useState<string | number | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string | number, { description?: boolean; subtasks?: boolean; comments?: boolean; references?: boolean }>>({});
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, { description?: boolean; references?: boolean }>>({});
  const [newComment, setNewComment] = useState<Record<string | number, string>>({});
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});
  const [referenceTaskId, setReferenceTaskId] = useState<string | null>(null);
  const [referenceSubtaskId, setReferenceSubtaskId] = useState<string | null>(null);
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
  const [referenceInitialQuery, setReferenceInitialQuery] = useState("");
  const [referenceCurrentQuery, setReferenceCurrentQuery] = useState("");
  const [inlineReference, setInlineReference] = useState<{ taskId: string; cursor: number } | null>(null);
  const [referenceAnchorRect, setReferenceAnchorRect] = useState<DOMRect | null>(null);
  const editingTaskInputRef = useRef<HTMLInputElement | null>(null);
  const [propertiesTarget, setPropertiesTarget] = useState<{ type: EntityType; id: string; title: string } | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [propertyOverrides, setPropertyOverrides] = useState<Record<string, Partial<EntityProperties>>>({});
  const [subtaskPropertyOverrides, setSubtaskPropertyOverrides] = useState<Record<string, Partial<EntityProperties>>>({});

  const createTaskMutation = useCreateTaskItem(block.id);
  const updateTaskMutation = useUpdateTaskItem(block.id);
  const deleteTaskMutation = useDeleteTaskItem(block.id);
  const reorderTaskMutation = useReorderTaskItems(block.id);
  const setTaskSyncModeMutation = useSetTaskSyncModeForBlock(block.id);
  const subtaskMutations = useTaskSubtasks(block.id);
  const commentMutations = useTaskComments(block.id);
  const createReferenceMutation = useCreateTaskReference(referenceTaskId || undefined);
  const createSubtaskReferenceMutation = useCreateSubtaskReference(referenceSubtaskId || undefined);
  
  // Universal properties for tasks (status/priority/assignee/due/tags)
  const taskIds = tasks.map((t) => String(t.id));
  const { data: taskPropertiesById = {} } = useEntitiesProperties("task", taskIds, workspaceId);
  const setTaskProperties = useSetEntityPropertiesForType("task", workspaceId);
  const subtaskIds = useMemo(
    () =>
      tasks.flatMap((task) =>
        (task.subtasks || []).map((subtask) => String(subtask.id))
      ),
    [tasks]
  );
  const { data: subtaskPropertiesById = {} } = useEntitiesProperties("subtask", subtaskIds, workspaceId);
  const setSubtaskProperties = useSetEntityPropertiesForType("subtask", workspaceId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const orderedTasks = useMemo(() => {
    if (taskOrder.length === 0) return tasks;
    const taskMap = new Map(tasks.map((task) => [String(task.id), task]));
    return taskOrder.map((id) => taskMap.get(id)).filter(Boolean) as Task[];
  }, [tasks, taskOrder]);

  const copiedTasks = useMemo(
    () => orderedTasks.filter((task) => Boolean(task.sourceTaskId)),
    [orderedTasks]
  );
  const hasSourceLinkedCopies = copiedTasks.length > 0;
  const liveSyncEnabled = hasSourceLinkedCopies && copiedTasks.every((task) => task.sourceSyncMode === "live");

  const taskMapById = useMemo(() => {
    return new Map(orderedTasks.map((task) => [String(task.id), task]));
  }, [orderedTasks]);

  const propertiesTargetTask = useMemo(() => {
    if (!propertiesTarget || propertiesTarget.type !== "task") return undefined;
    return tasks.find((task) => String(task.id) === propertiesTarget.id);
  }, [propertiesTarget, tasks]);

  const statusFromLegacy = (status?: Task["status"]): Status => {
    if (status === "in-progress") return "in_progress";
    if (status === "blocked") return "blocked";
    return (status || "todo") as Status;
  };

  const legacyFromStatus = (status?: Status): Task["status"] => {
    if (status === "in_progress") return "in-progress";
    return (status || "todo") as Task["status"];
  };

  const getEffectiveProperties = (taskId: string, task: Task) => {
    const override = propertyOverrides[taskId];
    const base = taskPropertiesById[taskId];
    if (!base && !override) return null;
    return { ...(base || {}), ...(override || {}) } as EntityProperties;
  };

  const getSubtaskEffectiveProperties = (subtaskId: string) => {
    const override = subtaskPropertyOverrides[subtaskId];
    const base = subtaskPropertiesById[subtaskId];
    if (!base && !override) return null;
    return { ...(base || {}), ...(override || {}) } as EntityProperties;
  };

  const getSubtaskEffectiveStatus = (subtaskId: string, subtask: Subtask) => {
    const props = getSubtaskEffectiveProperties(subtaskId);
    return props?.status || (subtask.completed ? "done" : "todo");
  };

  const getSubtaskEffectiveAssigneeIds = (subtaskId: string) => {
    const props = getSubtaskEffectiveProperties(subtaskId);
    if (props?.assignee_ids?.length) return props.assignee_ids;
    if (props?.assignee_id) return [props.assignee_id];
    return [];
  };

  const getDerivedStatusFromSubtasks = (task: Task) => {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    const statuses = task.subtasks.map((subtask) =>
      getSubtaskEffectiveStatus(String(subtask.id), subtask)
    );
    const allDone = statuses.every((status) => status === "done");
    const allTodo = statuses.every((status) => status === "todo");
    const anyInProgress = statuses.some((status) => status === "in_progress");
    const anyBlocked = statuses.some((status) => status === "blocked");
    if (allDone) return "done";
    if (anyInProgress) return "in_progress";
    if (anyBlocked) return "blocked";
    if (allTodo) return "todo";
    return "in_progress";
  };

  const getDerivedAssigneeIdsFromSubtasks = (task: Task) => {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    const ids = new Set<string>();
    task.subtasks.forEach((subtask) => {
      const subtaskIds = getSubtaskEffectiveAssigneeIds(String(subtask.id));
      subtaskIds.forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  };

  const getEffectiveStatus = (taskId: string, task: Task) => {
    if (task.subtasks && task.subtasks.length > 0) {
      return getDerivedStatusFromSubtasks(task) || "todo";
    }
    const props = getEffectiveProperties(taskId, task);
    return props?.status || statusFromLegacy(task.status);
  };

  const getEffectivePriority = (taskId: string, task: Task) => {
    const props = getEffectiveProperties(taskId, task);
    const raw = props?.priority ?? task.priority ?? "none";
    return raw === "none" ? null : raw;
  };

  const getEffectiveAssigneeIds = (taskId: string, task: Task): string[] => {
    if (task.subtasks && task.subtasks.length > 0) {
      return getDerivedAssigneeIdsFromSubtasks(task) ?? [];
    }
    const props = getEffectiveProperties(taskId, task);
    if (props?.assignee_ids?.length) return props.assignee_ids;
    if (props?.assignee_id) return [props.assignee_id];
    return [];
  };

  const getEffectiveAssigneeId = (taskId: string, task: Task) => {
    const ids = getEffectiveAssigneeIds(taskId, task);
    return ids[0] ?? null;
  };

  const getEffectiveDueDate = (taskId: string, task: Task) => {
    const props = getEffectiveProperties(taskId, task);
    if (props?.due_date) return props.due_date;
    return buildDueDateRange(task.startDate ?? null, task.dueDate ?? null);
  };

  const getEffectiveTags = (taskId: string, task: Task) => {
    const props = getEffectiveProperties(taskId, task);
    if (props?.tags) return props.tags;
    return task.tags ?? [];
  };

  const normalizePriority = (value?: string | null) => {
    if (!value || value === "none") return null;
    return value as EntityProperties["priority"];
  };
  
  // Stay in sync if title changes externally
  useEffect(() => {
    setTitleValue(title);
  }, [title]);

  // Stay in sync if hideIcons changes externally
  useEffect(() => {
    setGlobalHideIcons(content.hideIcons || false);
  }, [content.hideIcons]);

  // Stay in sync if view mode changes externally
  useEffect(() => {
    setViewMode(content.viewMode || "list");
  }, [content.viewMode]);

  // Stay in sync if board grouping changes externally
  useEffect(() => {
    setBoardGroupBy(content.boardGroupBy || "status");
  }, [content.boardGroupBy]);

  // Keep a stable task order for drag + drop
  useEffect(() => {
    const ids = tasks.map((task) => String(task.id));
    const sameSet = ids.length === taskOrder.length && ids.every((id) => taskOrder.includes(id));
    if (!sameSet) {
      setTaskOrder(ids);
    }
  }, [tasks, taskOrder]);

  // Scroll to task when scrollToTaskId matches
  // Task ID format from dashboard: `${block.id}-${task.id}`
  useEffect(() => {
    if (scrollToTaskId && block.id) {
      // Check if scrollToTaskId starts with this block's ID
      if (scrollToTaskId.startsWith(`${block.id}-`)) {
        // Extract task ID (everything after block.id-)
        const taskIdFromUrl = scrollToTaskId.substring(`${block.id}-`.length);
        
        // Check if this block contains the task we're looking for
        const taskExists = tasks.some(t => String(t.id) === taskIdFromUrl);
        
        if (taskExists) {
          // Small delay to ensure DOM is ready
          const timer = setTimeout(() => {
            const taskElement = document.getElementById(`task-${taskIdFromUrl}`);
            if (taskElement) {
              taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Very subtle highlight - just a light background fade
              taskElement.style.transition = 'background-color 0.3s ease';
              taskElement.style.backgroundColor = 'var(--surface-hover)';
              setTimeout(() => {
                taskElement.style.backgroundColor = '';
                setTimeout(() => {
                  taskElement.style.transition = '';
                }, 300);
              }, 1500);
            }
          }, 100);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [scrollToTaskId, tasks, block.id]);

  const toggleTask = async (taskId: string | number) => {
    // For temp blocks (unsaved), just toggle local task status for UI.
    if (isTempBlock) {
      const newTasks = tasks.map((task) => {
        if (task.id !== taskId) return task;
        return { ...task, status: task.status === "done" ? "todo" : "done" } as Task;
      });
      onUpdate?.({
        ...block,
        content: { ...content, tasks: newTasks },
        updated_at: new Date().toISOString(),
      });
      return;
    }

    const taskIdStr = String(taskId);
    const task = tasks.find((t) => String(t.id) === taskIdStr);
    if (task?.subtasks && task.subtasks.length > 0) {
      return;
    }
    const currentStatus = task ? getEffectiveStatus(taskIdStr, task) : "todo";

    const nextStatus = currentStatus === "done" ? "todo" : "done";

    // Update universal properties (source of truth)
    await setTaskProperties.mutateAsync({
      entityId: taskIdStr,
      updates: { status: nextStatus as any },
    });

    // Keep legacy task_items.status in sync for now (prevents other parts of the app from drifting)
    await updateTaskMutation.mutateAsync({
      taskId: taskIdStr,
      updates: { status: nextStatus === "done" ? "done" : "todo" },
    });
  };

  // Task status/priority/assignee/due/tags are managed via universal properties (PropertyMenu).

  const addTask = async () => {
    const newTask: Task = {
      id: Date.now(),
      text: "New task",
      status: "todo",
    };
    const newTasks = [...tasks, newTask];
    const updatedContent = { ...content, tasks: newTasks };

    // Optimistically update UI
    if (isTempBlock) {
      onUpdate?.({
        ...block,
        content: updatedContent,
        updated_at: new Date().toISOString(),
      });
    }

    // Skip database update if block has temporary ID (not yet saved)
    if (isTempBlock) {
      return;
    }

    const result = await createTaskMutation.mutateAsync({
      taskBlockId: block.id,
      title: "New task",
      status: "todo",
    });
    if ("error" in result) {
      console.error("Failed to add task:", result.error);
    }
  };

  const addTaskForColumn = async (column: BoardColumn) => {
    const baseTitle = "New task";
    const statusValue = column.groupBy === "status" && column.value ? (column.value as Status) : "todo";
    const priorityValue = column.groupBy === "priority" && column.value ? (column.value as Task["priority"]) : "none";
    const dueDateValue =
      column.groupBy === "dueDate" ? resolveDueDateFromBucket(column.dueBucket) : null;
    const tagsValue = column.groupBy === "tags" && column.value ? [column.value] : [];
    const assigneeName =
      column.groupBy === "assignee" ? column.assigneeName : undefined;

    if (isTempBlock) {
      const newTask: Task = {
        id: Date.now(),
        text: baseTitle,
        status: legacyFromStatus(statusValue),
        priority: priorityValue,
        dueDate: dueDateValue,
        tags: tagsValue,
        assignees: assigneeName ? [assigneeName] : [],
      };
      const updatedTasks = [...tasks, newTask];
      const updatedContent = { ...content, tasks: updatedTasks } as TaskBlockContent & { tasks?: Task[] };
      onUpdate?.({
        ...block,
        content: updatedContent,
        updated_at: new Date().toISOString(),
      });
      setTaskOrder((prev) => [...prev, String(newTask.id)]);
      return;
    }

    const legacyStatus =
      statusValue === "in_progress" ? "in-progress" : statusValue === "blocked" ? "todo" : statusValue;

    const result = await createTaskMutation.mutateAsync({
      taskBlockId: block.id,
      title: baseTitle,
      status: legacyStatus,
      priority: priorityValue,
      dueDate: dueDateValue,
    });

    if ("error" in result) {
      console.error("Failed to add task:", result.error);
      return;
    }

    if (result.data?.id) {
      const newTaskId = result.data.id;
      setTaskOrder((prev) => (prev.includes(newTaskId) ? prev : [...prev, newTaskId]));
      const updates: Partial<EntityProperties> = {};

      if (column.groupBy === "status" && column.value) updates.status = statusValue;
      if (column.groupBy === "priority") updates.priority = normalizePriority(priorityValue);
      if (column.groupBy === "assignee") updates.assignee_ids = column.assigneeId ? [column.assigneeId] : [];
      if (column.groupBy === "dueDate") updates.due_date = buildDueDateRange(null, dueDateValue);
      if (column.groupBy === "tags") updates.tags = tagsValue;

      if (Object.keys(updates).length > 0) {
        await setTaskProperties.mutateAsync({
          entityId: newTaskId,
          updates,
        });
      }
    }
  };

  const deleteTask = async (taskId: string | number) => {
    const newTasks = tasks.filter((task) => task.id !== taskId);
    const updatedContent = { ...content, tasks: newTasks };

    // Optimistic update
    if (isTempBlock) {
      onUpdate?.({
        ...block,
        content: updatedContent,
        updated_at: new Date().toISOString(),
      });
    }

    // Skip database update if block has temporary ID (not yet saved)
    if (isTempBlock) {
      return;
    }

    const result = await deleteTaskMutation.mutateAsync(String(taskId));
    if ("error" in result) {
      console.error("Failed to delete task:", result.error);
    }
  };

  const updateTask = async (taskId: string | number, updates: Partial<Task>) => {
    const newTasks = tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
    const updatedContent = { ...content, tasks: newTasks };

    // Optimistic update
    if (isTempBlock) {
      onUpdate?.({
        ...block,
        content: updatedContent,
        updated_at: new Date().toISOString(),
      });
    }

    // Skip database update if block has temporary ID (not yet saved)
    if (isTempBlock) {
      return;
    }

    const payload: Record<string, any> = {};
    if (updates.text !== undefined) payload.title = updates.text;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.startDate !== undefined) payload.startDate = updates.startDate;
    if (updates.hideIcons !== undefined) payload.hideIcons = updates.hideIcons;
    if (updates.recurring !== undefined) {
      payload.recurringEnabled = updates.recurring.enabled;
      payload.recurringFrequency = updates.recurring.frequency ?? null;
      payload.recurringInterval = updates.recurring.interval ?? null;
    }

    const result = await updateTaskMutation.mutateAsync({
      taskId: String(taskId),
      updates: payload,
    });
    if ("error" in result) {
      console.error("Failed to update task:", result.error);
    }
  };

  const toggleSubtask = async (taskId: string | number, subtaskId: string | number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    if (isTempBlock) {
      const newSubtasks = task.subtasks.map(st =>
        st.id === subtaskId ? { ...st, completed: !st.completed } : st
      );
      await updateTask(taskId, { subtasks: newSubtasks });
      return;
    }

    const subtask = task.subtasks.find((st) => st.id === subtaskId);
    if (!subtask) return;
    const currentStatus = getSubtaskEffectiveStatus(String(subtaskId), subtask);
    const nextStatus = currentStatus === "done" ? "todo" : "done";
    applySubtaskPropertyOverride(String(subtaskId), { status: nextStatus });
    await setSubtaskProperties.mutateAsync({
      entityId: String(subtaskId),
      updates: { status: nextStatus },
    });
  };

  const addSubtask = async (taskId: string | number) => {
    const task = tasks.find(t => t.id === taskId);
    const newSubtask = {
      id: Date.now(),
      text: "New subtask",
      completed: false,
    };
    const newSubtasks = [...(task?.subtasks || []), newSubtask];
    setExpandedSections((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), subtasks: true },
    }));
    if (isTempBlock) {
      await updateTask(taskId, { subtasks: newSubtasks });
      return;
    }
    await subtaskMutations.create.mutateAsync({
      taskId: String(taskId),
      title: "New subtask",
      completed: false,
      displayOrder: (task?.subtasks?.length || 0),
    });
  };

  const updateSubtask = async (
    taskId: string | number,
    subtaskId: string | number,
    updates: Partial<Subtask>
  ) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    if (isTempBlock) {
      const newSubtasks = task.subtasks.map(st =>
        st.id === subtaskId ? { ...st, ...updates } : st
      );
      await updateTask(taskId, { subtasks: newSubtasks });
      return;
    }
    const payload: Record<string, any> = {};
    if (updates.text !== undefined) payload.title = updates.text;
    if (updates.description !== undefined) payload.description = updates.description;
    await subtaskMutations.update.mutateAsync({
      subtaskId: String(subtaskId),
      updates: payload,
    });
  };

  const commitSubtaskDraft = async (taskId: string | number, subtaskId: string | number, draftValue: string | undefined, originalText: string) => {
    if (draftValue === undefined) return;
    setSubtaskDrafts((prev) => {
      const next = { ...prev };
      delete next[String(subtaskId)];
      return next;
    });
    if (draftValue !== originalText) {
      await updateSubtask(taskId, subtaskId, { text: draftValue });
    }
  };

  const deleteSubtask = async (taskId: string | number, subtaskId: string | number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    if (isTempBlock) {
      const newSubtasks = task.subtasks.filter(st => st.id !== subtaskId);
      await updateTask(taskId, { subtasks: newSubtasks });
      return;
    }
    await subtaskMutations.remove.mutateAsync(String(subtaskId));
  };

  const addComment = async (taskId: string | number) => {
    const commentText = newComment[taskId]?.trim();
    if (!commentText) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (isTempBlock) {
      const comment = {
        id: Date.now(),
        author: "Current User", // TODO: Get from auth context
        text: commentText,
        timestamp: new Date().toISOString(),
      };
      const newComments = [...(task?.comments || []), comment];
      await updateTask(taskId, { comments: newComments });
      setNewComment(prev => ({ ...prev, [taskId]: "" }));
      return;
    }

    const result = await commentMutations.create.mutateAsync({
      taskId: String(taskId),
      text: commentText,
    });
    if ("error" in result) {
      console.error("Failed to add comment:", result.error);
      return;
    }
    setNewComment(prev => ({ ...prev, [taskId]: "" }));
  };

  const toggleGlobalIcons = async () => {
    const newHideIcons = !globalHideIcons;
    setGlobalHideIcons(newHideIcons);
    const updatedContent = { ...content, hideIcons: newHideIcons };
    
    // Optimistic update
    onUpdate?.({
      ...block,
      content: updatedContent,
      updated_at: new Date().toISOString(),
    });

    // Skip database update if block has temporary ID (not yet saved)
    if (block.id.startsWith("temp-")) {
      return;
    }

    const result = await updateBlock({ blockId: block.id, content: updatedContent });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to toggle global icons:", result.error);
      // Revert on error
      setGlobalHideIcons(!newHideIcons);
    }
  };

  const toggleTaskIcons = async (taskId: string | number) => {
    const task = tasks.find(t => t.id === taskId);
    const newHideIcons = !task?.hideIcons;
    await updateTask(taskId, { hideIcons: newHideIcons });
  };

  const persistBlockContent = async (nextContent: TaskBlockContent & { tasks?: Task[] }) => {
    onUpdate?.({
      ...block,
      content: nextContent,
      updated_at: new Date().toISOString(),
    });

    if (isTempBlock) {
      return;
    }

    const result = await updateBlock({ blockId: block.id, content: nextContent });
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to update task block:", result.error);
    }
  };

  const handleViewModeChange = async (nextView: TaskViewMode) => {
    setViewMode(nextView);
    const updatedContent = { ...content, viewMode: nextView } as TaskBlockContent & { tasks?: Task[] };
    await persistBlockContent(updatedContent);
    if (!isTempBlock) {
      // If server update fails, keep local state (same pattern as title edits)
      setViewMode(updatedContent.viewMode || "list");
    }
  };

  const handleBoardGroupByChange = async (nextGroupBy: BoardGroupBy) => {
    setBoardGroupBy(nextGroupBy);
    const updatedContent = { ...content, boardGroupBy: nextGroupBy } as TaskBlockContent & { tasks?: Task[] };
    await persistBlockContent(updatedContent);
    if (!isTempBlock) {
      setBoardGroupBy(updatedContent.boardGroupBy || "status");
    }
  };

  const applyPropertyOverride = (taskId: string, updates: Partial<EntityProperties>) => {
    setPropertyOverrides((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), ...updates },
    }));
  };

  const applySubtaskPropertyOverride = (subtaskId: string, updates: Partial<EntityProperties>) => {
    setSubtaskPropertyOverrides((prev) => ({
      ...prev,
      [subtaskId]: { ...(prev[subtaskId] || {}), ...updates },
    }));
  };

  const updateSubtaskStatus = async (subtaskId: string, nextStatus: Status) => {
    if (isTempBlock) return;
    applySubtaskPropertyOverride(subtaskId, { status: nextStatus });
    await setSubtaskProperties.mutateAsync({
      entityId: subtaskId,
      updates: { status: nextStatus },
    });
  };

  const updateSubtaskPriority = async (subtaskId: string, nextPriority: string | null) => {
    if (isTempBlock) return;
    const normalized = normalizePriority(nextPriority);
    applySubtaskPropertyOverride(subtaskId, { priority: normalized });
    await setSubtaskProperties.mutateAsync({
      entityId: subtaskId,
      updates: { priority: normalized },
    });
  };

  const updateSubtaskAssignees = async (subtaskId: string, assigneeIds: string[]) => {
    if (isTempBlock) return;
    applySubtaskPropertyOverride(subtaskId, { assignee_ids: assigneeIds });
    await setSubtaskProperties.mutateAsync({
      entityId: subtaskId,
      updates: { assignee_ids: assigneeIds.length ? assigneeIds : null },
    });
  };

  const updateTaskStatus = async (taskId: string, nextStatus: Status) => {
    const task = taskMapById.get(taskId);
    if (task?.subtasks && task.subtasks.length > 0) {
      return;
    }
    const legacyStatus = nextStatus === "in_progress" ? "in-progress" : nextStatus === "blocked" ? "todo" : nextStatus;
    applyPropertyOverride(taskId, { status: nextStatus });

    await setTaskProperties.mutateAsync({
      entityId: taskId,
      updates: { status: nextStatus },
    });

    await updateTaskMutation.mutateAsync({
      taskId,
      updates: { status: legacyStatus },
    });
  };

  const updateTaskPriority = async (taskId: string, nextPriority: string | null) => {
    const normalized = normalizePriority(nextPriority);
    applyPropertyOverride(taskId, { priority: normalized });
    await setTaskProperties.mutateAsync({
      entityId: taskId,
      updates: { priority: normalized },
    });
  };

  const updateTaskAssignees = async (taskId: string, assigneeIds: string[]) => {
    const task = taskMapById.get(taskId);
    if (task?.subtasks && task.subtasks.length > 0) {
      return;
    }
    applyPropertyOverride(taskId, { assignee_ids: assigneeIds });
    await setTaskProperties.mutateAsync({
      entityId: taskId,
      updates: { assignee_ids: assigneeIds },
    });
  };

  const updateTaskDueDate = async (
    taskId: string,
    dueDate: EntityProperties["due_date"]
  ) => {
    applyPropertyOverride(taskId, { due_date: dueDate });
    await setTaskProperties.mutateAsync({
      entityId: taskId,
      updates: { due_date: dueDate },
    });
  };

  const updateTaskTags = async (taskId: string, tags: string[]) => {
    applyPropertyOverride(taskId, { tags });
    await setTaskProperties.mutateAsync({
      entityId: taskId,
      updates: { tags },
    });
  };

  const resolveDueDateFromBucket = (bucket: BoardColumn["dueBucket"]) => {
    const today = new Date();
    const todayString = today.toISOString().slice(0, 10);
    if (!bucket || bucket === "no_date") return null;
    if (bucket === "today") return todayString;
    if (bucket === "overdue") return addDays(today, -1).toISOString().slice(0, 10);
    if (bucket === "this_week") return endOfWeek(today).toISOString().slice(0, 10);
    return addDays(endOfWeek(today), 7).toISOString().slice(0, 10);
  };

  const applyBoardGroupUpdate = async (taskId: string, column: BoardColumn) => {
    const task = taskMapById.get(taskId);
    if (!task) return;
    const hasDerivedProps = task.subtasks && task.subtasks.length > 0;

    if (isTempBlock) {
      if (column.groupBy === "status" && column.value && !hasDerivedProps) {
        await updateTask(taskId, { status: legacyFromStatus(column.value as Status) });
      }
      if (column.groupBy === "priority") {
        await updateTask(taskId, { priority: (column.value || "none") as Task["priority"] });
      }
      if (column.groupBy === "assignee" && !hasDerivedProps) {
        const nextAssignees = column.assigneeName ? [column.assigneeName] : [];
        await updateTask(taskId, { assignees: nextAssignees });
      }
      if (column.groupBy === "dueDate") {
        await updateTask(taskId, { dueDate: resolveDueDateFromBucket(column.dueBucket) });
      }
      if (column.groupBy === "tags") {
        const nextTags = column.value ? [column.value] : [];
        await updateTask(taskId, { tags: nextTags });
      }
      return;
    }

    try {
      if (column.groupBy === "status" && column.value) {
        if (hasDerivedProps) return;
        await updateTaskStatus(taskId, column.value as Status);
      } else if (column.groupBy === "priority") {
        await updateTaskPriority(taskId, column.value);
      } else if (column.groupBy === "assignee") {
        if (hasDerivedProps) return;
        const currentIds = getEffectiveAssigneeIds(taskId, task);
        const newId = column.assigneeId ?? null;
        const nextIds = newId
          ? (currentIds.includes(newId) ? currentIds : [...currentIds, newId])
          : [];
        await updateTaskAssignees(taskId, nextIds);
      } else if (column.groupBy === "dueDate") {
        const nextEnd = resolveDueDateFromBucket(column.dueBucket);
        const currentRange = getEffectiveDueDate(taskId, task);
        await updateTaskDueDate(taskId, buildDueDateRange(currentRange?.start ?? null, nextEnd));
      } else if (column.groupBy === "tags") {
        await updateTaskTags(taskId, column.value ? [column.value] : []);
      }
    } catch (error) {
      console.error("Failed to update task from board drag:", error);
    }
  };

  const getDueBucket = (
    dueDate?: EntityProperties["due_date"] | null
  ): BoardColumn["dueBucket"] => {
    const endDate = getDueDateEnd(dueDate ?? null);
    if (!endDate) return "no_date";
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const due = new Date(endDate);
    if (isBefore(due, dayStart) && !isSameDay(due, dayStart)) return "overdue";
    if (isSameDay(due, dayStart)) return "today";
    const weekStart = startOfWeek(dayStart);
    const weekEnd = endOfWeek(dayStart);
    if (due >= weekStart && due <= weekEnd) return "this_week";
    return "later";
  };

  const boardColumns = useMemo(() => {
    const columns: BoardColumn[] = [];
    const columnMap = new Map<string, BoardColumn>();
    const assigneeIds = new Set<string>();
    const assigneeNames = new Set<string>();

    const addColumn = (column: BoardColumn) => {
      if (!columnMap.has(column.id)) {
        columnMap.set(column.id, column);
        columns.push(column);
      }
    };

    if (boardGroupBy === "assignee") {
      orderedTasks.forEach((task) => {
        const taskId = String(task.id);
        const effectiveIds = getEffectiveAssigneeIds(taskId, task);
        effectiveIds.forEach((id) => {
          const normalized = normalizeAssigneeId(id);
          if (normalized) assigneeIds.add(normalized);
        });
        if (effectiveIds.length === 0 && task.assignees?.length) {
          task.assignees.forEach((name) => assigneeNames.add(name));
        }
      });
    }

    if (boardGroupBy === "status") {
      STATUS_OPTIONS.forEach((opt) => {
        addColumn({
          id: `status:${opt.value}`,
          label: opt.label === "To-Do" ? "To Do" : opt.label,
          taskIds: [],
          groupBy: "status",
          value: opt.value,
        });
      });
    } else if (boardGroupBy === "priority") {
      const priorityOrder: Array<BoardColumn["value"]> = ["urgent", "high", "medium", "low", "none"];
      priorityOrder.forEach((value) => {
        addColumn({
          id: `priority:${value}`,
          label: value === "none" ? "None" : (value || "").charAt(0).toUpperCase() + (value || "").slice(1),
          taskIds: [],
          groupBy: "priority",
          value,
        });
      });
    } else if (boardGroupBy === "assignee") {
      addColumn({
        id: "assignee:unassigned",
        label: "Unassigned",
        taskIds: [],
        groupBy: "assignee",
        value: null,
        assigneeId: null,
      });

      workspaceMembers.forEach((member) => {
        if (!member.user_id || !assigneeIds.has(member.user_id)) return;
        addColumn({
          id: `assignee:${member.user_id}`,
          label: member.name || member.email,
          taskIds: [],
          groupBy: "assignee",
          value: member.user_id,
          assigneeId: member.user_id,
        });
      });

      assigneeNames.forEach((name) => {
        addColumn({
          id: `assignee-name:${name}`,
          label: name,
          taskIds: [],
          groupBy: "assignee",
          value: name,
          assigneeName: name,
        });
      });
    } else if (boardGroupBy === "tags") {
      addColumn({
        id: "tag:none",
        label: "No Tag",
        taskIds: [],
        groupBy: "tags",
        value: null,
      });
    } else if (boardGroupBy === "dueDate") {
      [
        { id: "due:overdue", label: "Overdue", dueBucket: "overdue" },
        { id: "due:today", label: "Today", dueBucket: "today" },
        { id: "due:this_week", label: "This Week", dueBucket: "this_week" },
        { id: "due:later", label: "Later", dueBucket: "later" },
        { id: "due:no_date", label: "No Date", dueBucket: "no_date" },
      ].forEach((bucket) => {
        addColumn({
          id: bucket.id,
          label: bucket.label,
          taskIds: [],
          groupBy: "dueDate",
          value: bucket.id,
          dueBucket: bucket.dueBucket as BoardColumn["dueBucket"],
        });
      });
    }

    orderedTasks.forEach((task) => {
      const taskId = String(task.id);
      const effectiveStatus = getEffectiveStatus(taskId, task);
      const effectivePriority = getEffectivePriority(taskId, task);
      const effectiveAssigneeId = getEffectiveAssigneeId(taskId, task);
      const normalizedAssigneeId = normalizeAssigneeId(effectiveAssigneeId);
      const effectiveTags = getEffectiveTags(taskId, task);
      const effectiveDueDate = getEffectiveDueDate(taskId, task);

      let columnId = "";
      if (boardGroupBy === "status") {
        columnId = `status:${effectiveStatus}`;
      } else if (boardGroupBy === "priority") {
        columnId = `priority:${effectivePriority || "none"}`;
      } else if (boardGroupBy === "assignee") {
        if (normalizedAssigneeId) {
          columnId = `assignee:${normalizedAssigneeId}`;
          if (!columnMap.has(columnId)) {
            const member = getWorkspaceMember(normalizedAssigneeId);
            addColumn({
              id: columnId,
              label: member?.name || member?.email || "Assignee",
              taskIds: [],
              groupBy: "assignee",
              value: normalizedAssigneeId,
              assigneeId: normalizedAssigneeId,
            });
          }
        } else if (task.assignees && task.assignees.length > 0) {
          const name = task.assignees[0];
          const nameId = `assignee-name:${name}`;
          addColumn({
            id: nameId,
            label: name,
            taskIds: [],
            groupBy: "assignee",
            value: name,
            assigneeName: name,
          });
          columnId = nameId;
        } else {
          columnId = "assignee:unassigned";
        }
      } else if (boardGroupBy === "tags") {
        const firstTag = effectiveTags[0];
        if (firstTag) {
          const tagId = `tag:${firstTag}`;
          addColumn({
            id: tagId,
            label: firstTag,
            taskIds: [],
            groupBy: "tags",
            value: firstTag,
          });
          columnId = tagId;
        } else {
          columnId = "tag:none";
        }
      } else if (boardGroupBy === "dueDate") {
        const bucket = getDueBucket(effectiveDueDate);
        columnId = `due:${bucket}`;
      }

      const column = columnMap.get(columnId);
      if (column) {
        column.taskIds.push(taskId);
      }
    });

    return columns;
  }, [
    boardGroupBy,
    orderedTasks,
    taskPropertiesById,
    propertyOverrides,
    workspaceMembers,
  ]);

  const taskColumnLookup = useMemo(() => {
    const map = new Map<string, string>();
    boardColumns.forEach((col) => {
      col.taskIds.forEach((id) => map.set(id, col.id));
    });
    return map;
  }, [boardColumns]);

  const applyColumnOrder = (order: string[], columnIds: string[], nextColumnIds: string[]) => {
    const columnSet = new Set(columnIds);
    const replacement = [...nextColumnIds];
    return order.map((id) => (columnSet.has(id) ? replacement.shift() || id : id));
  };

  const updateTempTaskOrder = (nextOrder: string[]) => {
    if (!isTempBlock) return;
    const nextTasks = nextOrder
      .map((id) => taskMapById.get(id))
      .filter(Boolean) as Task[];
    const updatedContent = { ...content, tasks: nextTasks } as TaskBlockContent & { tasks?: Task[] };
    onUpdate?.({
      ...block,
      content: updatedContent,
      updated_at: new Date().toISOString(),
    });
  };

  const handleBoardDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    if (activeId.startsWith("task-")) {
      setActiveTaskId(activeId.replace("task-", ""));
    }
  };

  const handleBoardDragEnd = async (event: DragEndEvent) => {
    const activeId = event.active.id as string;
    const overId = event.over?.id as string | undefined;
    setActiveTaskId(null);

    if (!activeId.startsWith("task-") || !overId) return;

    const taskId = activeId.replace("task-", "");
    const overTaskId = overId.startsWith("task-") ? overId.replace("task-", "") : null;
    const sourceColumnId = (event.active.data.current?.columnId as string) || taskColumnLookup.get(taskId);
    let targetColumnId = sourceColumnId;

    if (overId.startsWith("column-")) {
      targetColumnId = overId.replace("column-", "");
    } else if (overTaskId) {
      targetColumnId = taskColumnLookup.get(overTaskId) || sourceColumnId;
    }

    if (!sourceColumnId || !targetColumnId) return;

    const sourceColumn = boardColumns.find((col) => col.id === sourceColumnId);
    const targetColumn = boardColumns.find((col) => col.id === targetColumnId);
    if (!sourceColumn || !targetColumn) return;

    if (sourceColumnId === targetColumnId) {
      const oldIndex = sourceColumn.taskIds.indexOf(taskId);
      const newIndex = overTaskId ? sourceColumn.taskIds.indexOf(overTaskId) : sourceColumn.taskIds.length - 1;
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const nextColumnIds = arrayMove(sourceColumn.taskIds, oldIndex, newIndex);
      const nextOrder = applyColumnOrder(taskOrder, sourceColumn.taskIds, nextColumnIds);
      setTaskOrder(nextOrder);
      if (isTempBlock) {
        updateTempTaskOrder(nextOrder);
      } else {
        await reorderTaskMutation.mutateAsync(nextOrder);
      }
      return;
    }

    const targetIds = targetColumn.taskIds.filter((id) => id !== taskId);
    const nextOrder = taskOrder.filter((id) => id !== taskId);
    if (targetIds.length === 0) {
      nextOrder.push(taskId);
    } else if (overTaskId) {
      const insertIndex = nextOrder.indexOf(overTaskId);
      if (insertIndex >= 0) {
        nextOrder.splice(insertIndex, 0, taskId);
      } else {
        nextOrder.push(taskId);
      }
    } else {
      const lastTarget = targetIds[targetIds.length - 1];
      const lastIndex = nextOrder.indexOf(lastTarget);
      if (lastIndex >= 0) {
        nextOrder.splice(lastIndex + 1, 0, taskId);
      } else {
        nextOrder.push(taskId);
      }
    }

    setTaskOrder(nextOrder);
    if (isTempBlock) {
      updateTempTaskOrder(nextOrder);
    }
    await applyBoardGroupUpdate(taskId, targetColumn);
    if (!isTempBlock) {
      await reorderTaskMutation.mutateAsync(nextOrder);
    }
  };

  const openReferencesPanel = (taskId: string | number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], comments: true, references: true },
    }));
  };

  const openReferencePicker = (
    taskId: string | number,
    options?: { initialQuery?: string; cursor?: number; anchorRect?: DOMRect | null }
  ) => {
    openReferencesPanel(taskId);
    setReferenceTaskId(String(taskId));
    setReferenceSubtaskId(null);
    const query = options?.initialQuery ?? "";
    setReferenceInitialQuery(query);
    setReferenceCurrentQuery(query);
    setReferenceAnchorRect(options?.anchorRect ?? null);
    if (options?.cursor !== undefined) {
      setInlineReference({ taskId: String(taskId), cursor: options.cursor });
    } else {
      setInlineReference(null);
    }
    setIsReferenceDialogOpen(true);
  };

  const openSubtaskReferencesPanel = (subtaskId: string | number) => {
    if (!projectId || isTempBlock) return;
    setExpandedSubtasks((prev) => ({
      ...prev,
      [String(subtaskId)]: { ...(prev[String(subtaskId)] || {}), references: true },
    }));
    setReferenceSubtaskId(String(subtaskId));
    setReferenceTaskId(null);
    setReferenceInitialQuery("");
    setReferenceAnchorRect(null);
    setInlineReference(null);
    setIsReferenceDialogOpen(true);
  };

  // Helper to check if icons should be shown for a task
  const shouldShowIcons = (task: Task) => {
    return !globalHideIcons && !task.hideIcons;
  };

  const tableColumnTemplate =
    "56px minmax(240px, 2fr) minmax(140px, 1fr) minmax(180px, 1fr) minmax(140px, 1fr) minmax(200px, 1fr) 56px";

  const handleToggleTaskSourceSync = async (checked: boolean) => {
    if (isTempBlock || !hasSourceLinkedCopies || setTaskSyncModeMutation.isPending) return;
    const result = await setTaskSyncModeMutation.mutateAsync(checked ? "live" : "snapshot");
    if ("error" in result) {
      console.error("Failed to set task sync mode:", result.error);
    }
  };

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex-1">
        {editingTitle ? (
          <input
            value={titleValue}
            autoFocus
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={async () => {
              const nextTitle = titleValue.trim() || "Task list";
              setTitleValue(nextTitle);
              setEditingTitle(false);
              const updatedContent = { ...content, title: nextTitle };

              // Optimistic update so the title stays changed in UI
              onUpdate?.({
                ...block,
                content: updatedContent,
                updated_at: new Date().toISOString(),
              });

              // Skip database update if block has temporary ID (not yet saved)
              if (block.id.startsWith("temp-")) {
                return;
              }

              const result = await updateBlock({
                blockId: block.id,
                content: updatedContent,
              });
              if (result.data) {
                onUpdate?.(result.data);
              } else if (result.error) {
                console.error("Failed to update task list title:", result.error);
              }
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setTitleValue(title);
                setEditingTitle(false);
              }
            }}
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide focus:outline-none"
          />
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setEditingTitle(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setEditingTitle(true);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="font-semibold text-[var(--foreground)] text-sm uppercase tracking-wide cursor-text"
          >
            {title}
          </div>
        )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-0.5">
            <button
              type="button"
              onClick={() => handleViewModeChange("list")}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-[4px] text-[var(--muted-foreground)] transition-colors",
                viewMode === "list"
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              )}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("board")}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-[4px] text-[var(--muted-foreground)] transition-colors",
                viewMode === "board"
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              )}
              title="Board view"
            >
              <Columns3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("table")}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-[4px] text-[var(--muted-foreground)] transition-colors",
                viewMode === "table"
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              )}
              title="Table view"
            >
              <Table className="h-3.5 w-3.5" />
            </button>
          </div>
          {viewMode === "board" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
                  Group by {boardGroupBy === "dueDate" ? "Due Date" : boardGroupBy.charAt(0).toUpperCase() + boardGroupBy.slice(1)}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(
                  [
                    { value: "status", label: "Status" },
                    { value: "priority", label: "Priority" },
                    { value: "assignee", label: "Assignee" },
                    { value: "dueDate", label: "Due Date" },
                    { value: "tags", label: "Tags" },
                  ] as Array<{ value: BoardGroupBy; label: string }>
                ).map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleBoardGroupByChange(option.value)}
                    className={boardGroupBy === option.value ? "bg-[var(--surface-hover)]" : ""}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {hasSourceLinkedCopies && (
            <div className="flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
              <span className="text-[10px] font-medium text-[var(--muted-foreground)]">
                Sync edits to source
              </span>
              <Switch
                checked={liveSyncEnabled}
                onCheckedChange={(checked) => {
                  void handleToggleTaskSourceSync(Boolean(checked));
                }}
                disabled={setTaskSyncModeMutation.isPending}
              />
            </div>
          )}
        </div>
        {/* Global Icons Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-6 w-6 items-center justify-center rounded text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
              <Settings className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={toggleGlobalIcons}>
              {globalHideIcons ? (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Show Icons
                </>
              ) : (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Hide Icons
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {hasSourceLinkedCopies && (
        <p className="mb-2 text-[10px] text-[var(--muted-foreground)]">
          Source-linked task copies are shown here. Global search and Everything use the source task once.
        </p>
      )}
      {viewMode === "list" ? (
      <div className="space-y-2">
        {orderedTasks.map((task: Task) => {
          const taskSections = expandedSections[task.id] || {};
          const hasAnyExpanded = taskSections.comments || taskSections.references;
          const hasExtendedInfo = (task.comments && task.comments.length > 0) || taskSections.references;
          const hasSubtasks = task.subtasks && task.subtasks.length > 0;
          const showSubtasksPanel = hasSubtasks || taskSections.subtasks;
          const statusIsDerived = hasSubtasks;
          const taskEntityId = typeof task.id === "string" ? task.id : null;
          const canUseProperties = Boolean(taskEntityId) && !isTempBlock && Boolean(workspaceId);
          const effectiveStatus = getEffectiveStatus(String(task.id), task);
          const isDone = effectiveStatus === "done";
          const effectivePriority = getEffectivePriority(String(task.id), task);
          const effectiveAssigneeIds = getEffectiveAssigneeIds(String(task.id), task);
          const effectiveDueDate = getEffectiveDueDate(String(task.id), task);
          const priorityLabel = effectivePriority
            ? PRIORITY_OPTIONS.find((o) => o.value === effectivePriority)?.label ?? effectivePriority
            : null;
          const assigneeNames = effectiveAssigneeIds
            .map((id) => getWorkspaceMember(id)?.name || getWorkspaceMember(id)?.email)
            .filter(Boolean) as string[];
          const assigneeLabel = assigneeNames.length
            ? assigneeNames.join(", ")
            : (task.assignees?.length ? task.assignees.join(", ") : null);
          const dueDateLabel = formatDueDateRange(effectiveDueDate) || null;
          const hasDueDateValue = hasDueDate(effectiveDueDate);
          const showInlineIcons =
            shouldShowIcons(task) ||
            Boolean(effectivePriority || effectiveAssigneeIds.length || hasDueDateValue);
          
          return (
            <div
              id={`task-${task.id}`}
              key={task.id}
              className={cn(
                "group rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 transition-all duration-150 ease-out",
                "hover:border-[var(--foreground)]/30 hover:shadow-sm"
              )}
            >
              {/* Main Task Row */}
              <div className="flex items-start gap-2">
            {/* Status Icon */}
            {shouldShowIcons(task) ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (statusIsDerived) return;
                toggleTask(task.id);
              }}
                  className={cn(
                    "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:border-[var(--foreground)] flex-shrink-0 cursor-pointer",
                    statusIsDerived && "cursor-not-allowed opacity-60 hover:border-[var(--border)]"
                  )}
              aria-label="Toggle task"
              type="button"
            >
              {effectiveStatus === "done" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : effectiveStatus === "blocked" ? (
                <XCircle className="w-4 h-4 text-red-500" />
              ) : effectiveStatus === "in_progress" ? (
                <Clock className="w-4 h-4 text-[var(--tram-yellow)]" />
              ) : (
                <Circle className="w-4 h-4 text-neutral-300 dark:text-neutral-600" />
              )}
            </button>
            ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (statusIsDerived) return;
                toggleTask(task.id);
              }}
                  className={cn(
                    "mt-0.5 flex h-5 w-5 items-center justify-center flex-shrink-0 cursor-pointer",
                    statusIsDerived && "cursor-not-allowed opacity-60"
                  )}
              aria-label="Toggle task"
              type="button"
            >
              <Circle className="w-4 h-4 text-neutral-300 dark:text-neutral-600" />
            </button>
            )}

                <div className="flex-1 space-y-1.5 min-w-0">
                  {/* Task Title */}
              {editingTaskId === task.id ? (
                <input
                  ref={editingTaskInputRef}
                  type="text"
                  value={editingTaskText}
                  onBlur={() => {
                    updateTask(task.id, { text: editingTaskText });
                    setEditingTaskId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "@" && projectId && !isTempBlock) {
                      e.preventDefault();
                      const cursor = e.currentTarget.selectionStart ?? editingTaskText.length;
                      const nextValue =
                        editingTaskText.slice(0, cursor) + "@" + editingTaskText.slice(cursor);
                      setEditingTaskText(nextValue);
                      setInlineReference({ taskId: String(task.id), cursor });
                      const rect = getInputCaretRect(e.currentTarget);
                      openReferencePicker(task.id, { cursor, anchorRect: rect, initialQuery: "" });
                      requestAnimationFrame(() => {
                        if (editingTaskInputRef.current) {
                          const pos = cursor + 1;
                          editingTaskInputRef.current.setSelectionRange(pos, pos);
                        }
                      });
                      return;
                    }
                    if (e.key === "Enter") {
                      updateTask(task.id, { text: editingTaskText });
                      setEditingTaskId(null);
                    }
                    if (e.key === "Escape") {
                      setEditingTaskId(null);
                      setInlineReference(null);
                      setReferenceCurrentQuery("");
                    }
                  }}
                  onChange={(e) => {
                    // Sync search query when typing after "@"
                    if (inlineReference && String(task.id) === inlineReference.taskId) {
                      const cursor = e.currentTarget.selectionStart ?? e.currentTarget.value.length;
                      const start = inlineReference.cursor;
                      if (cursor > start) {
                        const query = e.currentTarget.value.slice(start + 1, cursor);
                        setReferenceCurrentQuery(query);
                      }
                    }
                    setEditingTaskText(e.target.value);
                  }}
                  autoFocus
                  className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--foreground)] shadow-sm focus:outline-none"
                />
              ) : (
                    <div className="flex items-start gap-1.5">
                <div
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('a[data-ref-link="true"]')) {
                      return;
                    }
                    setEditingTaskId(task.id);
                    setEditingTaskText(task.text);
                  }}
                  className={cn(
                          "flex-1 cursor-text text-xs font-normal leading-normal text-[var(--foreground)] transition-colors hover:text-[var(--foreground)]",
                    isDone && "line-through text-[var(--muted-foreground)]"
                  )}
                  dangerouslySetInnerHTML={{ __html: formatTaskText(task.text) }}
                />
                      {hasExtendedInfo && (
                        <button
                          onClick={() => {
                            // Toggle comments section
                            if (hasAnyExpanded) {
                              setExpandedSections(prev => ({ ...prev, [task.id]: {} }));
                            } else {
                              setExpandedSections(prev => ({ 
                                ...prev, 
                                [task.id]: { 
                                  comments: !!(task.comments && task.comments.length > 0)
                                }
                              }));
                            }
                          }}
                          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", hasAnyExpanded && "rotate-90")} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Description - Inline Display */}
                  {task.description !== undefined && (
                    <TaskDescription task={task} updateTask={updateTask} />
                  )}

                  {/* Subtasks - Modal Display */}
                  {showSubtasksPanel && (
                    <div className="mt-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 shadow-sm">
                      <div className="space-y-1.5">
                        {(task.subtasks || []).map((subtask) => {
                          const subtaskId = String(subtask.id);
                          const subtaskEntityId = typeof subtask.id === "string" ? subtask.id : null;
                          const canUseSubtaskProperties = Boolean(subtaskEntityId) && !isTempBlock && Boolean(workspaceId);
                          const subtaskProps = getSubtaskEffectiveProperties(subtaskId);
                          const subtaskStatus = getSubtaskEffectiveStatus(subtaskId, subtask);
                          const subtaskAssigneeIds = getSubtaskEffectiveAssigneeIds(subtaskId);
                          const subtaskAssigneeNames = subtaskAssigneeIds
                            .map((id) => getWorkspaceMember(id)?.name || getWorkspaceMember(id)?.email)
                            .filter(Boolean) as string[];
                          const subtaskPriority = normalizePriority(subtaskProps?.priority ?? null);
                          const subtaskPriorityLabel = subtaskPriority
                            ? PRIORITY_OPTIONS.find((o) => o.value === subtaskPriority)?.label ?? subtaskPriority
                            : null;
                          const subtaskAssigneeLabel = subtaskAssigneeNames.length ? subtaskAssigneeNames.join(", ") : null;
                          const subtaskStatusLabel =
                            STATUS_OPTIONS.find((o) => o.value === subtaskStatus)?.label ?? subtaskStatus;
                          const subtaskSections = expandedSubtasks[subtaskId] || {};
                          const showSubtaskDescription =
                            subtask.description !== undefined || subtaskSections.description;

                          return (
                            <div
                              key={subtask.id}
                              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5"
                            >
                              <div className="flex items-start gap-2">
                                <button
                                  onClick={() => toggleSubtask(task.id, subtask.id)}
                                  className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:border-[var(--foreground)] flex-shrink-0"
                                  aria-label="Toggle subtask"
                                  type="button"
                                >
                                  {subtaskStatus === "done" ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  ) : subtaskStatus === "blocked" ? (
                                    <XCircle className="h-3 w-3 text-red-500" />
                                  ) : subtaskStatus === "in_progress" ? (
                                    <Clock className="h-3 w-3 text-[var(--tram-yellow)]" />
                                  ) : (
                                    <Circle className="h-3 w-3 text-neutral-300 dark:text-neutral-600" />
                                  )}
                                </button>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <input
                                    type="text"
                                    value={subtaskDrafts[subtaskId] ?? subtask.text}
                                    onChange={(e) =>
                                      setSubtaskDrafts((prev) => ({ ...prev, [subtaskId]: e.target.value }))
                                    }
                                    onBlur={() =>
                                      commitSubtaskDraft(
                                        task.id,
                                        subtask.id,
                                        subtaskDrafts[subtaskId],
                                        subtask.text
                                      )
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                      }
                                      if (e.key === "Escape") {
                                        e.preventDefault();
                                        setSubtaskDrafts((prev) => {
                                          const next = { ...prev };
                                          delete next[subtaskId];
                                          return next;
                                        });
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    className={cn(
                                      "w-full text-xs bg-transparent border-none outline-none text-[var(--foreground)] py-0.5",
                                      subtaskStatus === "done" && "line-through text-[var(--muted-foreground)]"
                                    )}
                                  />
                                  {showSubtaskDescription && (
                                    <SubtaskDescription
                                      subtask={subtask}
                                      updateSubtask={(id, updates) => updateSubtask(task.id, id, updates)}
                                    />
                                  )}
                                  {canUseSubtaskProperties && subtaskEntityId && (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] leading-normal">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={(e) => e.stopPropagation()}
                                            className={cn(
                                              "inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 transition-colors",
                                              "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                            )}
                                            title={`Status: ${subtaskStatusLabel}`}
                                          >
                                            {subtaskStatus === "done" ? (
                                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                            ) : subtaskStatus === "blocked" ? (
                                              <XCircle className="h-3 w-3 text-red-500" />
                                            ) : subtaskStatus === "in_progress" ? (
                                              <Clock className="h-3 w-3 text-[var(--tram-yellow)]" />
                                            ) : (
                                              <Circle className="h-3 w-3 text-neutral-300 dark:text-neutral-600" />
                                            )}
                                            <span className="max-w-[120px] truncate">{subtaskStatusLabel}</span>
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-40" onClick={(e) => e.stopPropagation()}>
                                          {STATUS_OPTIONS.map((opt) => (
                                            <DropdownMenuItem
                                              key={opt.value}
                                              onClick={() => updateSubtaskStatus(subtaskId, opt.value as Status)}
                                            >
                                              {opt.label}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>

                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={(e) => e.stopPropagation()}
                                            className={cn(
                                              "inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 transition-colors",
                                              subtaskPriority
                                                ? PRIORITY_COLORS[subtaskPriority]
                                                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
                                            )}
                                            title={subtaskPriorityLabel ? `Priority: ${subtaskPriorityLabel}` : "Set priority"}
                                          >
                                            <Flag className="h-3 w-3" />
                                            {subtaskPriorityLabel && <span className="max-w-[120px] truncate">{subtaskPriorityLabel}</span>}
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-40" onClick={(e) => e.stopPropagation()}>
                                          <DropdownMenuItem onClick={() => updateSubtaskPriority(subtaskId, null)}>
                                            None
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          {PRIORITY_OPTIONS.map((opt) => (
                                            <DropdownMenuItem
                                              key={opt.value}
                                              onClick={() => updateSubtaskPriority(subtaskId, opt.value)}
                                            >
                                              {opt.label}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>

                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={(e) => e.stopPropagation()}
                                            className={cn(
                                              "inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 transition-colors",
                                              subtaskAssigneeIds.length
                                                ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
                                            )}
                                            title={subtaskAssigneeLabel ? `Assignees: ${subtaskAssigneeLabel}` : "Assign"}
                                          >
                                            <Users className="h-3 w-3" />
                                            {subtaskAssigneeLabel && (
                                              <span className="max-w-[140px] truncate">{subtaskAssigneeLabel}</span>
                                            )}
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-52" onClick={(e) => e.stopPropagation()}>
                                          <DropdownMenuItem onClick={() => updateSubtaskAssignees(subtaskId, [])}>
                                            Unassigned (clear all)
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          {workspaceMembers.map((m) => {
                                            const isAssigned = subtaskAssigneeIds.includes(m.user_id);
                                            return (
                                              <DropdownMenuItem
                                                key={m.user_id}
                                                onClick={() => {
                                                  const next = isAssigned
                                                    ? subtaskAssigneeIds.filter((id) => id !== m.user_id)
                                                    : [...subtaskAssigneeIds, m.user_id];
                                                  updateSubtaskAssignees(subtaskId, next);
                                                }}
                                              >
                                                <span className="flex items-center gap-2">
                                                  {isAssigned ? "✓ " : ""}
                                                  {m.name || m.email}
                                                </span>
                                              </DropdownMenuItem>
                                            );
                                          })}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  )}
                                  {subtaskProps && (
                                    <div className="pt-1">
                                      <PropertyBadges
                                        properties={subtaskProps}
                                        memberNames={subtaskAssigneeNames}
                                        onClick={() => {
                                          setPropertiesTarget({
                                            type: "subtask",
                                            id: subtaskId,
                                            title: subtask.text || "Subtask",
                                          });
                                          setPropertiesOpen(true);
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="flex h-6 w-6 items-center justify-center rounded text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    {canUseProperties && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setPropertiesTarget({
                                              type: "subtask",
                                              id: subtaskId,
                                              title: subtask.text || "Subtask",
                                            });
                                            setPropertiesOpen(true);
                                          }}
                                        >
                                          <Tag className="mr-2 h-4 w-4 text-[var(--muted-foreground)]" />
                                          Properties
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </>
                                    )}
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setExpandedSubtasks((prev) => ({
                                          ...prev,
                                          [subtaskId]: { ...(prev[subtaskId] || {}), description: true },
                                        }));
                                        if (subtask.description === undefined) {
                                          updateSubtask(task.id, subtask.id, { description: "" });
                                        }
                                      }}
                                    >
                                      <AlignLeft className="mr-2 h-4 w-4" />
                                      Add Description
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openSubtaskReferencesPanel(subtask.id)}>
                                      <Paperclip className="mr-2 h-4 w-4" />
                                      Attachments
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => deleteSubtask(task.id, subtask.id)}
                                      className="text-red-600"
                                    >
                                      <X className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              {subtaskSections.references && (
                                <div className="mt-2 border-t border-[var(--border)] pt-2">
                                  <SubtaskReferences
                                    subtaskId={subtaskId}
                                    onAdd={() => openSubtaskReferencesPanel(subtask.id)}
                                    disabled={!projectId || isTempBlock}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => addSubtask(task.id)}
                          className="flex items-center gap-0.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-0.5"
                        >
                          <Plus className="h-2.5 w-2.5" />
                          Add subtask
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Icons (Priority / Assignee / Due Date) driven by universal properties */}
                  {canUseProperties && taskEntityId && showInlineIcons && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs leading-normal">
                      {/* Priority */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 transition-colors",
                              effectivePriority
                                ? PRIORITY_COLORS[effectivePriority]
                                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
                            )}
                            title={
                              effectivePriority
                                ? `Priority: ${PRIORITY_OPTIONS.find((o) => o.value === effectivePriority)?.label ?? effectivePriority}`
                                : "Set priority"
                            }
                          >
                            <Flag className="h-3 w-3" />
                            {priorityLabel && <span className="max-w-[120px] truncate">{priorityLabel}</span>}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={() =>
                              setTaskProperties.mutate({
                                entityId: taskEntityId,
                                updates: { priority: null },
                              })
                            }
                          >
                            None
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {PRIORITY_OPTIONS.map((opt) => (
                            <DropdownMenuItem
                              key={opt.value}
                              onClick={() =>
                                setTaskProperties.mutate({
                                  entityId: taskEntityId,
                                  updates: { priority: opt.value },
                                })
                              }
                            >
                              {opt.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Assignees (multiple) */}
                      {statusIsDerived ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 transition-colors border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]",
                            "cursor-not-allowed opacity-60"
                          )}
                          title="Assignees are derived from subtasks"
                        >
                          <Users className="h-3 w-3" />
                          <span className="max-w-[140px] truncate">
                            {assigneeLabel || "Unassigned"}
                          </span>
                        </span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 transition-colors",
                                effectiveAssigneeIds.length
                                  ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
                              )}
                              title={assigneeLabel ? `Assignees: ${assigneeLabel}` : "Assign"}
                            >
                              <Users className="h-3 w-3" />
                              {assigneeLabel && <span className="max-w-[140px] truncate">{assigneeLabel}</span>}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-52" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              onClick={() =>
                                setTaskProperties.mutate({
                                  entityId: taskEntityId,
                                  updates: { assignee_ids: null },
                                })
                              }
                            >
                              Unassigned (clear all)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {workspaceMembers.map((m) => {
                              const isAssigned = effectiveAssigneeIds.includes(m.user_id);
                              return (
                                <DropdownMenuItem
                                  key={m.user_id}
                                  onClick={() => {
                                    const next = isAssigned
                                      ? effectiveAssigneeIds.filter((id) => id !== m.user_id)
                                      : [...effectiveAssigneeIds, m.user_id];
                                    setTaskProperties.mutate({
                                      entityId: taskEntityId,
                                      updates: { assignee_ids: next.length ? next : null },
                                    });
                                  }}
                                >
                                  <span className="flex items-center gap-2">
                                    {isAssigned ? "✓ " : ""}
                                    {m.name || m.email}
                                  </span>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {/* Due Date */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 transition-colors",
                              hasDueDateValue
                                ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                            )}
                            title={hasDueDateValue ? `Due: ${dueDateLabel}` : "Set due date"}
                          >
                            <Calendar className="h-3 w-3" />
                            {dueDateLabel && <span className="max-w-[110px] truncate">{dueDateLabel}</span>}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-64"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                                  Start
                                </span>
                                <Input
                                  type="date"
                                  value={effectiveDueDate?.start ?? ""}
                                  onChange={(e) =>
                                    setTaskProperties.mutate({
                                      entityId: taskEntityId,
                                      updates: {
                                        due_date: buildDueDateRange(
                                          e.target.value || null,
                                          effectiveDueDate?.end ?? null
                                        ),
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                                  Due
                                </span>
                                <Input
                                  type="date"
                                  value={effectiveDueDate?.end ?? ""}
                                  onChange={(e) =>
                                    setTaskProperties.mutate({
                                      entityId: taskEntityId,
                                      updates: {
                                        due_date: buildDueDateRange(
                                          effectiveDueDate?.start ?? null,
                                          e.target.value || null
                                        ),
                                      },
                                    })
                                  }
                                />
                              </div>
                            </div>
                            {hasDueDateValue && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    setTaskProperties.mutate({
                                      entityId: taskEntityId,
                                      updates: { due_date: null },
                                    })
                                  }
                                  className="text-red-600"
                                >
                                  Clear dates
                                </DropdownMenuItem>
                              </>
                            )}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {/* When icons are hidden, show compact universal property badges instead */}
                {canUseProperties && taskEntityId && !shouldShowIcons(task) && (
                  <TaskPropertyBadges
                    entityId={taskEntityId}
                    workspaceId={workspaceId}
                    onOpen={() => {
                      setPropertiesTarget({ type: "task", id: taskEntityId, title: task.text || "Task" });
                      setPropertiesOpen(true);
                    }}
                  />
                )}

                {/* Three-dot menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-6 w-6 items-center justify-center rounded text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] flex-shrink-0">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {canUseProperties && taskEntityId && (
                      <>
                        <DropdownMenuItem
                          onClick={() => {
                            setPropertiesTarget({ type: "task", id: taskEntityId, title: task.text || "Task" });
                            setPropertiesOpen(true);
                          }}
                        >
                          <Tag className="mr-2 h-4 w-4 text-[var(--muted-foreground)]" />
                          Properties
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {/* Actions */}
                    <DropdownMenuItem onClick={() => toggleTaskIcons(task.id)}>
                      {task.hideIcons ? (
                        <>
                          <Eye className="mr-2 h-4 w-4" />
                          Show Icons
                        </>
                      ) : (
                        <>
                          <EyeOff className="mr-2 h-4 w-4" />
                          Hide Icons
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (!task.description) {
                        updateTask(task.id, { description: "" });
                      }
                    }}>
                      <AlignLeft className="mr-2 h-4 w-4" />
                      Add Description
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addSubtask(task.id)}>
                      <CheckSquare className="mr-2 h-4 w-4" />
                      Add Subtask
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openReferencesPanel(task.id)}>
                      <Paperclip className="mr-2 h-4 w-4" />
                      Attachments
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => deleteTask(task.id)} className="text-red-600">
                      <X className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Expanded Section */}
              {hasAnyExpanded && (
                <div className="border-t border-[var(--border)] px-2.5 py-2 space-y-2 bg-[var(--surface-muted)]">
                  <TaskReferences
                    taskId={String(task.id)}
                    onAdd={() => openReferencePicker(task.id)}
                    disabled={!projectId || isTempBlock}
                  />
                  {/* Comments */}
                  {taskSections.comments && (
                  <div>
                    <label className="text-xs font-medium text-[var(--muted-foreground)] mb-2 block">
                      Comments {task.comments && task.comments.length > 0 && (
                        <span className="text-[var(--tertiary-foreground)]">({task.comments.length})</span>
                      )}
                    </label>
                    {task.comments && task.comments.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {task.comments.map((comment) => (
                          <div key={comment.id} className="rounded-md bg-[var(--surface)] border border-[var(--border)] px-2.5 py-2 text-xs">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-[var(--foreground)]">{comment.author}</span>
                              <span className="text-xs text-[var(--tertiary-foreground)]">
                                {new Date(comment.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--muted-foreground)] leading-normal">{comment.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment[task.id] || ""}
                        onChange={(e) => setNewComment(prev => ({ ...prev, [task.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            addComment(task.id);
                          }
                        }}
                        placeholder="Add comment..."
                        className="flex-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
                      />
                      <button
                        onClick={() => addComment(task.id)}
                        className="px-3 py-1.5 rounded-[4px] bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={addTask}
          className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
        >
          <Plus className="h-3 w-3" /> Add task
        </button>
      </div>
      ) : viewMode === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleBoardDragStart}
          onDragEnd={handleBoardDragEnd}
        >
          <div className="overflow-x-auto">
            <div className="flex w-full min-w-max gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
              {boardColumns.map((column) => (
                <div key={column.id} className="flex min-w-[240px] flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-medium text-[var(--muted-foreground)]">
                      {column.label}
                    </div>
                    <div className="text-[10px] text-[var(--tertiary-foreground)]">
                      {column.taskIds.length}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addTaskForColumn(column)}
                    className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
                  >
                    <Plus className="h-3 w-3" /> Add task
                  </button>
                  <BoardColumnContainer columnId={column.id}>
                    <SortableContext
                      items={column.taskIds.map((id) => `task-${id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {column.taskIds.map((taskId) => {
                        const task = taskMapById.get(taskId);
                        if (!task) return null;

                        const taskEntityId = typeof task.id === "string" ? task.id : null;
                        const canUseProperties = Boolean(taskEntityId) && !isTempBlock && Boolean(workspaceId);
                        const effectiveStatus = getEffectiveStatus(taskId, task);
                        const effectivePriority = getEffectivePriority(taskId, task);
                        const effectiveAssigneeIds = getEffectiveAssigneeIds(taskId, task);
                        const effectiveDueDate = getEffectiveDueDate(taskId, task);
                        const effectiveTags = getEffectiveTags(taskId, task);
                        const assigneeNames = effectiveAssigneeIds
                          .map((id) => getWorkspaceMember(id)?.name || getWorkspaceMember(id)?.email)
                          .filter(Boolean) as string[];
                        const assigneeLabel = assigneeNames.length
                          ? assigneeNames.join(", ")
                          : task.assignees?.length
                            ? task.assignees.join(", ")
                            : null;
                        const assigneeInitial = assigneeLabel ? assigneeLabel.trim()[0]?.toUpperCase() : "?";

                        const statusIcon =
                          effectiveStatus === "done" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : effectiveStatus === "blocked" ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : effectiveStatus === "in_progress" ? (
                            <Clock className="h-4 w-4 text-[var(--tram-yellow)]" />
                          ) : (
                            <Circle className="h-4 w-4 text-neutral-300 dark:text-neutral-600" />
                          );

                        const showStatusIcon = shouldShowIcons(task) && boardGroupBy !== "status";
                        const showPriority = Boolean(effectivePriority) && boardGroupBy !== "priority";
                        const showAssignee = Boolean(assigneeLabel) && boardGroupBy !== "assignee";
                        const hasDueDateValue = hasDueDate(effectiveDueDate);
                        const dueDateLabel = formatDueDateRange(effectiveDueDate) || null;
                        const showDueDate = hasDueDateValue && boardGroupBy !== "dueDate";
                        const showTags = effectiveTags.length > 0 && boardGroupBy !== "tags";

                        const title =
                          editingTaskId === task.id ? (
                            <input
                              ref={editingTaskInputRef}
                              type="text"
                              value={editingTaskText}
                              onChange={(e) => {
                                // Sync search query when typing after "@"
                                if (inlineReference && String(task.id) === inlineReference.taskId) {
                                  const cursor = e.currentTarget.selectionStart ?? e.currentTarget.value.length;
                                  const start = inlineReference.cursor;
                                  if (cursor > start) {
                                    const query = e.currentTarget.value.slice(start + 1, cursor);
                                    setReferenceCurrentQuery(query);
                                  }
                                }
                                setEditingTaskText(e.target.value);
                              }}
                              onBlur={() => {
                                updateTask(task.id, { text: editingTaskText });
                                setEditingTaskId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "@" && projectId && !isTempBlock) {
                                  e.preventDefault();
                                  const cursor = e.currentTarget.selectionStart ?? editingTaskText.length;
                                  const nextValue =
                                    editingTaskText.slice(0, cursor) + "@" + editingTaskText.slice(cursor);
                                  setEditingTaskText(nextValue);
                                  setInlineReference({ taskId: String(task.id), cursor });
                                  const rect = getInputCaretRect(e.currentTarget);
                                  openReferencePicker(task.id, { cursor, anchorRect: rect, initialQuery: "" });
                                  requestAnimationFrame(() => {
                                    if (editingTaskInputRef.current) {
                                      const pos = cursor + 1;
                                      editingTaskInputRef.current.setSelectionRange(pos, pos);
                                    }
                                  });
                                  return;
                                }
                                if (e.key === "Enter") {
                                  updateTask(task.id, { text: editingTaskText });
                                  setEditingTaskId(null);
                                }
                                if (e.key === "Escape") {
                                  setEditingTaskId(null);
                                  setInlineReference(null);
                                  setReferenceCurrentQuery("");
                                }
                              }}
                              autoFocus
                              className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--foreground)] shadow-sm focus:outline-none"
                            />
                          ) : (
                            <div
                              onClick={(e) => {
                                const target = e.target as HTMLElement;
                                if (target.closest('a[data-ref-link="true"]')) {
                                  return;
                                }
                                setEditingTaskId(task.id);
                                setEditingTaskText(task.text);
                              }}
                              className={cn(
                                "cursor-text text-xs font-normal leading-normal text-[var(--foreground)] transition-colors hover:text-[var(--foreground)]",
                                effectiveStatus === "done" && "line-through text-[var(--muted-foreground)]"
                              )}
                              dangerouslySetInnerHTML={{ __html: formatTaskText(task.text) }}
                            />
                          );

                        const priorityBadge = effectivePriority ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium",
                              PRIORITY_COLORS[effectivePriority]
                            )}
                          >
                            <Flag className="h-3 w-3" />
                            {PRIORITY_OPTIONS.find((opt) => opt.value === effectivePriority)?.label ?? "Priority"}
                          </span>
                        ) : null;

                        const assigneeBadge = assigneeLabel ? (
                          <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--foreground)] max-w-full min-w-0">
                            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[9px] font-semibold">
                              {assigneeInitial}
                            </span>
                            <span className="truncate">{assigneeLabel}</span>
                          </span>
                        ) : null;

                        const dueDateBadge = hasDueDateValue && dueDateLabel ? (
                          <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--foreground)]">
                            <Calendar className="h-3 w-3" />
                            {dueDateLabel}
                          </span>
                        ) : null;

                        const tagsBadges =
                          effectiveTags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {effectiveTags.slice(0, 3).map((tag) => (
                                <span
                                  key={`${taskId}-tag-${tag}`}
                                  className="inline-flex items-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]"
                                >
                                  {tag}
                                </span>
                              ))}
                              {effectiveTags.length > 3 && (
                                <span className="text-[10px] text-[var(--tertiary-foreground)]">
                                  +{effectiveTags.length - 3}
                                </span>
                              )}
                            </div>
                          ) : null;

                        const statusIsDerived = task.subtasks && task.subtasks.length > 0;

                        const menu = (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex h-6 w-6 items-center justify-center rounded text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] flex-shrink-0">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {canUseProperties && taskEntityId && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setPropertiesTarget({ type: "task", id: taskEntityId, title: task.text || "Task" });
                                      setPropertiesOpen(true);
                                    }}
                                  >
                                    <Tag className="mr-2 h-4 w-4 text-[var(--muted-foreground)]" />
                                    Properties
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => toggleTaskIcons(task.id)}>
                                {task.hideIcons ? (
                                  <>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Show Icons
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="mr-2 h-4 w-4" />
                                    Hide Icons
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!task.description) {
                                    updateTask(task.id, { description: "" });
                                  }
                                }}
                              >
                                <AlignLeft className="mr-2 h-4 w-4" />
                                Add Description
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => addSubtask(task.id)}>
                                <CheckSquare className="mr-2 h-4 w-4" />
                                Add Subtask
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openReferencesPanel(task.id)}>
                                <Paperclip className="mr-2 h-4 w-4" />
                                Attachments
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => deleteTask(task.id)} className="text-red-600">
                                <X className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );

                        return (
                          <BoardTaskCard
                            key={taskId}
                            taskId={taskId}
                            columnId={column.id}
                            statusIcon={statusIcon}
                            title={title}
                            onToggleStatus={() => {
                              if (statusIsDerived) return;
                              toggleTask(task.id);
                            }}
                            showStatusIcon={showStatusIcon}
                            showPriority={showPriority}
                            showAssignee={showAssignee}
                            showDueDate={showDueDate}
                            showTags={showTags}
                            priorityBadge={priorityBadge}
                            assigneeBadge={assigneeBadge}
                            dueDateBadge={dueDateBadge}
                            tagsBadges={tagsBadges}
                            menu={menu}
                          />
                        );
                      })}
                    </SortableContext>
                  </BoardColumnContainer>
                </div>
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeTaskId ? (
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs shadow-lg">
                {taskMapById.get(activeTaskId)?.text || "Task"}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-2">
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div
              className="grid border-b border-l border-[var(--border)] bg-[#d8d8d8]/20 w-full"
              style={{ gridTemplateColumns: tableColumnTemplate }}
            >
              <div className="flex items-center justify-center border-r border-black/10 px-2 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Status
              </div>
              <div className="border-r border-black/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Task
              </div>
              <div className="border-r border-black/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Priority
              </div>
              <div className="border-r border-black/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Assignee
              </div>
              <div className="border-r border-black/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Due Date
              </div>
              <div className="border-r border-black/10 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Tags
              </div>
              <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Actions
              </div>
            </div>
            {orderedTasks.map((task) => {
              const taskEntityId = typeof task.id === "string" ? task.id : null;
              const canUseProperties = Boolean(taskEntityId) && !isTempBlock && Boolean(workspaceId);
              const statusIsDerived = task.subtasks && task.subtasks.length > 0;
              const effectiveStatus = getEffectiveStatus(String(task.id), task);
              const isDone = effectiveStatus === "done";
              const effectivePriority = getEffectivePriority(String(task.id), task);
              const effectiveAssigneeIds = getEffectiveAssigneeIds(String(task.id), task);
              const effectiveDueDate = getEffectiveDueDate(String(task.id), task);
              const effectiveTags = getEffectiveTags(String(task.id), task);
              const priorityLabel = effectivePriority
                ? PRIORITY_OPTIONS.find((o) => o.value === effectivePriority)?.label ?? effectivePriority
                : null;
              const assigneeNames = effectiveAssigneeIds
                .map((id) => getWorkspaceMember(id)?.name || getWorkspaceMember(id)?.email)
                .filter(Boolean) as string[];
              const assigneeLabel = assigneeNames.length
                ? assigneeNames.join(", ")
                : (task.assignees?.length ? task.assignees.join(", ") : null);
              const dueDateLabel = formatDueDateRange(effectiveDueDate) || null;
              const hasDueDateValue = hasDueDate(effectiveDueDate);
              const visibleTags = effectiveTags.slice(0, 2);
              const extraTags = effectiveTags.length - visibleTags.length;

              return (
                <div
                  id={`task-${task.id}`}
                  key={task.id}
                  className="grid border-b border-l border-[var(--border)] row-hover-teal transition-colors duration-150 bg-[var(--surface)] w-full last:border-b-0"
                  style={{ gridTemplateColumns: tableColumnTemplate }}
                >
                  <div className="flex items-center justify-center border-r border-[var(--border-strong)] px-2 py-2">
                    {shouldShowIcons(task) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (statusIsDerived) return;
                          toggleTask(task.id);
                        }}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:border-[var(--foreground)]",
                          statusIsDerived && "cursor-not-allowed opacity-60 hover:border-[var(--border)]"
                        )}
                        aria-label="Toggle task"
                        type="button"
                      >
                        {effectiveStatus === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : effectiveStatus === "blocked" ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : effectiveStatus === "in_progress" ? (
                          <Clock className="w-4 h-4 text-[var(--tram-yellow)]" />
                        ) : (
                          <Circle className="w-4 h-4 text-neutral-300 dark:text-neutral-600" />
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (statusIsDerived) return;
                          toggleTask(task.id);
                        }}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center",
                          statusIsDerived && "cursor-not-allowed opacity-60"
                        )}
                        aria-label="Toggle task"
                        type="button"
                      >
                        <Circle className="w-4 h-4 text-neutral-300 dark:text-neutral-600" />
                      </button>
                    )}
                  </div>
                  <div className="border-r border-[var(--border-strong)] px-3 py-2">
                    {editingTaskId === task.id ? (
                      <input
                        ref={editingTaskInputRef}
                        type="text"
                        value={editingTaskText}
                        onChange={(e) => {
                          // Sync search query when typing after "@"
                          if (inlineReference && String(task.id) === inlineReference.taskId) {
                            const cursor = e.currentTarget.selectionStart ?? e.currentTarget.value.length;
                            const start = inlineReference.cursor;
                            if (cursor > start) {
                              const query = e.currentTarget.value.slice(start + 1, cursor);
                              setReferenceCurrentQuery(query);
                            }
                          }
                          setEditingTaskText(e.target.value);
                        }}
                        onBlur={() => {
                          updateTask(task.id, { text: editingTaskText });
                          setEditingTaskId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "@" && projectId && !isTempBlock) {
                            e.preventDefault();
                            const cursor = e.currentTarget.selectionStart ?? editingTaskText.length;
                            const nextValue =
                              editingTaskText.slice(0, cursor) + "@" + editingTaskText.slice(cursor);
                            setEditingTaskText(nextValue);
                            setInlineReference({ taskId: String(task.id), cursor });
                            const rect = getInputCaretRect(e.currentTarget);
                            openReferencePicker(task.id, { cursor, anchorRect: rect, initialQuery: "" });
                            requestAnimationFrame(() => {
                              if (editingTaskInputRef.current) {
                                const pos = cursor + 1;
                                editingTaskInputRef.current.setSelectionRange(pos, pos);
                              }
                            });
                            return;
                          }
                          if (e.key === "Enter") {
                            updateTask(task.id, { text: editingTaskText });
                            setEditingTaskId(null);
                          }
                          if (e.key === "Escape") {
                            setEditingTaskId(null);
                            setInlineReference(null);
                            setReferenceCurrentQuery("");
                          }
                        }}
                        autoFocus
                        className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--foreground)] shadow-sm focus:outline-none"
                      />
                    ) : (
                      <div
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('a[data-ref-link="true"]')) {
                            return;
                          }
                          setEditingTaskId(task.id);
                          setEditingTaskText(task.text);
                        }}
                        className={cn(
                          "cursor-text text-xs font-normal leading-normal text-[var(--foreground)] transition-colors hover:text-[var(--foreground)]",
                          isDone && "line-through text-[var(--muted-foreground)]"
                        )}
                        dangerouslySetInnerHTML={{ __html: formatTaskText(task.text) }}
                      />
                    )}
                    {task.description !== undefined && (
                      <TaskDescription task={task} updateTask={updateTask} />
                    )}
                    {canUseProperties && taskEntityId && !shouldShowIcons(task) && (
                      <TaskPropertyBadges
                        entityId={taskEntityId}
                        workspaceId={workspaceId}
                        onOpen={() => {
                          setPropertiesTarget({ type: "task", id: taskEntityId, title: task.text || "Task" });
                          setPropertiesOpen(true);
                        }}
                      />
                    )}
                  </div>
                  <div className="border-r border-[var(--border-strong)] px-3 py-2">
                    {canUseProperties && taskEntityId ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs transition-colors",
                              effectivePriority
                                ? PRIORITY_COLORS[effectivePriority]
                                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
                            )}
                          >
                            {shouldShowIcons(task) && <Flag className="h-3 w-3" />}
                            {priorityLabel ?? "None"}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => updateTaskPriority(String(task.id), null)}>
                            None
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {PRIORITY_OPTIONS.map((opt) => (
                            <DropdownMenuItem
                              key={opt.value}
                              onClick={() => updateTaskPriority(String(task.id), opt.value)}
                            >
                              {opt.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)]">{priorityLabel ?? "—"}</span>
                    )}
                  </div>
                  <div className="border-r border-[var(--border-strong)] px-3 py-2">
                    {canUseProperties && taskEntityId ? (
                      statusIsDerived ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs transition-colors border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]",
                            "cursor-not-allowed opacity-60"
                          )}
                          title="Assignees are derived from subtasks"
                        >
                          {shouldShowIcons(task) && <Users className="h-3 w-3" />}
                          <span className="max-w-[160px] truncate">{assigneeLabel || "Unassigned"}</span>
                        </span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs transition-colors",
                                effectiveAssigneeIds.length
                                  ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
                              )}
                              title={assigneeLabel ? `Assignees: ${assigneeLabel}` : "Assign"}
                            >
                              {shouldShowIcons(task) && <Users className="h-3 w-3" />}
                              <span className="max-w-[160px] truncate">{assigneeLabel || "Unassigned"}</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-52" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => updateTaskAssignees(String(task.id), [])}>
                              Unassigned (clear all)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {workspaceMembers.map((m) => {
                              const isAssigned = effectiveAssigneeIds.includes(m.user_id);
                              return (
                                <DropdownMenuItem
                                  key={m.user_id}
                                  onClick={() => {
                                    const next = isAssigned
                                      ? effectiveAssigneeIds.filter((id) => id !== m.user_id)
                                      : [...effectiveAssigneeIds, m.user_id];
                                    updateTaskAssignees(String(task.id), next);
                                  }}
                                >
                                  <span className="flex items-center gap-2">
                                    {isAssigned ? "✓ " : ""}
                                    {m.name || m.email}
                                  </span>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)]">{assigneeLabel ?? "—"}</span>
                    )}
                  </div>
                  <div className="border-r border-[var(--border-strong)] px-3 py-2">
                    {canUseProperties && taskEntityId ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs transition-colors",
                              hasDueDateValue
                                ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                            )}
                            title={hasDueDateValue ? `Due: ${dueDateLabel}` : "Set due date"}
                          >
                            {shouldShowIcons(task) && <Calendar className="h-3 w-3" />}
                            <span className="max-w-[140px] truncate">{dueDateLabel || "No due date"}</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-64"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                                  Start
                                </span>
                                <Input
                                  type="date"
                                  value={effectiveDueDate?.start ?? ""}
                                  onChange={(e) =>
                                    updateTaskDueDate(
                                      String(task.id),
                                      buildDueDateRange(
                                        e.target.value || null,
                                        effectiveDueDate?.end ?? null
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">
                                  Due
                                </span>
                                <Input
                                  type="date"
                                  value={effectiveDueDate?.end ?? ""}
                                  onChange={(e) =>
                                    updateTaskDueDate(
                                      String(task.id),
                                      buildDueDateRange(
                                        effectiveDueDate?.start ?? null,
                                        e.target.value || null
                                      )
                                    )
                                  }
                                />
                              </div>
                            </div>
                            {hasDueDateValue && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => updateTaskDueDate(String(task.id), null)}
                                  className="text-red-600"
                                >
                                  Clear dates
                                </DropdownMenuItem>
                              </>
                            )}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-xs text-[var(--muted-foreground)]">{dueDateLabel ?? "—"}</span>
                    )}
                  </div>
                  <div className="border-r border-[var(--border-strong)] px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (canUseProperties && taskEntityId) {
                          setPropertiesTarget({ type: "task", id: taskEntityId, title: task.text || "Task" });
                          setPropertiesOpen(true);
                        }
                      }}
                      className="flex flex-wrap items-center gap-1.5 text-left"
                    >
                      {visibleTags.length > 0 ? (
                        <>
                          {visibleTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]"
                            >
                              {tag}
                            </span>
                          ))}
                          {extraTags > 0 && (
                            <span className="text-[10px] text-[var(--muted-foreground)]">+{extraTags}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">No tags</span>
                      )}
                    </button>
                  </div>
                  <div className="px-2 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex h-7 w-7 items-center justify-center rounded text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {canUseProperties && taskEntityId && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setPropertiesTarget({ type: "task", id: taskEntityId, title: task.text || "Task" });
                                setPropertiesOpen(true);
                              }}
                            >
                              <Tag className="mr-2 h-4 w-4 text-[var(--muted-foreground)]" />
                              Properties
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => toggleTaskIcons(task.id)}>
                          {task.hideIcons ? (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Show Icons
                            </>
                          ) : (
                            <>
                              <EyeOff className="mr-2 h-4 w-4" />
                              Hide Icons
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          if (!task.description) {
                            updateTask(task.id, { description: "" });
                          }
                        }}>
                          <AlignLeft className="mr-2 h-4 w-4" />
                          Add Description
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addSubtask(task.id)}>
                          <CheckSquare className="mr-2 h-4 w-4" />
                          Add Subtask
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openReferencesPanel(task.id)}>
                          <Paperclip className="mr-2 h-4 w-4" />
                          Attachments
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => deleteTask(task.id)} className="text-red-600">
                          <X className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={addTask}
            className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            <Plus className="h-3 w-3" /> Add task
          </button>
        </div>
      )}
      {projectId && !isTempBlock && (
        <ReferencePicker
          isOpen={isReferenceDialogOpen}
          projectId={projectId}
          workspaceId={workspaceId}
          initialQuery={referenceInitialQuery}
          variant={referenceAnchorRect ? "popover" : "dialog"}
          anchorRect={referenceAnchorRect}
          autoFocus={!referenceAnchorRect}
          onQueryChange={setReferenceCurrentQuery}
          onClose={() => {
            setIsReferenceDialogOpen(false);
            setInlineReference(null);
            setReferenceInitialQuery("");
            setReferenceCurrentQuery("");
            setReferenceAnchorRect(null);
            setReferenceTaskId(null);
            setReferenceSubtaskId(null);
          }}
          onSelect={async (item) => {
            if (referenceTaskId) {
              const result = await createReferenceMutation.mutateAsync({
                taskId: referenceTaskId,
                referenceType: item.referenceType,
                referenceId: item.id,
                tableId: null,
              });
              if ("error" in result) {
                console.error("Failed to create reference:", result.error);
                return false;
              }
              if (inlineReference && String(referenceTaskId) === inlineReference.taskId) {
                const href = getLinkableItemHref({
                  referenceType: item.referenceType,
                  id: item.id,
                  tabId: item.tabId,
                  projectId: item.projectId,
                  isWorkflow: item.isWorkflow,
                });
                if (href) {
                  const label = `@${item.name}`;
                  const markdown = `[${label}](${href})`;
                  const start = inlineReference.cursor;
                  // Replace "@" + search query (currentQuery or initialQuery as fallback)
                  const query = referenceCurrentQuery || referenceInitialQuery || "";
                  const end = start + 1 + query.length; // "@" + query length
                  const next =
                    editingTaskText.slice(0, start) +
                    markdown +
                    editingTaskText.slice(end);
                  setEditingTaskText(next);
                  requestAnimationFrame(() => {
                    if (editingTaskInputRef.current) {
                      const pos = start + markdown.length;
                      editingTaskInputRef.current.focus();
                      editingTaskInputRef.current.setSelectionRange(pos, pos);
                    }
                  });
                }
                setInlineReference(null);
                setReferenceInitialQuery("");
                setReferenceCurrentQuery("");
              }
              return true;
            }

            if (referenceSubtaskId) {
              const result = await createSubtaskReferenceMutation.mutateAsync({
                subtaskId: referenceSubtaskId,
                referenceType: item.referenceType,
                referenceId: item.id,
                tableId: null,
              });
              if ("error" in result) {
                console.error("Failed to create subtask reference:", result.error);
                return false;
              }
              return true;
            }

            return false;
          }}
        />
      )}
      {propertiesTarget && workspaceId && (
        <PropertyMenu
          open={propertiesOpen}
          onOpenChange={(open) => {
            setPropertiesOpen(open);
            if (!open) {
              setPropertiesTarget(null);
            }
          }}
          entityType={propertiesTarget.type}
          entityId={propertiesTarget.id}
          workspaceId={workspaceId}
          entityTitle={propertiesTarget.title}
          disabledFields={
            propertiesTarget.type === "task" && propertiesTargetTask?.subtasks?.length
              ? { status: true, assignees: true }
              : undefined
          }
        />
      )}
    </div>
  );
}

function TaskReferences({
  taskId,
  onAdd,
  disabled,
}: {
  taskId: string;
  onAdd: () => void;
  disabled?: boolean;
}) {
  const { data: references = [] } = useTaskReferences(taskId);
  const deleteReferenceMutation = useDeleteTaskReference(taskId);

  if (references.length === 0 && !disabled) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
          <span>Attachments</span>
          <button
            type="button"
            onClick={onAdd}
            className="text-[var(--foreground)] hover:opacity-80"
          >
            Add
          </button>
        </div>
        <div className="rounded-[6px] border border-dashed border-[var(--border)] px-2.5 py-2 text-xs text-[var(--muted-foreground)]">
          No attachments yet.
        </div>
      </div>
    );
  }

  if (disabled) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
        <span>Attachments</span>
        <button
          type="button"
          onClick={onAdd}
          className="text-[var(--foreground)] hover:opacity-80"
        >
          Add
        </button>
      </div>
      {references.length === 0 ? (
        <div className="rounded-[6px] border border-dashed border-[var(--border)] px-2.5 py-2 text-xs text-[var(--muted-foreground)]">
          No attachments yet.
        </div>
      ) : (
        <div className="space-y-2">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="flex items-center justify-between rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs"
            >
              <div>
                <div className="font-medium text-[var(--foreground)]">{ref.title}</div>
                <div className="text-[10px] uppercase text-[var(--muted-foreground)]">
                  {ref.type_label || ref.reference_type}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteReferenceMutation.mutateAsync(ref.id)}
                className="text-[var(--tertiary-foreground)] hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubtaskReferences({
  subtaskId,
  onAdd,
  disabled,
}: {
  subtaskId: string;
  onAdd: () => void;
  disabled?: boolean;
}) {
  const { data: references = [] } = useSubtaskReferences(disabled ? undefined : subtaskId);
  const deleteReferenceMutation = useDeleteSubtaskReference(subtaskId);

  if (references.length === 0 && !disabled) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
          <span>Attachments</span>
          <button
            type="button"
            onClick={onAdd}
            className="text-[var(--foreground)] hover:opacity-80"
          >
            Add
          </button>
        </div>
        <div className="rounded-[6px] border border-dashed border-[var(--border)] px-2.5 py-2 text-xs text-[var(--muted-foreground)]">
          No attachments yet.
        </div>
      </div>
    );
  }

  if (disabled) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
        <span>Attachments</span>
        <button
          type="button"
          onClick={onAdd}
          className="text-[var(--foreground)] hover:opacity-80"
        >
          Add
        </button>
      </div>
      {references.length === 0 ? (
        <div className="rounded-[6px] border border-dashed border-[var(--border)] px-2.5 py-2 text-xs text-[var(--muted-foreground)]">
          No attachments yet.
        </div>
      ) : (
        <div className="space-y-2">
          {references.map((ref) => (
            <div
              key={ref.id}
              className="flex items-center justify-between rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs"
            >
              <div>
                <div className="font-medium text-[var(--foreground)]">{ref.title}</div>
                <div className="text-[10px] uppercase text-[var(--muted-foreground)]">
                  {ref.type_label || ref.reference_type}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteReferenceMutation.mutateAsync(ref.id)}
                className="text-[var(--tertiary-foreground)] hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
