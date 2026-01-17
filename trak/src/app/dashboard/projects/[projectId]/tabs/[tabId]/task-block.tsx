"use client";

import { useState, useEffect, useRef } from "react";
import { 
  CheckCircle2, Circle, Clock, User, Plus, X, ChevronDown, MoreVertical,
  Flag, Users, Calendar, Tag, AlignLeft, CheckSquare, Paperclip, MessageSquare, ChevronRight,
  Eye, EyeOff, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import {
  useTaskItems,
  useCreateTaskItem,
  useUpdateTaskItem,
  useDeleteTaskItem,
  useTaskSubtasks,
  useTaskComments,
  useTaskReferences,
  useCreateTaskReference,
  useDeleteTaskReference,
} from "@/lib/hooks/use-task-queries";
import ReferencePicker from "@/components/timelines/reference-picker";
import { useTheme } from "@/app/dashboard/theme-context";
import { PropertyBadges, PropertyMenu } from "@/components/properties";
import {
  useEntitiesProperties,
  useEntityPropertiesWithInheritance,
  useSetEntityPropertiesForType,
  useWorkspaceMembers,
} from "@/lib/hooks/use-property-queries";
import { PRIORITY_COLORS, PRIORITY_OPTIONS } from "@/types/properties";
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
  status: "todo" | "in-progress" | "done";
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
    const member = members.find((m) => m.id === assigneeId);
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

interface TaskBlockProps {
  block: Block;
  onUpdate?: (updatedBlock?: Block) => void;
  workspaceId: string;
  projectId?: string;
  scrollToTaskId?: string | null;
}

export default function TaskBlock({ block, onUpdate, workspaceId, projectId, scrollToTaskId }: TaskBlockProps) {
  const { theme } = useTheme();
  const content = (block.content || {}) as { title?: string; tasks?: Task[]; hideIcons?: boolean };
  const title = content.title || "Task list";
  const isTempBlock = block.id.startsWith("temp-");
  const { data: serverTasks = [] } = useTaskItems(block.id, { enabled: !isTempBlock });
  const tasks = isTempBlock ? (content.tasks || []) : (serverTasks as Task[]);
  const initialGlobalHideIcons = content.hideIcons || false;

  const { data: workspaceMembers = [] } = useWorkspaceMembers(workspaceId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [globalHideIcons, setGlobalHideIcons] = useState(initialGlobalHideIcons);
  const [editingTaskId, setEditingTaskId] = useState<string | number | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string | number, { description?: boolean; subtasks?: boolean; comments?: boolean; references?: boolean }>>({});
  const [newComment, setNewComment] = useState<Record<string | number, string>>({});
  const [referenceTaskId, setReferenceTaskId] = useState<string | null>(null);
  const [isReferenceDialogOpen, setIsReferenceDialogOpen] = useState(false);
  const [propertiesTaskId, setPropertiesTaskId] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);

  const propertiesTask = propertiesTaskId ? tasks.find((t) => String(t.id) === propertiesTaskId) : undefined;

  const createTaskMutation = useCreateTaskItem(block.id);
  const updateTaskMutation = useUpdateTaskItem(block.id);
  const deleteTaskMutation = useDeleteTaskItem(block.id);
  const subtaskMutations = useTaskSubtasks(block.id);
  const commentMutations = useTaskComments(block.id);
  const createReferenceMutation = useCreateTaskReference(referenceTaskId || undefined);
  
  // Universal properties for tasks (status/priority/assignee/due/tags)
  const taskIds = tasks.map((t) => String(t.id));
  const { data: taskPropertiesById = {} } = useEntitiesProperties("task", taskIds, workspaceId);
  const setTaskProperties = useSetEntityPropertiesForType("task", workspaceId);
  
  // Stay in sync if title changes externally
  useEffect(() => {
    setTitleValue(title);
  }, [title]);

  // Stay in sync if hideIcons changes externally
  useEffect(() => {
    setGlobalHideIcons(content.hideIcons || false);
  }, [content.hideIcons]);

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
    const existing = taskPropertiesById[taskIdStr];
    const currentStatus =
      existing?.status ??
      (tasks.find((t) => String(t.id) === taskIdStr)?.status === "in-progress"
        ? "in_progress"
        : tasks.find((t) => String(t.id) === taskIdStr)?.status === "done"
        ? "done"
        : "todo");

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
      <div className="space-y-1.5">
        {tasks.map((task: Task) => {
          const taskSections = expandedSections[task.id] || {};
          const hasAnyExpanded = taskSections.comments || taskSections.references;
          const hasExtendedInfo = (task.comments && task.comments.length > 0) || taskSections.references;
          const taskEntityId = typeof task.id === "string" ? task.id : null;
          const canUseProperties = Boolean(taskEntityId) && !isTempBlock && Boolean(workspaceId);
          const taskDirectProps = taskPropertiesById[String(task.id)];
          const effectiveStatus =
            taskDirectProps?.status ??
            (task.status === "in-progress"
              ? "in_progress"
              : task.status === "done"
              ? "done"
              : "todo");
          const isDone = effectiveStatus === "done";
          const effectivePriority = taskDirectProps?.priority ?? null;
          const effectiveAssigneeId = taskDirectProps?.assignee_id ?? null;
          const effectiveDueDate = taskDirectProps?.due_date ?? null;
          const showInlineIcons =
            shouldShowIcons(task) ||
            Boolean(effectivePriority || effectiveAssigneeId || effectiveDueDate);
          
          return (
            <div
              id={`task-${task.id}`}
              key={task.id}
              className="group rounded-[6px] bg-[var(--surface)] transition-all duration-150 ease-out"
            >
              {/* Main Task Row */}
              <div className="flex items-start gap-2 px-2.5 py-1.5">
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
                              "inline-flex items-center justify-center rounded-[2px] px-1.5 py-0.5 transition-colors",
                              effectivePriority
                                ? PRIORITY_COLORS[effectivePriority]
                                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                            )}
                            title={
                              effectivePriority
                                ? `Priority: ${PRIORITY_OPTIONS.find((o) => o.value === effectivePriority)?.label ?? effectivePriority}`
                                : "Set priority"
                            }
                          >
                            <Flag className="h-3 w-3" />
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
                              "inline-flex items-center justify-center rounded-[2px] px-1.5 py-0.5 transition-colors",
                              effectiveAssigneeId
                                ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                            )}
                            title={
                              effectiveAssigneeId
                                ? `Assignee: ${
                                    workspaceMembers.find((m) => m.id === effectiveAssigneeId)?.name ||
                                    workspaceMembers.find((m) => m.id === effectiveAssigneeId)?.email ||
                                    "Assigned"
                                  }`
                                : "Assign"
                            }
                          >
                            <Users className="h-3 w-3" />
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
                              key={m.id}
                              onClick={() =>
                                setTaskProperties.mutate({
                                  entityId: taskEntityId,
                                  updates: { assignee_id: m.id },
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
                          "relative inline-flex items-center justify-center rounded-[2px] px-1.5 py-0.5 transition-colors cursor-pointer",
                          effectiveDueDate
                            ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                        )}
                        title={effectiveDueDate ? `Due: ${effectiveDueDate}` : "Set due date"}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <Calendar className="h-3 w-3" />
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
          className="inline-flex items-center gap-1 rounded-[6px] border border-dashed border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
        >
          <Plus className="h-3 w-3" /> Add task
        </button>
      </div>
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
