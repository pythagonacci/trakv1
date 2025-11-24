"use client";

import { useState, useEffect, useRef } from "react";
import { 
  CheckCircle2, Circle, Clock, User, Calendar, Plus, X, ChevronDown, MoreVertical,
  Flag, Tag, AlignLeft, CheckSquare, Paperclip, MessageSquare, Repeat, Users, ChevronRight,
  Eye, EyeOff, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Block } from "@/app/actions/block";
import { updateBlock } from "@/app/actions/block";
import { getWorkspaceMembers } from "@/app/actions/workspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

interface Task {
  id: string | number;
  text: string;
  status: "todo" | "in-progress" | "done";
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  assignees?: string[];
  dueDate?: string;
  dueTime?: string;
  startDate?: string;
  tags?: string[];
  description?: string;
  subtasks?: { id: string | number; text: string; completed: boolean }[];
  attachments?: { id: string | number; name: string; url: string; type: string }[];
  comments?: { id: string | number; author: string; text: string; timestamp: string }[];
  recurring?: {
    enabled: boolean;
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
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
      await updateTask(task.id, { description: finalValue || undefined });
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
            await updateTask(task.id, { description: undefined });
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
  scrollToTaskId?: string | null;
}

export default function TaskBlock({ block, onUpdate, workspaceId, scrollToTaskId }: TaskBlockProps) {
  const content = (block.content || {}) as { title?: string; tasks?: Task[]; hideIcons?: boolean };
  const title = content.title || "Task list";
  const tasks = content.tasks || [];
  const initialGlobalHideIcons = content.hideIcons || false;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [globalHideIcons, setGlobalHideIcons] = useState(initialGlobalHideIcons);
  const [editingTaskId, setEditingTaskId] = useState<string | number | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string | number, { description?: boolean; subtasks?: boolean; comments?: boolean }>>({});
  const [newComment, setNewComment] = useState<Record<string | number, string>>({});
  const [newTagInput, setNewTagInput] = useState("");
  const dateInputRefs = useRef<Record<string | number, HTMLInputElement | null>>({});
  const timeInputRefs = useRef<Record<string | number, HTMLInputElement | null>>({});
  
  // Helper function to format date with smart labels
  const formatDueDate = (dueDate: string | undefined, dueTime: string | undefined): string => {
    if (!dueDate) return "";
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const taskDate = new Date(dueDate + 'T00:00:00'); // Ensure we're comparing dates only
    taskDate.setHours(0, 0, 0, 0);
    
    const todayTime = today.getTime();
    const tomorrowTime = tomorrow.getTime();
    const taskTime = taskDate.getTime();
    
    let dateLabel: string;
    if (taskTime === todayTime) {
      dateLabel = "Today";
    } else if (taskTime === tomorrowTime) {
      dateLabel = "Tomorrow";
    } else {
      dateLabel = taskDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    
    if (dueTime) {
      // Format time - dueTime should be in HH:MM format (24-hour)
      try {
        const [hours, minutes] = dueTime.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const period = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
          const formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
          return `${dateLabel} ${formattedTime}`;
        }
      } catch (e) {
        // If time parsing fails, just return date
      }
    }
    
    return dateLabel;
  };
  
  // Common tag options (these are just suggestions)
  const commonTags = [
    { name: "Bug", color: "#ef4444" },
    { name: "Feature", color: "#3b82f6" },
    { name: "Design", color: "#a855f7" },
    { name: "Frontend", color: "#06b6d4" },
    { name: "Backend", color: "#10b981" },
    { name: "Urgent", color: "#f97316" },
    { name: "Research", color: "#8b5cf6" },
  ];
  
  // Get all unique tags used across all tasks (for displaying in dropdown)
  const allUsedTags = Array.from(new Set(tasks.flatMap(t => t.tags || [])));

  // Stay in sync if title changes externally
  useEffect(() => {
    setTitleValue(title);
  }, [title]);

  // Stay in sync if hideIcons changes externally
  useEffect(() => {
    setGlobalHideIcons(content.hideIcons || false);
  }, [content.hideIcons]);

  useEffect(() => {
    const loadMembers = async () => {
      const result = await getWorkspaceMembers(workspaceId);
      if (result.data) {
        setMembers(result.data);
      }
    };
    loadMembers();
  }, [workspaceId]);


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
    const newTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      if (task.status === "todo") return { ...task, status: "in-progress" } as Task;
      if (task.status === "in-progress") return { ...task, status: "done" } as Task;
      return { ...task, status: "todo" } as Task;
    });

    // Skip database update if block has temporary ID (not yet saved)
    if (block.id.startsWith("temp-")) {
      onUpdate?.({
        ...block,
        content: { ...content, tasks: newTasks },
        updated_at: new Date().toISOString(),
      });
      return;
    }

    const result = await updateBlock({
      blockId: block.id,
      content: { ...content, tasks: newTasks },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else {
      onUpdate?.();
    }
  };

  const setTaskStatus = async (taskId: string | number, status: Task["status"]) => {
    const newTasks = tasks.map((task) => (task.id === taskId ? { ...task, status } : task));
    
    // Skip database update if block has temporary ID (not yet saved)
    if (block.id.startsWith("temp-")) {
      onUpdate?.({
        ...block,
        content: { ...content, tasks: newTasks },
        updated_at: new Date().toISOString(),
      });
      return;
    }

    const result = await updateBlock({
      blockId: block.id,
      content: { ...content, tasks: newTasks },
    });
    if (result.data) {
      onUpdate?.(result.data);
    } else {
      onUpdate?.();
    }
  };

  const addTask = async () => {
    const newTask: Task = {
      id: Date.now(),
      text: "New task",
      status: "todo",
    };
    const newTasks = [...tasks, newTask];
    const updatedContent = { ...content, tasks: newTasks };

    // Optimistically update UI
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
      console.error("Failed to add task:", result.error);
      // Keep optimistic state so the task doesn't vanish; rely on next refresh to realign if needed
    }
  };

  const deleteTask = async (taskId: string | number) => {
    const newTasks = tasks.filter((task) => task.id !== taskId);
    const updatedContent = { ...content, tasks: newTasks };

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
      console.error("Failed to delete task:", result.error);
      // Keep optimistic state; next refresh will realign if needed
    }
  };

  const updateTask = async (taskId: string | number, updates: Partial<Task>) => {
    const newTasks = tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
    const updatedContent = { ...content, tasks: newTasks };

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
    
    // Pass updated block to parent for local state update (no router.refresh for inline edits)
    if (result.data) {
      onUpdate?.(result.data);
    } else if (result.error) {
      console.error("Failed to update task:", result.error);
      // Keep optimistic state to avoid flicker; next refresh will realign if needed
    }
  };

  const getStatusIcon = (status: Task["status"]) =>
    status === "done" ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
    ) : status === "in-progress" ? (
      <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    ) : (
      <Circle className="w-4 h-4 text-neutral-300 dark:text-neutral-600" />
    );
  
  const getStatusBadge = (status: Task["status"]) => {
    if (status === "in-progress") {
      return (
        <span className="inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
          <Clock className="h-2.5 w-2.5" />
          In Progress
        </span>
      );
    }
    return null;
  };

  const getPriorityColor = (priority?: Task["priority"]) => {
    switch (priority) {
      case "urgent": return "text-red-600 bg-red-50 border-red-200";
      case "high": return "text-orange-600 bg-orange-50 border-orange-200";
      case "medium": return "text-blue-600 bg-blue-50 border-blue-200";
      case "low": return "text-gray-600 bg-gray-50 border-gray-200";
      default: return "";
    }
  };

  const getPriorityLabel = (priority?: Task["priority"]) => {
    switch (priority) {
      case "urgent": return "Urgent";
      case "high": return "High";
      case "medium": return "Medium";
      case "low": return "Low";
      default: return "None";
    }
  };

  const toggleSubtask = async (taskId: string | number, subtaskId: string | number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    
    const newSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    
    await updateTask(taskId, { subtasks: newSubtasks });
  };

  const addSubtask = async (taskId: string | number) => {
    const task = tasks.find(t => t.id === taskId);
    const newSubtask = {
      id: Date.now(),
      text: "New subtask",
      completed: false,
    };
    const newSubtasks = [...(task?.subtasks || []), newSubtask];
    await updateTask(taskId, { subtasks: newSubtasks });
  };

  const updateSubtask = async (taskId: string | number, subtaskId: string | number, text: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    
    const newSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, text } : st
    );
    
    await updateTask(taskId, { subtasks: newSubtasks });
  };

  const deleteSubtask = async (taskId: string | number, subtaskId: string | number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    
    const newSubtasks = task.subtasks.filter(st => st.id !== subtaskId);
    await updateTask(taskId, { subtasks: newSubtasks });
  };

  const addComment = async (taskId: string | number) => {
    const commentText = newComment[taskId]?.trim();
    if (!commentText) return;
    
    const task = tasks.find(t => t.id === taskId);
    const comment = {
      id: Date.now(),
      author: "Current User", // TODO: Get from auth context
      text: commentText,
      timestamp: new Date().toISOString(),
    };
    const newComments = [...(task?.comments || []), comment];
    await updateTask(taskId, { comments: newComments });
    setNewComment(prev => ({ ...prev, [taskId]: "" }));
  };

  const toggleTag = async (taskId: string | number, tagName: string) => {
    const task = tasks.find(t => t.id === taskId);
    const currentTags = task?.tags || [];
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter(t => t !== tagName)
      : [...currentTags, tagName];
    await updateTask(taskId, { tags: newTags });
  };

  const toggleAssignee = async (taskId: string | number, memberName: string) => {
    const task = tasks.find(t => t.id === taskId);
    const currentAssignees = task?.assignees || [];
    const newAssignees = currentAssignees.includes(memberName)
      ? currentAssignees.filter(a => a !== memberName)
      : [...currentAssignees, memberName];
    await updateTask(taskId, { assignees: newAssignees });
  };

  const addCustomTag = async (taskId: string | number, tagName: string) => {
    const trimmedTag = tagName.trim();
    if (!trimmedTag) return;
    
    const task = tasks.find(t => t.id === taskId);
    const currentTags = task?.tags || [];
    
    // Don't add if already exists
    if (currentTags.includes(trimmedTag)) return;
    
    const newTags = [...currentTags, trimmedTag];
    await updateTask(taskId, { tags: newTags });
    setNewTagInput("");
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

  // Helper to check if icons should be shown for a task
  const shouldShowIcons = (task: Task) => {
    return !globalHideIcons && !task.hideIcons;
  };

  // Helper to check if we should show icon for assignees (always show if has value, always show if icons enabled)
  const shouldShowAssigneesIcon = (task: Task) => {
    const hasAssignees = task.assignees && task.assignees.length > 0;
    // If there's a value, always show the icon
    if (hasAssignees) return true;
    // If icons are enabled, show empty button so user can add assignees
    if (shouldShowIcons(task)) return true;
    // If icons are hidden and no value, don't show
    return false;
  };

  // Helper to check if we should show icon for date (always show if has value, always show if icons enabled)
  const shouldShowDateIcon = (task: Task) => {
    const hasDate = !!task.dueDate;
    // If there's a value, always show the icon
    if (hasDate) return true;
    // If icons are enabled, show empty button so user can add date
    if (shouldShowIcons(task)) return true;
    // If icons are hidden and no value, don't show
    return false;
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
          const hasAnyExpanded = taskSections.comments;
          const hasExtendedInfo = (task.comments && task.comments.length > 0);
          
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
              {getStatusIcon(task.status)}
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
                  onBlur={() => setEditingTaskId(null)}
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
                    task.status === "done" && "line-through text-[var(--muted-foreground)]"
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

                  {/* All Properties Row: Status, Assignee, Date, Tags */}
                  {((task.status === "in-progress") || (task.priority && task.priority !== "none") || shouldShowAssigneesIcon(task) || shouldShowDateIcon(task) || (task.assignees && task.assignees.length > 0) || task.dueDate || (task.tags && task.tags.length > 0)) && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs leading-normal">
                    {/* 1. Task Status (In Progress) */}
                    {task.status === "in-progress" && getStatusBadge(task.status)}
                    
                    {/* 2. Priority */}
                    {task.priority && task.priority !== "none" && (
                      <span className={cn("inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-xs font-medium", getPriorityColor(task.priority))}>
                        {shouldShowIcons(task) && <Flag className="h-2.5 w-2.5" />}
                        {getPriorityLabel(task.priority)}
                      </span>
                    )}
                    
                    {/* 3. Assignees */}
                    {shouldShowAssigneesIcon(task) && (
                      shouldShowIcons(task) || (task.assignees && task.assignees.length > 0) ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]">
                            <Users className="h-3 w-3" />
                            {task.assignees && task.assignees.length > 0 && (
                              <span className="text-xs font-normal text-[var(--foreground)]">
                                {task.assignees.length === 1 
                                  ? task.assignees[0].split(' ')[0] 
                                  : `${task.assignees.length}`}
                              </span>
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          {members.map((member) => (
                            <DropdownMenuItem key={member.id} onClick={() => toggleAssignee(task.id, member.name)}>
                              <input
                                type="checkbox"
                                checked={task.assignees?.includes(member.name) || false}
                                onChange={() => {}}
                                className="mr-2"
                              />
                              {member.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null
                    )}
                    

                    {/* Due Date */}
                    {shouldShowDateIcon(task) && (
                      <label className="relative inline-flex items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 cursor-pointer transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)] font-normal">
                        {task.dueDate && <Calendar className="h-3 w-3" />}
                        {task.dueDate ? (
                          <span className="text-xs font-normal text-[var(--foreground)]">
                            {formatDueDate(task.dueDate, task.dueTime)}
                          </span>
                        ) : (
                          shouldShowIcons(task) && (
                            <>
                              <Calendar className="h-3 w-3" />
                              <span className="text-xs font-normal text-[var(--muted-foreground)]">Date</span>
                            </>
                          )
                        )}
                        <input
                          type="date"
                          value={task.dueDate || ""}
                          onChange={(e) => {
                            const newDate = e.target.value || undefined;
                            // Clear time if date is cleared
                            updateTask(task.id, { 
                              dueDate: newDate,
                              dueTime: newDate ? task.dueTime : undefined
                            });
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </label>
                    )}
                    
                    {/* 4. Tags */}
                    {task.tags && task.tags.length > 0 && task.tags.map((tagName) => {
                      const tagConfig = commonTags.find(t => t.name === tagName);
                      return (
                        <span
                          key={tagName}
                          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: tagConfig ? `${tagConfig.color}15` : "#e5e7eb",
                            color: tagConfig?.color || "#6b7280",
                            border: `1px solid ${tagConfig ? `${tagConfig.color}30` : "#d1d5db"}`,
                          }}
                        >
                          {tagName}
                        </span>
                      );
                    })}
                    
              </div>
                  )}
                </div>

                {/* Hidden date/time inputs for menu access when icons are hidden */}
                {!shouldShowIcons(task) && (
                  <>
                    <input
                      ref={(el) => {
                        dateInputRefs.current[task.id] = el;
                      }}
                      type="date"
                      value={task.dueDate || ""}
                      onChange={(e) => {
                        const newDate = e.target.value || undefined;
                        // Clear time if date is cleared
                        updateTask(task.id, { 
                          dueDate: newDate,
                          dueTime: newDate ? task.dueTime : undefined
                        });
                      }}
                      className="hidden"
                    />
                    <input
                      ref={(el) => {
                        timeInputRefs.current[task.id] = el;
                      }}
                      type="time"
                      value={task.dueTime || ""}
                      onChange={(e) => updateTask(task.id, { dueTime: e.target.value || undefined })}
                      className="hidden"
                    />
                  </>
                )}

                {/* Three-dot menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-6 w-6 items-center justify-center rounded text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] flex-shrink-0">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {/* Status Section */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-[var(--muted-foreground)]">Status</div>
                    <DropdownMenuItem onClick={() => setTaskStatus(task.id, "todo")}>
                      <Circle className="mr-2 h-4 w-4 text-neutral-400" />
                      To Do
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTaskStatus(task.id, "in-progress")}>
                      <Clock className="mr-2 h-4 w-4 text-[#1d4ed8]" />
                      In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTaskStatus(task.id, "done")}>
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                      Done
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {/* Priority Section */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-[var(--muted-foreground)]">Priority</div>
                    <DropdownMenuItem onClick={() => updateTask(task.id, { priority: "urgent" })}>
                      <Flag className="mr-2 h-4 w-4 text-red-600" />
                      Urgent
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateTask(task.id, { priority: "high" })}>
                      <Flag className="mr-2 h-4 w-4 text-orange-600" />
                      High
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateTask(task.id, { priority: "medium" })}>
                      <Flag className="mr-2 h-4 w-4 text-blue-600" />
                      Medium
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateTask(task.id, { priority: "low" })}>
                      <Flag className="mr-2 h-4 w-4 text-gray-600" />
                      Low
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateTask(task.id, { priority: "none" })}>
                      <Flag className="mr-2 h-4 w-4 text-gray-400" />
                      None
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {/* Tags Section */}
                    <div className="px-2 py-1.5 text-xs font-semibold text-[var(--muted-foreground)]">Tags</div>
                    
                    {/* Create new tag input */}
                    <div className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomTag(task.id, newTagInput);
                            }
                          }}
                          placeholder="Create new tag..."
                          className="flex-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none"
                        />
            <button
                          onClick={() => addCustomTag(task.id, newTagInput)}
                          className="px-2 py-1 rounded-[4px] bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
            >
                          Add
            </button>
          </div>
                    </div>
                    
                    {/* Common/Suggested tags */}
                    {commonTags.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase text-[var(--tertiary-foreground)]">Suggested</div>
                        {commonTags.map((tag) => (
                          <DropdownMenuItem key={tag.name} onClick={() => toggleTag(task.id, tag.name)}>
                            <input
                              type="checkbox"
                              checked={task.tags?.includes(tag.name) || false}
                              onChange={() => {}}
                              className="mr-2"
                            />
                            <span style={{ color: tag.color }}>{tag.name}</span>
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                    
                    {/* Custom/Used tags (tags that aren't in common tags) */}
                    {allUsedTags.filter(tag => !commonTags.some(ct => ct.name === tag)).length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase text-[var(--tertiary-foreground)]">Custom</div>
                        {allUsedTags
                          .filter(tag => !commonTags.some(ct => ct.name === tag))
                          .map((tag) => (
                            <DropdownMenuItem key={tag} onClick={() => toggleTag(task.id, tag)}>
                              <input
                                type="checkbox"
                                checked={task.tags?.includes(tag) || false}
                                onChange={() => {}}
                                className="mr-2"
                              />
                              <span className="text-[var(--foreground)]">{tag}</span>
                            </DropdownMenuItem>
                          ))}
                      </>
                    )}
                    
                    <DropdownMenuSeparator />
                    
                    {/* Assign and Date - Only show when icons are hidden */}
                    {!shouldShowIcons(task) && (
                      <>
                        {/* Assign Submenu */}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Users className="mr-2 h-4 w-4" />
                            Assign
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {members.map((member) => (
                              <DropdownMenuItem key={member.id} onClick={() => toggleAssignee(task.id, member.name)}>
                                <input
                                  type="checkbox"
                                  checked={task.assignees?.includes(member.name) || false}
                                  onChange={() => {}}
                                  className="mr-2"
                                />
                                {member.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        
                        {/* Add Date Menu Item */}
                        <DropdownMenuItem 
                          onSelect={(e) => {
                            e.preventDefault();
                            // Small delay to ensure menu doesn't close before input opens
                            setTimeout(() => {
                              const dateInput = dateInputRefs.current[task.id];
                              if (dateInput) {
                                if ('showPicker' in HTMLInputElement.prototype) {
                                  dateInput.showPicker();
                                } else {
                                  dateInput.focus();
                                  dateInput.click();
                                }
                              }
                            }, 100);
                          }}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {task.dueDate ? 'Change date' : 'Add date'}
                        </DropdownMenuItem>
                        {task.dueDate && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimeout(() => {
                                const timeInput = timeInputRefs.current[task.id];
                                if (timeInput) {
                                  if ('showPicker' in HTMLInputElement.prototype) {
                                    timeInput.showPicker();
                                  } else {
                                    timeInput.focus();
                                    timeInput.click();
                                  }
                                }
                              }, 100);
                            }}
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            {task.dueTime ? 'Change time' : 'Add time'}
                          </DropdownMenuItem>
                        )}
                        
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
    </div>
  );
}
