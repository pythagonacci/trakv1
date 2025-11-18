"use client";

import { useState, useEffect } from "react";
import { 
  CheckCircle2, Circle, Clock, User, Calendar, Plus, X, ChevronDown, MoreVertical,
  Flag, Tag, AlignLeft, CheckSquare, Paperclip, MessageSquare, Repeat, Users, ChevronRight
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
} from "@/components/ui/dropdown-menu";

interface Task {
  id: string | number;
  text: string;
  status: "todo" | "in-progress" | "done";
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  assignees?: string[];
  dueDate?: string;
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
}

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TaskBlockProps {
  block: Block;
  onUpdate?: () => void;
  workspaceId: string;
  scrollToTaskId?: string | null;
}

export default function TaskBlock({ block, onUpdate, workspaceId, scrollToTaskId }: TaskBlockProps) {
  const content = (block.content || {}) as { title?: string; tasks?: Task[] };
  const title = content.title || "Task list";
  const tasks = content.tasks || [];

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [editingTaskId, setEditingTaskId] = useState<string | number | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string | number, { description?: boolean; subtasks?: boolean; comments?: boolean }>>({});
  const [newComment, setNewComment] = useState<Record<string | number, string>>({});
  const [newTagInput, setNewTagInput] = useState("");
  
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

    await updateBlock({
      blockId: block.id,
      content: { ...content, tasks: newTasks },
    });
    onUpdate?.();
  };

  const setTaskStatus = async (taskId: string | number, status: Task["status"]) => {
    const newTasks = tasks.map((task) => (task.id === taskId ? { ...task, status } : task));
    await updateBlock({
      blockId: block.id,
      content: { ...content, tasks: newTasks },
    });
    onUpdate?.();
  };

  const addTask = async () => {
    const newTask: Task = {
      id: Date.now(),
      text: "New task",
      status: "todo",
    };
    const newTasks = [...tasks, newTask];
    await updateBlock({ blockId: block.id, content: { ...content, tasks: newTasks } });
    onUpdate?.();
  };

  const deleteTask = async (taskId: string | number) => {
    const newTasks = tasks.filter((task) => task.id !== taskId);
    await updateBlock({ blockId: block.id, content: { ...content, tasks: newTasks } });
    onUpdate?.();
  };

  const updateTask = async (taskId: string | number, updates: Partial<Task>) => {
    const newTasks = tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
    await updateBlock({ blockId: block.id, content: { ...content, tasks: newTasks } });
    onUpdate?.();
  };

  const getStatusIcon = (status: Task["status"]) =>
    status === "done" ? (
      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
    ) : status === "in-progress" ? (
      <Clock className="w-5 h-5 text-[#1d4ed8]" />
    ) : (
      <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
    );

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

  return (
    <div className="p-4">
      <div className="mb-3 font-semibold text-[var(--foreground)] text-sm uppercase tracking-wide">{title}</div>
      <div className="space-y-2.5">
        {tasks.map((task: Task) => {
          const taskSections = expandedSections[task.id] || {};
          const hasAnyExpanded = taskSections.comments;
          const hasExtendedInfo = (task.comments && task.comments.length > 0);
          
          return (
            <div
              id={`task-${task.id}`}
              key={task.id}
              className="group rounded-[6px] border border-[var(--border)] bg-[var(--surface)] transition-all duration-150 ease-out hover:border-[var(--foreground)]/15"
            >
              {/* Main Task Row */}
              <div className="flex items-start gap-2.5 px-3 py-2">
            {/* Status Icon */}
            <button
              onClick={() => toggleTask(task.id)}
                  className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:border-[var(--foreground)] flex-shrink-0"
              aria-label="Toggle task"
            >
              {getStatusIcon(task.status)}
            </button>

                <div className="flex-1 space-y-2 min-w-0">
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
                  className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-sm text-[var(--foreground)] shadow-sm focus:outline-none"
                />
              ) : (
                    <div className="flex items-start gap-2">
                <div
                  onClick={() => {
                    setEditingTaskId(task.id);
                    setEditingTaskText(task.text);
                  }}
                  className={cn(
                          "flex-1 cursor-text text-sm leading-snug text-[var(--foreground)] transition-colors hover:text-[var(--foreground)]",
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
                          <ChevronRight className={cn("h-4 w-4 transition-transform", hasAnyExpanded && "rotate-90")} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Priority & Tags Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {task.priority && task.priority !== "none" && (
                      <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium", getPriorityColor(task.priority))}>
                        <Flag className="h-3 w-3" />
                        {getPriorityLabel(task.priority)}
                      </span>
                    )}
                    
                    {task.tags && task.tags.map((tagName) => {
                      const tagConfig = commonTags.find(t => t.name === tagName);
                      return (
                        <span
                          key={tagName}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
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

                  {/* Description - Inline Display */}
                  {task.description !== undefined && (
                    <div className="mt-2 relative group/desc">
                      <textarea
                        value={task.description}
                        onChange={(e) => updateTask(task.id, { description: e.target.value })}
                        placeholder="Add description..."
                        className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--foreground)] focus:outline-none resize-none pr-6"
                        rows={2}
                      />
                      {task.description && (
                        <button
                          onClick={() => updateTask(task.id, { description: undefined })}
                          className="absolute top-1 right-1 opacity-0 group-hover/desc:opacity-100 text-[var(--tertiary-foreground)] hover:text-red-500 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Subtasks - Inline Display */}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="pl-4 space-y-1">
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
                        className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-0.5 ml-[18px]"
                      >
                        <Plus className="h-3 w-3" />
                        Add subtask
                      </button>
                    </div>
                  )}

                  {/* Assignees, Dates Row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--tertiary-foreground)]">
                    {/* Multiple Assignees */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]">
                          <Users className="h-3.5 w-3.5" />
                          {task.assignees && task.assignees.length > 0
                            ? `${task.assignees.length} assigned`
                            : "Assign"}
                      <ChevronDown className="h-3 w-3" />
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

                    {/* Start Date */}
                    {(task.startDate || hasAnyExpanded) && (
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-[var(--tertiary-foreground)]">Start:</span>
                        <input
                          type="date"
                          value={task.startDate || ""}
                          onChange={(e) => updateTask(task.id, { startDate: e.target.value || undefined })}
                          className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted-foreground)] focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Due Date */}
                    <div className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <input
                    type="date"
                    value={task.dueDate || ""}
                    onChange={(e) => updateTask(task.id, { dueDate: e.target.value || undefined })}
                    className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted-foreground)] focus:outline-none"
                  />
                  {task.dueDate && (
                    <button
                      onClick={() => updateTask(task.id, { dueDate: undefined })}
                      className="text-[var(--tertiary-foreground)] hover:text-[var(--muted-foreground)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

                {/* Three-dot menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] flex-shrink-0">
                      <MoreVertical className="h-4 w-4" />
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
                    
                    {/* Actions */}
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
                <div className="border-t border-[var(--border)] px-3 py-3 space-y-3 bg-[var(--surface-muted)]">
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
                              <span className="font-medium text-[var(--foreground)]">{comment.author}</span>
                              <span className="text-[var(--tertiary-foreground)]">
                                {new Date(comment.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[var(--muted-foreground)]">{comment.text}</p>
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
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-dashed border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
        >
          <Plus className="h-3.5 w-3.5" /> Add task
        </button>
      </div>
    </div>
  );
}

