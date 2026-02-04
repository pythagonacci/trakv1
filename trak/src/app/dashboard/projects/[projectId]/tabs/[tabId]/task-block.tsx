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
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import {
  useTaskItems,
  useCreateTaskItem,
  useUpdateTaskItem,
  useDeleteTaskItem,
  useReorderTaskItems,
  useTaskSubtasks,
  useTaskComments,
  useTaskReferences,
  useCreateTaskReference,
  useDeleteTaskReference,
} from "@/lib/hooks/use-task-queries";
import ReferencePicker from "@/components/timelines/reference-picker";
import { PropertyBadges, PropertyMenu } from "@/components/properties";
import {
  useEntitiesProperties,
  useEntityPropertiesWithInheritance,
  useSetEntityPropertiesForType,
  useWorkspaceMembers,
} from "@/lib/hooks/use-property-queries";
import { PRIORITY_COLORS, PRIORITY_OPTIONS, STATUS_OPTIONS, type EntityProperties, type Status } from "@/types/properties";
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

interface Task {
  id: string | number;
  text: string;
  status: "todo" | "in-progress" | "done" | "blocked";
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  assignees?: string[];
  dueDate?: string | null;
  dueTime?: string | null;
  startDate?: string | null;
  tags?: string[];
  description?: string | null;
  subtasks?: { id: string | number; text: string; completed: boolean }[];
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

function TaskPropertyBadges({
  entityId,
  onOpen,
  workspaceId,
}: {
  entityId: string;
  onOpen: () => void;
  workspaceId: string;
}) {
  const { data: propertiesResult } = useEntityPropertiesWithInheritance("task", entityId);
  const { data: members = [] } = useWorkspaceMembers(workspaceId);

  const direct = propertiesResult?.direct;
  const inherited = propertiesResult?.inherited?.filter((inh) => inh.visible) ?? [];

  // Get member name for assignee badge
  const getMemberName = (assigneeId: string | null) => {
    if (!assigneeId) return undefined;
    const member = members.find((m) => m.id === assigneeId || m.user_id === assigneeId);
    return member?.name || member?.email;
  };

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {direct && (
        <PropertyBadges
          properties={direct}
          onClick={onOpen}
          memberName={getMemberName(direct.assignee_id)}
        />
      )}
      {inherited.map((inh) => (
        <PropertyBadges
          key={`inherited-${inh.source_entity_id}`}
          properties={inh.properties}
          inherited
          onClick={onOpen}
          memberName={getMemberName(inh.properties.assignee_id)}
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
  const [newComment, setNewComment] = useState<Record<string | number, string>>({});
  const [referenceTaskId, setReferenceTaskId] = useState<string | null>(null);
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
  const [propertiesTaskId, setPropertiesTaskId] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [propertyOverrides, setPropertyOverrides] = useState<Record<string, Partial<EntityProperties>>>({});

  const propertiesTask = propertiesTaskId ? tasks.find((t) => String(t.id) === propertiesTaskId) : undefined;

  const createTaskMutation = useCreateTaskItem(block.id);
  const updateTaskMutation = useUpdateTaskItem(block.id);
  const deleteTaskMutation = useDeleteTaskItem(block.id);
  const reorderTaskMutation = useReorderTaskItems(block.id);
  const subtaskMutations = useTaskSubtasks(block.id);
  const commentMutations = useTaskComments(block.id);
  const createReferenceMutation = useCreateTaskReference(referenceTaskId || undefined);
  
  // Universal properties for tasks (status/priority/assignee/due/tags)
  const taskIds = tasks.map((t) => String(t.id));
  const { data: taskPropertiesById = {} } = useEntitiesProperties("task", taskIds, workspaceId);
  const setTaskProperties = useSetEntityPropertiesForType("task", workspaceId);

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

  const taskMapById = useMemo(() => {
    return new Map(orderedTasks.map((task) => [String(task.id), task]));
  }, [orderedTasks]);

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

  const getEffectiveStatus = (taskId: string, task: Task) => {
    const props = getEffectiveProperties(taskId, task);
    return props?.status || statusFromLegacy(task.status);
  };

  const getEffectivePriority = (taskId: string, task: Task) => {
    const props = getEffectiveProperties(taskId, task);
    const raw = props?.priority ?? task.priority ?? "none";
    return raw === "none" ? null : raw;
  };

  const getEffectiveAssigneeId = (taskId: string, task: Task) => {
    const props = getEffectiveProperties(taskId, task);
    return props?.assignee_id ?? null;
  };

  const getEffectiveDueDate = (taskId: string, task: Task) => {
    const props = getEffectiveProperties(taskId, task);
    return props?.due_date ?? task.dueDate ?? null;
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
      if (column.groupBy === "assignee") updates.assignee_id = column.assigneeId ?? null;
      if (column.groupBy === "dueDate") updates.due_date = dueDateValue;
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
    await subtaskMutations.update.mutateAsync({
      subtaskId: String(subtaskId),
      updates: { completed: !subtask.completed },
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

  const updateSubtask = async (taskId: string | number, subtaskId: string | number, text: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    if (isTempBlock) {
      const newSubtasks = task.subtasks.map(st =>
        st.id === subtaskId ? { ...st, text } : st
      );
      await updateTask(taskId, { subtasks: newSubtasks });
      return;
    }
    await subtaskMutations.update.mutateAsync({
      subtaskId: String(subtaskId),
      updates: { title: text },
    });
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

  const updateTaskStatus = async (taskId: string, nextStatus: Status) => {
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

  const updateTaskAssignee = async (taskId: string, assigneeId: string | null) => {
    applyPropertyOverride(taskId, { assignee_id: assigneeId });
    await setTaskProperties.mutateAsync({
      entityId: taskId,
      updates: { assignee_id: assigneeId },
    });
  };

  const updateTaskDueDate = async (taskId: string, dueDate: string | null) => {
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

    if (isTempBlock) {
      if (column.groupBy === "status" && column.value) {
        await updateTask(taskId, { status: legacyFromStatus(column.value as Status) });
      }
      if (column.groupBy === "priority") {
        await updateTask(taskId, { priority: (column.value || "none") as Task["priority"] });
      }
      if (column.groupBy === "assignee") {
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
        await updateTaskStatus(taskId, column.value as Status);
      } else if (column.groupBy === "priority") {
        await updateTaskPriority(taskId, column.value);
      } else if (column.groupBy === "assignee") {
        await updateTaskAssignee(taskId, column.assigneeId ?? null);
      } else if (column.groupBy === "dueDate") {
        await updateTaskDueDate(taskId, resolveDueDateFromBucket(column.dueBucket));
      } else if (column.groupBy === "tags") {
        await updateTaskTags(taskId, column.value ? [column.value] : []);
      }
    } catch (error) {
      console.error("Failed to update task from board drag:", error);
    }
  };

  const getDueBucket = (dueDate?: string | null): BoardColumn["dueBucket"] => {
    if (!dueDate) return "no_date";
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const due = new Date(dueDate);
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
        const effectiveAssigneeId = getEffectiveAssigneeId(taskId, task);
        const normalizedAssigneeId = normalizeAssigneeId(effectiveAssigneeId);
        if (normalizedAssigneeId) {
          assigneeIds.add(normalizedAssigneeId);
        } else if (task.assignees && task.assignees.length > 0) {
          assigneeNames.add(task.assignees[0]);
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

  const openReferencePicker = (taskId: string | number) => {
    openReferencesPanel(taskId);
    setReferenceTaskId(String(taskId));
    setIsReferenceDialogOpen(true);
  };

  // Helper to check if icons should be shown for a task
  const shouldShowIcons = (task: Task) => {
    return !globalHideIcons && !task.hideIcons;
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
      {viewMode === "list" ? (
      <div className="space-y-2">
        {orderedTasks.map((task: Task) => {
          const taskSections = expandedSections[task.id] || {};
          const hasAnyExpanded = taskSections.comments || taskSections.references;
          const hasExtendedInfo = (task.comments && task.comments.length > 0) || taskSections.references;
          const taskEntityId = typeof task.id === "string" ? task.id : null;
          const canUseProperties = Boolean(taskEntityId) && !isTempBlock && Boolean(workspaceId);
          const effectiveStatus = getEffectiveStatus(String(task.id), task);
          const isDone = effectiveStatus === "done";
          const effectivePriority = getEffectivePriority(String(task.id), task);
          const effectiveAssigneeId = getEffectiveAssigneeId(String(task.id), task);
          const effectiveDueDate = getEffectiveDueDate(String(task.id), task);
          const priorityLabel = effectivePriority
            ? PRIORITY_OPTIONS.find((o) => o.value === effectivePriority)?.label ?? effectivePriority
            : null;
          const assigneeMember = getWorkspaceMember(effectiveAssigneeId);
          const assigneeName = effectiveAssigneeId
            ? assigneeMember?.name || assigneeMember?.email || "Assigned"
            : null;
          const dueDateLabel = effectiveDueDate || null;
          const showInlineIcons =
            shouldShowIcons(task) ||
            Boolean(effectivePriority || effectiveAssigneeId || effectiveDueDate);
          
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
                toggleTask(task.id);
              }}
                  className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:border-[var(--foreground)] flex-shrink-0 cursor-pointer"
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
                toggleTask(task.id);
              }}
                  className="mt-0.5 flex h-5 w-5 items-center justify-center flex-shrink-0 cursor-pointer"
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
                  type="text"
                  value={editingTaskText}
                  onChange={(e) => setEditingTaskText(e.target.value)}
                  onBlur={() => {
                    updateTask(task.id, { text: editingTaskText });
                    setEditingTaskId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateTask(task.id, { text: editingTaskText });
                      setEditingTaskId(null);
                    }
                    if (e.key === "Escape") setEditingTaskId(null);
                  }}
                  autoFocus
                  className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--foreground)] shadow-sm focus:outline-none"
                />
              ) : (
                    <div className="flex items-start gap-1.5">
                <div
                  onClick={() => {
                    setEditingTaskId(task.id);
                    setEditingTaskText(task.text);
                  }}
                  className={cn(
                          "flex-1 cursor-text text-xs font-normal leading-normal text-[var(--foreground)] transition-colors hover:text-[var(--foreground)]",
                    isDone && "line-through text-[var(--muted-foreground)]"
                  )}
                >
                  {task.text}
                </div>
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

                  {/* Subtasks - Inline Display */}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="pl-3 space-y-0.5">
                      {task.subtasks.map((subtask) => (
                        <div key={subtask.id} className="flex items-center gap-1.5 group/subtask">
                          <button
                            onClick={() => deleteSubtask(task.id, subtask.id)}
                            className="opacity-0 group-hover/subtask:opacity-100 text-[var(--tertiary-foreground)] hover:text-red-500 flex-shrink-0 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <input
                            type="checkbox"
                            checked={subtask.completed}
                            onChange={() => toggleSubtask(task.id, subtask.id)}
                            className="rounded-full border-[var(--border)] h-3 w-3 flex-shrink-0"
                          />
                          <input
                            type="text"
                            value={subtask.text}
                            onChange={(e) => updateSubtask(task.id, subtask.id, e.target.value)}
                            className={cn(
                              "flex-1 text-xs bg-transparent border-none outline-none text-[var(--foreground)] py-0.5",
                              subtask.completed && "line-through text-[var(--muted-foreground)]"
                            )}
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => addSubtask(task.id)}
                        className="flex items-center gap-0.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-0.5 ml-[14px]"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        Add subtask
                      </button>
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

                      {/* Assignee */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 transition-colors",
                              effectiveAssigneeId
                                ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--secondary)] hover:text-[var(--foreground)]"
                            )}
                            title={
                              assigneeName ? `Assignee: ${assigneeName}` : "Assign"
                            }
                          >
                            <Users className="h-3 w-3" />
                            {assigneeName && <span className="max-w-[140px] truncate">{assigneeName}</span>}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={() =>
                              setTaskProperties.mutate({
                                entityId: taskEntityId,
                                updates: { assignee_id: null },
                              })
                            }
                          >
                            Unassigned
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {workspaceMembers.map((m) => (
                            <DropdownMenuItem
                              key={m.user_id}
                              onClick={() =>
                                setTaskProperties.mutate({
                                  entityId: taskEntityId,
                                  updates: { assignee_id: m.user_id },
                                })
                              }
                            >
                              {m.name || m.email}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Due Date */}
                      <label
                        className={cn(
                          "relative inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 transition-colors cursor-pointer",
                          effectiveDueDate
                            ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                        )}
                        title={effectiveDueDate ? `Due: ${effectiveDueDate}` : "Set due date"}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <Calendar className="h-3 w-3" />
                        {dueDateLabel && <span className="max-w-[110px] truncate">{dueDateLabel}</span>}
                        <input
                          type="date"
                          value={effectiveDueDate || ""}
                          onChange={(e) => {
                            const newDate = e.target.value || null;
                            setTaskProperties.mutate({
                              entityId: taskEntityId,
                              updates: { due_date: newDate },
                            });
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* When icons are hidden, show compact universal property badges instead */}
                {canUseProperties && taskEntityId && !shouldShowIcons(task) && (
                  <TaskPropertyBadges
                    entityId={taskEntityId}
                    workspaceId={workspaceId}
                    onOpen={() => {
                      setPropertiesTaskId(taskEntityId);
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
                            setPropertiesTaskId(taskEntityId);
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
      ) : (
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
                        const effectiveAssigneeId = getEffectiveAssigneeId(taskId, task);
                        const effectiveDueDate = getEffectiveDueDate(taskId, task);
                        const effectiveTags = getEffectiveTags(taskId, task);
                        const assigneeMember = getWorkspaceMember(effectiveAssigneeId);
                        const assigneeName =
                          (effectiveAssigneeId &&
                            (assigneeMember?.name || assigneeMember?.email)) ||
                          task.assignees?.[0];
                        const assigneeInitial = assigneeName ? assigneeName.trim()[0]?.toUpperCase() : "?";

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
                        const showAssignee = Boolean(assigneeName) && boardGroupBy !== "assignee";
                        const showDueDate = Boolean(effectiveDueDate) && boardGroupBy !== "dueDate";
                        const showTags = effectiveTags.length > 0 && boardGroupBy !== "tags";

                        const title =
                          editingTaskId === task.id ? (
                            <input
                              type="text"
                              value={editingTaskText}
                              onChange={(e) => setEditingTaskText(e.target.value)}
                              onBlur={() => {
                                updateTask(task.id, { text: editingTaskText });
                                setEditingTaskId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateTask(task.id, { text: editingTaskText });
                                  setEditingTaskId(null);
                                }
                                if (e.key === "Escape") setEditingTaskId(null);
                              }}
                              autoFocus
                              className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--foreground)] shadow-sm focus:outline-none"
                            />
                          ) : (
                            <div
                              onClick={() => {
                                setEditingTaskId(task.id);
                                setEditingTaskText(task.text);
                              }}
                              className={cn(
                                "cursor-text text-xs font-normal leading-normal text-[var(--foreground)] transition-colors hover:text-[var(--foreground)]",
                                effectiveStatus === "done" && "line-through text-[var(--muted-foreground)]"
                              )}
                            >
                              {task.text}
                            </div>
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

                        const assigneeBadge = assigneeName ? (
                          <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--foreground)]">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[9px] font-semibold">
                              {assigneeInitial}
                            </span>
                            {assigneeName}
                          </span>
                        ) : null;

                        const dueDateBadge = effectiveDueDate ? (
                          <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--foreground)]">
                            <Calendar className="h-3 w-3" />
                            {effectiveDueDate}
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
                                      setPropertiesTaskId(taskEntityId);
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
                            onToggleStatus={() => toggleTask(task.id)}
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
      )}
      {projectId && !isTempBlock && (
        <ReferencePicker
          isOpen={isReferenceDialogOpen}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={() => setIsReferenceDialogOpen(false)}
          onSelect={async (item) => {
            if (!referenceTaskId) return false;
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
            return true;
          }}
        />
      )}
      {propertiesTaskId && workspaceId && (
        <PropertyMenu
          open={propertiesOpen}
          onOpenChange={(open) => {
            setPropertiesOpen(open);
            if (!open) {
              setPropertiesTaskId(null);
            }
          }}
          entityType="task"
          entityId={propertiesTaskId}
          workspaceId={workspaceId}
          entityTitle={propertiesTask?.text ?? "Task"}
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
