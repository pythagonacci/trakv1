"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Clock, User, Calendar, Plus, X, ChevronDown } from "lucide-react";
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

type TaskStatus = "todo" | "in-progress" | "done";

interface Task {
  id: string | number;
  text: string;
  status: TaskStatus;
  assignee?: string;
  dueDate?: string;
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
}

export default function TaskBlock({ block, onUpdate, workspaceId }: TaskBlockProps) {
  const content = (block.content || {}) as { title?: string; tasks?: Task[] };
  const title = content.title || "New Task List";
  const tasks = content.tasks || [];

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [editingTaskId, setEditingTaskId] = useState<string | number | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | number | null>(null);

  // Load workspace members
  useEffect(() => {
    if (!workspaceId) {
      console.warn('⚠️ No workspaceId provided to TaskBlock');
      return;
    }

    const loadMembers = async () => {
      console.log('📋 Loading members for workspace:', workspaceId);
      const result = await getWorkspaceMembers(workspaceId);
      console.log('📋 getWorkspaceMembers result:', result);
      if (result.data) {
        console.log('✅ Loaded members:', result.data);
        console.log('✅ Members count:', result.data.length);
        setMembers(result.data);
      } else if (result.error) {
        console.error('❌ Error loading members:', result.error);
        setMembers([]); // Set empty array on error
      }
    };

    loadMembers();
  }, [workspaceId]);

  const toggleTask = async (taskId: string | number) => {
    const newTasks = tasks.map((t: Task) => {
      if (t.id === taskId) {
        // Cycle: todo -> in-progress -> done -> todo
        if (t.status === "todo") return { ...t, status: "in-progress" as TaskStatus };
        if (t.status === "in-progress") return { ...t, status: "done" as TaskStatus };
        return { ...t, status: "todo" as TaskStatus };
      }
      return t;
    });

    try {
      await updateBlock({
        blockId: block.id,
        content: { ...content, tasks: newTasks },
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const addTask = async () => {
    const newTask: Task = {
      id: Date.now(),
      text: "New task",
      status: "todo",
    };
    const newTasks = [...tasks, newTask];

    try {
      await updateBlock({
        blockId: block.id,
        content: { ...content, tasks: newTasks },
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  const deleteTask = async (taskId: string | number) => {
    const newTasks = tasks.filter((t: Task) => t.id !== taskId);

    try {
      await updateBlock({
        blockId: block.id,
        content: { ...content, tasks: newTasks },
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const updateTaskText = async (taskId: string | number, newText: string) => {
    const newTasks = tasks.map((t: Task) => (t.id === taskId ? { ...t, text: newText } : t));

    try {
      await updateBlock({
        blockId: block.id,
        content: { ...content, tasks: newTasks },
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update task text:", error);
    }
  };

  const updateTaskAssignee = async (taskId: string | number, assignee: string | undefined) => {
    const newTasks = tasks.map((t: Task) => (t.id === taskId ? { ...t, assignee } : t));

    try {
      await updateBlock({
        blockId: block.id,
        content: { ...content, tasks: newTasks },
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update task assignee:", error);
    }
  };

  const updateTaskDueDate = async (taskId: string | number, dueDate: string | undefined) => {
    const newTasks = tasks.map((t: Task) => (t.id === taskId ? { ...t, dueDate } : t));

    try {
      await updateBlock({
        blockId: block.id,
        content: { ...content, tasks: newTasks },
      });
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update task due date:", error);
    }
  };

  const updateTitle = async () => {
    setEditingTitle(false);
    if (titleValue !== title) {
      try {
        await updateBlock({
          blockId: block.id,
          content: { ...content, title: titleValue },
        });
        onUpdate?.();
      } catch (error) {
        console.error("Failed to update title:", error);
      }
    }
  };

  const startEditingTask = (taskId: string | number, currentText: string) => {
    setEditingTaskId(taskId);
    setEditingTaskText(currentText);
  };

  const finishEditingTask = async (taskId: string | number) => {
    setEditingTaskId(null);
    if (editingTaskText.trim()) {
      await updateTaskText(taskId, editingTaskText);
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    if (status === "done") {
      return <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />;
    }
    if (status === "in-progress") {
      return <Clock className="w-5 h-5 text-blue-600 dark:text-blue-500" />;
    }
    return <Circle className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />;
  };

  return (
    <div className="p-5">
      {/* Title - Editable */}
      {editingTitle ? (
        <input
          type="text"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={updateTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateTitle();
            if (e.key === "Escape") {
              setTitleValue(title);
              setEditingTitle(false);
            }
          }}
          autoFocus
          className="font-semibold text-neutral-900 dark:text-white mb-4 w-full bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mx-2 -my-1"
        />
      ) : (
        <div
          onClick={() => setEditingTitle(true)}
          className="font-semibold text-neutral-900 dark:text-white mb-4 cursor-text hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
        >
          {title}
        </div>
      )}

      {/* Tasks */}
      <div className="space-y-3">
        {tasks.map((task: Task) => (
          <div
            key={task.id}
            className="flex items-start gap-3 group"
            onMouseEnter={() => setHoveredTaskId(task.id)}
            onMouseLeave={() => setHoveredTaskId(null)}
          >
            {/* Status Icon */}
            <button
              onClick={() => toggleTask(task.id)}
              className="mt-px shrink-0"
              aria-label={`Toggle task: ${task.text}`}
            >
              {getStatusIcon(task.status)}
            </button>

            {/* Task Content */}
            <div className="flex-1 min-w-0">
              {/* Task Text - Editable */}
              {editingTaskId === task.id ? (
                <input
                  type="text"
                  value={editingTaskText}
                  onChange={(e) => setEditingTaskText(e.target.value)}
                  onBlur={() => finishEditingTask(task.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") finishEditingTask(task.id);
                    if (e.key === "Escape") setEditingTaskId(null);
                  }}
                  autoFocus
                  className="text-sm w-full bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mx-2 -my-1"
                />
              ) : (
                <div
                  onClick={() => startEditingTask(task.id, task.text)}
                  className={cn(
                    "text-sm leading-snug cursor-text hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded px-2 py-1 -mx-2 -my-1 transition-colors",
                    task.status === "done"
                      ? "line-through text-neutral-400 dark:text-neutral-500"
                      : "text-neutral-900 dark:text-white"
                  )}
                >
                  {task.text}
                </div>
              )}

              {/* Assignee & Due Date */}
              <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                {/* Assignee Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white transition-colors">
                      <User className="w-3 h-3" />
                      <span>{task.assignee || "Unassigned"}</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    className="w-56 max-h-64 overflow-y-auto z-50"
                    sideOffset={5}
                  >
                    <DropdownMenuItem
                      onClick={() => updateTaskAssignee(task.id, undefined)}
                      className="text-neutral-500"
                    >
                      Unassigned
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {members.length > 0 ? (
                      members.map((member) => (
                        <DropdownMenuItem
                          key={member.id}
                          onClick={() => updateTaskAssignee(task.id, member.name)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-medium">
                              {member.name[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm truncate">{member.name}</div>
                              <div className="text-xs text-neutral-500 truncate">{member.email}</div>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled className="text-neutral-400">
                        Loading members...
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Due Date Picker */}
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <input
                    type="date"
                    value={task.dueDate || ""}
                    onChange={(e) => updateTaskDueDate(task.id, e.target.value || undefined)}
                    className="bg-transparent border-none text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                  />
                  {task.dueDate && (
                    <button
                      onClick={() => updateTaskDueDate(task.id, undefined)}
                      className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      title="Clear due date"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Delete Button */}
            {hoveredTaskId === task.id && (
              <button
                onClick={() => deleteTask(task.id)}
                className="shrink-0 p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                aria-label="Delete task"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        {/* Add Task Button */}
        <button
          onClick={addTask}
          className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1.5 mt-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add task
        </button>
      </div>
    </div>
  );
}