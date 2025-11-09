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
import { clsx } from "clsx";

interface Task {
  id: string | number;
  text: string;
  status: "todo" | "in-progress" | "done";
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
  const title = content.title || "Task list";
  const tasks = content.tasks || [];

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [editingTaskId, setEditingTaskId] = useState<string | number | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  useEffect(() => {
    const loadMembers = async () => {
      const result = await getWorkspaceMembers(workspaceId);
      if (result.data) {
        setMembers(result.data);
      }
    };
    loadMembers();
  }, [workspaceId]);

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

  return (
    <div className="p-4">
      <div className="mb-3 font-semibold text-[var(--foreground)] text-sm uppercase tracking-wide">{title}</div>
      <div className="space-y-2.5">
        {tasks.map((task: Task) => (
          <div
            key={task.id}
            className="group flex items-start gap-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition-all duration-150 ease-out hover:border-[var(--foreground)]/15"
            onMouseEnter={() => setHoveredTaskId(task.id)}
            onMouseLeave={() => setHoveredTaskId(null)}
          >
            {/* Status Icon */}
            <button
              onClick={() => toggleTask(task.id)}
              className="mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:border-[var(--foreground)]"
              aria-label="Toggle task"
            >
              {getStatusIcon(task.status)}
            </button>

            <div className="flex-1 space-y-2">
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
                  className="w-full rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-sm text-[var(--foreground)] shadow-sm focus:outline-none"
                />
              ) : (
                <div
                  onClick={() => startEditingTask(task.id, task.text)}
                  className={cn(
                    "cursor-text text-sm leading-snug text-[var(--foreground)] transition-colors hover:text-[var(--foreground)]",
                    task.status === "done" && "line-through text-[var(--muted-foreground)]"
                  )}
                >
                  {task.text}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--tertiary-foreground)] mt-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]">
                      <User className="h-3.5 w-3.5" />
                      {task.assignee || "Assign"}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={() => updateTask(task.id, { assignee: undefined })}>Unassigned</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {members.map((member) => (
                      <DropdownMenuItem key={member.id} onClick={() => updateTask(task.id, { assignee: member.name })}>
                        {member.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="inline-flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  <input
                    type="date"
                    value={task.dueDate || ""}
                    onChange={(e) => updateTaskDueDate(task.id, e.target.value || undefined)}
                    className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted-foreground)] focus:border-[var(--foreground)] focus:outline-none"
                  />
                  {task.dueDate && (
                    <button
                      onClick={() => updateTaskDueDate(task.id, undefined)}
                      className="text-[var(--tertiary-foreground)] hover:text-[var(--muted-foreground)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => deleteTask(task.id)}
              className="hidden h-8 w-8 items-center justify-center rounded-full border border-transparent text-[var(--tertiary-foreground)] transition-colors hover:border-[var(--border)] hover:text-red-500 group-hover:flex"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

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